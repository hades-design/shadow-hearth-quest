// Minimal procedural ambient music: a slow drone that we can gate on/off.
// Boss stinger is handled inline (sfx already has "boss_intro").

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let drone: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode; osc2: OscillatorNode; gain2: GainNode } | null = null;
let currentMode: string = "none";
let volume = 0.35;

function ac(): AudioContext {
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function setMusicVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

const MODE_FREQ: Record<string, [number, number]> = {
  calm:   [55, 82.4],    // A1 + E2
  rot:    [58.3, 87.3],  // Bb1 + F2 — a semitone off, uneasy
  arcane: [61.7, 92.5],  // B1 + F#2
  cold:   [49, 73.4],    // G1 + D2
  storm:  [65.4, 98],    // C2 + G2
  boss:   [41.2, 61.7],  // E1 + B1 — deep
  hub:    [55, 82.4],
};

export function startMusic(mode: string) {
  if (currentMode === mode) return;
  stopMusic();
  const c = ac();
  const freqs = MODE_FREQ[mode] ?? MODE_FREQ.calm;
  const now = c.currentTime;

  const gain = c.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.32, now + 2);
  const osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = freqs[0];

  const gain2 = c.createGain(); gain2.gain.setValueAtTime(0, now); gain2.gain.linearRampToValueAtTime(0.18, now + 2.5);
  const osc2 = c.createOscillator(); osc2.type = "triangle"; osc2.frequency.value = freqs[1];

  // slow LFO for subtle detune → drifting drone
  const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
  const lfoGain = c.createGain(); lfoGain.gain.value = 3;
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

  // low-pass filter for warmth
  const filt = c.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = mode === "boss" ? 260 : 500;

  osc.connect(gain); osc2.connect(gain2);
  gain.connect(filt); gain2.connect(filt); filt.connect(master!);

  osc.start(); osc2.start(); lfo.start();
  drone = { osc, gain, lfo, lfoGain, osc2, gain2 };
  currentMode = mode;
}

export function stopMusic() {
  if (!drone || !ctx) return;
  const now = ctx.currentTime;
  drone.gain.gain.cancelScheduledValues(now);
  drone.gain2.gain.cancelScheduledValues(now);
  drone.gain.gain.linearRampToValueAtTime(0, now + 1);
  drone.gain2.gain.linearRampToValueAtTime(0, now + 1);
  const d = drone;
  setTimeout(() => {
    try { d.osc.stop(); d.osc2.stop(); d.lfo.stop(); } catch { /* ignore */ }
  }, 1100);
  drone = null;
  currentMode = "none";
}

export function bossStinger() {
  if (!master || !ctx) return;
  const c = ctx;
  const now = c.currentTime;
  // low boom
  const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(40, now + 1.2);
  const g = c.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.55, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + 1.5);
  // choir hit
  const c2 = c.createOscillator(); c2.type = "triangle"; c2.frequency.value = 523;
  const g2 = c.createGain(); g2.gain.setValueAtTime(0, now); g2.gain.linearRampToValueAtTime(0.22, now + 0.05); g2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
  c2.connect(g2); g2.connect(master); c2.start(now); c2.stop(now + 1.7);
  const c3 = c.createOscillator(); c3.type = "sine"; c3.frequency.value = 784;
  const g3 = c.createGain(); g3.gain.setValueAtTime(0, now); g3.gain.linearRampToValueAtTime(0.14, now + 0.08); g3.gain.exponentialRampToValueAtTime(0.001, now + 2);
  c3.connect(g3); g3.connect(master); c3.start(now); c3.stop(now + 2.1);
}
