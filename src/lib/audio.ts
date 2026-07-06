// Lightweight WebAudio SFX synth — no external deps.
// Each cue is a short envelope over oscillators / noise.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext {
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function setMuted(v: boolean) { muted = v; if (master) master.gain.value = v ? 0 : 0.5; }
export function isMuted() { return muted; }

export function unlockAudio() {
  const c = ac();
  if (c.state === "suspended") c.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.3, slide = 0, delay = 0) {
  if (muted) return;
  const c = ac();
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); g.connect(master!);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.25, filterFreq = 1200, delay = 0) {
  if (muted) return;
  const c = ac();
  const t = c.currentTime + delay;
  const bufSize = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt); filt.connect(g); g.connect(master!);
  src.start(t);
}

export type SfxName =
  | "swing" | "hit" | "crit" | "player_hit" | "dodge"
  | "cast_flame" | "cast_glint" | "cast_holy" | "throw"
  | "heal" | "grace" | "chest_open" | "boon_pick"
  | "level_up" | "upgrade" | "enemy_die" | "boss_intro"
  | "boss_die" | "death" | "victory" | "menu";

export function sfx(n: SfxName) {
  if (muted) return;
  try { unlockAudio(); } catch { /* noop */ }
  switch (n) {
    case "swing": noise(0.14, 0.18, 2000); tone(320, 0.09, "triangle", 0.12, -200); break;
    case "hit": noise(0.09, 0.35, 800); tone(140, 0.10, "sawtooth", 0.22, -80); break;
    case "crit": noise(0.14, 0.5, 900); tone(180, 0.16, "sawtooth", 0.3, -120); tone(560, 0.18, "square", 0.15, -300, 0.03); break;
    case "player_hit": tone(220, 0.18, "sawtooth", 0.35, -150); noise(0.18, 0.35, 500); break;
    case "dodge": noise(0.16, 0.22, 1500); tone(520, 0.12, "sine", 0.14, 200); break;
    case "cast_flame":
      tone(180, 0.35, "sawtooth", 0.22, 260);
      tone(360, 0.32, "triangle", 0.14, 200, 0.02);
      noise(0.30, 0.14, 700, 0.02); break;
    case "cast_glint":
      tone(880, 0.30, "sine", 0.22, 400);
      tone(1320, 0.28, "triangle", 0.14, 500, 0.03);
      tone(660, 0.26, "sine", 0.12, 300, 0.05); break;
    case "cast_holy":
      tone(523, 0.35, "sine", 0.20, 200);
      tone(784, 0.4, "sine", 0.15, 300, 0.05);
      tone(1046, 0.5, "triangle", 0.12, 400, 0.1); break;
    case "throw": noise(0.08, 0.2, 3000); tone(600, 0.08, "square", 0.12, 400); break;
    case "heal":
      tone(392, 0.4, "sine", 0.22, 200);
      tone(523, 0.5, "sine", 0.18, 250, 0.08);
      tone(659, 0.6, "triangle", 0.14, 300, 0.16); break;
    case "grace":
      tone(523, 0.6, "sine", 0.18, 100);
      tone(659, 0.7, "sine", 0.14, 120, 0.1);
      tone(784, 0.8, "triangle", 0.12, 140, 0.2);
      tone(1046, 0.9, "sine", 0.10, 200, 0.35); break;
    case "chest_open":
      noise(0.20, 0.20, 1000);
      tone(220, 0.18, "sawtooth", 0.20, 180, 0.02);
      tone(660, 0.35, "triangle", 0.18, 500, 0.15);
      tone(880, 0.5, "sine", 0.16, 700, 0.30); break;
    case "boon_pick":
      tone(659, 0.15, "triangle", 0.22, 400);
      tone(880, 0.20, "sine", 0.20, 500, 0.06);
      tone(1174, 0.35, "sine", 0.15, 600, 0.14); break;
    case "level_up":
      tone(523, 0.15, "triangle", 0.22, 300);
      tone(659, 0.15, "triangle", 0.22, 300, 0.10);
      tone(784, 0.15, "triangle", 0.22, 300, 0.20);
      tone(1046, 0.4, "sine", 0.22, 400, 0.30); break;
    case "upgrade":
      tone(140, 0.10, "sawtooth", 0.20, -60);
      noise(0.20, 0.18, 900, 0.05);
      tone(680, 0.30, "triangle", 0.18, 400, 0.12); break;
    case "enemy_die": noise(0.25, 0.25, 500); tone(180, 0.24, "sawtooth", 0.18, -140); break;
    case "boss_intro":
      tone(80, 1.2, "sawtooth", 0.35, 20);
      noise(1.2, 0.20, 300);
      tone(160, 1.2, "sawtooth", 0.20, 40, 0.1); break;
    case "boss_die":
      tone(90, 1.6, "sawtooth", 0.35, 30);
      noise(1.6, 0.28, 400);
      tone(523, 1.5, "sine", 0.14, 400, 0.4);
      tone(880, 1.8, "sine", 0.10, 600, 0.7); break;
    case "death":
      tone(300, 0.8, "sawtooth", 0.30, -260);
      noise(1.2, 0.24, 400, 0.05);
      tone(80, 1.5, "sine", 0.22, 20, 0.15); break;
    case "victory":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, "triangle", 0.22, 200, i * 0.15));
      tone(1318, 1.2, "sine", 0.18, 400, 0.7); break;
    case "menu": tone(720, 0.06, "square", 0.15, -100); break;
  }
}
