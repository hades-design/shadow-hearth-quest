import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================
// SHADOW HEARTH — 2D dark-fantasy side-scroller
// Pixel-art aesthetic inspired by Blasphemous / Elden Ring
// Rendered entirely on <canvas> using primitive shapes.
// ============================================================

type Vec = { x: number; y: number };

type Entity = {
  id: number;
  kind: "enemy" | "npc" | "boss";
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  state: "idle" | "walk" | "attack" | "hurt" | "dead";
  stateT: number;
  attackCd: number;
  name?: string;
  color?: string;
  onGround?: boolean;
  npcId?: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity?: number;
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  friendly: boolean;
  color: string;
  size: number;
  damage: number;
};

type Item = {
  key: string;
  name: string;
  kind: "weapon" | "flask" | "relic";
  icon: "sword" | "flask" | "orb" | "dagger" | "staff";
  desc: string;
};

type NpcDialog = {
  id: string;
  name: string;
  portrait: "fia" | "melina" | "ranni";
  lines: {
    text: string;
    choices?: { label: string; next?: number; action?: () => void }[];
  }[];
};

const GAME_W = 960;
const GAME_H = 540;
const GROUND_Y = 430;
const GRAVITY = 0.7;
const MOVE_SPD = 3.2;
const JUMP_V = -12;

// ----- Palette -----
const C = {
  sky: "#0a0d18",
  fog: "#131a2a",
  wallDark: "#1a1712",
  wallMid: "#2d2318",
  wallLight: "#4a3826",
  wallHi: "#6b503a",
  mortar: "#0f0b07",
  grass: "#2d5a2f",
  grassHi: "#5e8f3a",
  grassDark: "#1a3a1c",
  vine: "#1f4020",
  ember: "#ff7b3a",
  emberHot: "#ffd06b",
  hpRed: "#c02628",
  hpRedDark: "#5a1214",
  fpBlue: "#2d5aa8",
  fpBlueDark: "#132c56",
  staGreen: "#3e8a3a",
  staGreenDark: "#1c3f1c",
  frame: "#c9a24a",
  frameDark: "#6b4a1e",
  parchment: "#e8c98a",
  ink: "#1a1208",
  playerArmor: "#c4c8cc",
  playerArmorDark: "#6b6f74",
  playerCloth: "#a8232a",
  playerClothDark: "#5a1216",
  bloodDrop: "#8a1a1e",
};

// ----- Classes -----
type ClassKey = "tarnished" | "astrologer" | "prophet" | "samurai";
const CLASSES: Record<
  ClassKey,
  { name: string; title: string; hp: number; fp: number; sta: number; atk: number; blurb: string }
> = {
  tarnished: { name: "Tarnished Warrior", title: "Errante da Terra Intermédia", hp: 140, fp: 40, sta: 120, atk: 18, blurb: "Aço, sangue, e uma espada longa." },
  astrologer: { name: "Astrologer", title: "Filho das Estrelas", hp: 90, fp: 120, sta: 90, atk: 10, blurb: "Feitiços de vitrálio e o brilho do cosmos." },
  prophet: { name: "Prophet", title: "Vidente Cego", hp: 110, fp: 100, sta: 100, atk: 12, blurb: "Milagres de fé e chamas sagradas." },
  samurai: { name: "Samurai", title: "Exilado de Terras Distantes", hp: 120, fp: 60, sta: 130, atk: 16, blurb: "Katana veloz, corte de sangue." },
};

const ITEMS: Record<string, Item> = {
  longsword: { key: "longsword", name: "Espada Longa", kind: "weapon", icon: "sword", desc: "+18 dano físico" },
  uchigatana: { key: "uchigatana", name: "Uchigatana", kind: "weapon", icon: "sword", desc: "+16 dano, causa sangramento" },
  glintstaff: { key: "glintstaff", name: "Cajado de Vitrálio", kind: "weapon", icon: "staff", desc: "+22 feitiço" },
  finger_seal: { key: "finger_seal", name: "Selo de Dedos", kind: "weapon", icon: "orb", desc: "+20 fé" },
  crimson_flask: { key: "crimson_flask", name: "Frasco Carmesim", kind: "flask", icon: "flask", desc: "Restaura HP" },
  cerulean_flask: { key: "cerulean_flask", name: "Frasco Cerúleo", kind: "flask", icon: "flask", desc: "Restaura FP" },
  golden_seed: { key: "golden_seed", name: "Semente Dourada", kind: "relic", icon: "orb", desc: "+1 uso de frasco" },
};

// ============================================================
export default function EldenGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [started, setStarted] = useState(false);
  const [chosenClass, setChosenClass] = useState<ClassKey | null>(null);
  const [uiTick, setUiTick] = useState(0); // force HUD rerender
  const [dialog, setDialog] = useState<{ npc: NpcDialog; line: number } | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState<"dead" | "victory" | null>(null);

  // ---- game state (refs so RAF loop can mutate freely) ----
  const state = useRef({
    t: 0,
    keys: {} as Record<string, boolean>,
    cam: 0,
    player: {
      x: 200,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      w: 34,
      h: 60,
      facing: 1 as 1 | -1,
      onGround: true,
      hp: 140,
      maxHp: 140,
      fp: 40,
      maxFp: 40,
      sta: 120,
      maxSta: 120,
      atk: 18,
      state: "idle" as "idle" | "walk" | "attack" | "hurt" | "dead" | "cast" | "roll",
      stateT: 0,
      attackCd: 0,
      rollCd: 0,
      castCd: 0,
      iFrames: 0,
      runes: 0,
      flasks: 4,
      maxFlasks: 4,
      fpFlasks: 2,
      maxFpFlasks: 2,
      equipped: {
        weapon: "longsword",
      },
      inventory: ["longsword", "crimson_flask", "cerulean_flask"] as string[],
      className: "tarnished" as ClassKey,
    },
    entities: [] as Entity[],
    particles: [] as Particle[],
    projectiles: [] as Projectile[],
    torches: [] as { x: number; y: number }[],
    graces: [] as { x: number; y: number; used: boolean }[],
    worldW: 3200,
    dialogOpen: false,
    inventoryOpen: false,
    paused: false,
    nextId: 1,
    hitPause: 0,
    screenShake: 0,
    lastDamageT: 0,
  });

  const s = state.current;

  // ---- audio ----
  const audioCtx = useRef<AudioContext | null>(null);
  const getAudio = () => {
    if (!audioCtx.current) {
      try {
        audioCtx.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return audioCtx.current;
  };
  const sfx = useCallback((type: "hit" | "swing" | "cast" | "heal" | "grace" | "hurt" | "death" | "victory" | "step" | "parry") => {
    const ctx = getAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    switch (type) {
      case "hit":
        o.type = "square"; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(60, now + 0.12);
        g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15); o.start(now); o.stop(now + 0.15); break;
      case "swing":
        o.type = "triangle"; o.frequency.setValueAtTime(420, now); o.frequency.exponentialRampToValueAtTime(180, now + 0.08);
        g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1); o.start(now); o.stop(now + 0.1); break;
      case "cast":
        o.type = "sine"; o.frequency.setValueAtTime(320, now); o.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); o.start(now); o.stop(now + 0.3); break;
      case "heal":
        o.type = "sine"; o.frequency.setValueAtTime(520, now); o.frequency.linearRampToValueAtTime(880, now + 0.3);
        g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.35); o.start(now); o.stop(now + 0.35); break;
      case "grace":
        o.type = "sine"; o.frequency.setValueAtTime(660, now); o.frequency.linearRampToValueAtTime(990, now + 0.6);
        g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.7); o.start(now); o.stop(now + 0.7); break;
      case "hurt":
        o.type = "sawtooth"; o.frequency.setValueAtTime(220, now); o.frequency.exponentialRampToValueAtTime(80, now + 0.2);
        g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.22); o.start(now); o.stop(now + 0.22); break;
      case "death":
        o.type = "sawtooth"; o.frequency.setValueAtTime(160, now); o.frequency.exponentialRampToValueAtTime(40, now + 1.2);
        g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.3); o.start(now); o.stop(now + 1.3); break;
      case "victory":
        o.type = "triangle"; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(880, now + 0.4); o.frequency.linearRampToValueAtTime(1320, now + 0.8);
        g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.5); o.start(now); o.stop(now + 1.5); break;
      case "parry":
        o.type = "square"; o.frequency.setValueAtTime(1200, now); o.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1); o.start(now); o.stop(now + 0.1); break;
      case "step":
        o.type = "square"; o.frequency.setValueAtTime(80, now);
        g.gain.setValueAtTime(0.06, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05); o.start(now); o.stop(now + 0.05); break;
    }
  }, []);

  // ---- NPCs ----
  const npcDialogs: Record<string, NpcDialog> = {
    fia: {
      id: "fia",
      name: "Fia",
      portrait: "fia",
      lines: [
        { text: "Um abraço, Manchado? Meu toque acalma os mortos.", choices: [
          { label: "· Aceitar o abraço", next: 1 },
          { label: "· Recusar", next: 2 },
        ]},
        { text: "*Você sente frio, mas dorme melhor. HP máximo aumentado.*", choices: [{ label: "Continuar", next: -1, action: () => { s.player.maxHp += 15; s.player.hp = s.player.maxHp; setUiTick(t=>t+1); } }] },
        { text: "Como quiser. As sombras te aguardam.", choices: [{ label: "Sair", next: -1 }] },
      ],
    },
    melina: {
      id: "melina",
      name: "Melina",
      portrait: "melina",
      lines: [
        { text: "Sou Melina. Ofereço-me como sua donzela. Aceita meu pacto?", choices: [
          { label: "· Aceitar", next: 1 },
          { label: "· Recusar", next: 2 },
        ]},
        { text: "Então marchemos juntos. Que teu caminho ilumine a Árvore Áurea. +10 ATK.", choices: [{ label: "Continuar", next: -1, action: () => { s.player.atk += 10; setUiTick(t=>t+1); } }] },
        { text: "Muito bem. Encontre-me quando estiver pronto.", choices: [{ label: "Sair", next: -1 }] },
      ],
    },
  };

  // ---- world init ----
  const initWorld = useCallback((cls: ClassKey) => {
    const c = CLASSES[cls];
    s.player.hp = s.player.maxHp = c.hp;
    s.player.fp = s.player.maxFp = c.fp;
    s.player.sta = s.player.maxSta = c.sta;
    s.player.atk = c.atk;
    s.player.className = cls;
    s.player.x = 200;
    s.player.y = GROUND_Y;
    s.player.runes = 0;
    s.player.flasks = s.player.maxFlasks;
    s.player.fpFlasks = s.player.maxFpFlasks;
    s.player.inventory = ["crimson_flask", "cerulean_flask"];
    if (cls === "tarnished") { s.player.inventory.push("longsword"); s.player.equipped.weapon = "longsword"; }
    if (cls === "samurai") { s.player.inventory.push("uchigatana"); s.player.equipped.weapon = "uchigatana"; }
    if (cls === "astrologer") { s.player.inventory.push("glintstaff"); s.player.equipped.weapon = "glintstaff"; }
    if (cls === "prophet") { s.player.inventory.push("finger_seal"); s.player.equipped.weapon = "finger_seal"; }

    s.entities = [];
    s.particles = [];
    s.projectiles = [];
    s.cam = 0;
    s.worldW = 3600;

    // torches
    s.torches = [];
    for (let x = 400; x < s.worldW; x += 260) s.torches.push({ x, y: GROUND_Y - 130 });

    // graces
    s.graces = [
      { x: 320, y: GROUND_Y, used: false },
      { x: 1800, y: GROUND_Y, used: false },
      { x: 3100, y: GROUND_Y, used: false },
    ];

    // NPCs
    s.entities.push({ id: s.nextId++, kind: "npc", x: 480, y: GROUND_Y, vx: 0, vy: 0, w: 30, h: 58, hp: 999, maxHp: 999, facing: -1, state: "idle", stateT: 0, attackCd: 0, name: "Melina", npcId: "melina" });
    s.entities.push({ id: s.nextId++, kind: "npc", x: 2500, y: GROUND_Y, vx: 0, vy: 0, w: 30, h: 58, hp: 999, maxHp: 999, facing: -1, state: "idle", stateT: 0, attackCd: 0, name: "Fia", npcId: "fia" });

    // enemies
    const spawnGrunt = (x: number) => s.entities.push({ id: s.nextId++, kind: "enemy", x, y: GROUND_Y, vx: 0, vy: 0, w: 32, h: 54, hp: 45, maxHp: 45, facing: -1, state: "idle", stateT: 0, attackCd: 0, name: "Soldado Perdido", color: "#4a3a2a" });
    const spawnKnight = (x: number) => s.entities.push({ id: s.nextId++, kind: "enemy", x, y: GROUND_Y, vx: 0, vy: 0, w: 40, h: 62, hp: 90, maxHp: 90, facing: -1, state: "idle", stateT: 0, attackCd: 0, name: "Cavaleiro do Cadinho", color: "#8a7a3a" });
    [700, 900, 1150, 1400, 1650, 2100, 2300, 2700, 2900].forEach(spawnGrunt);
    [1250, 2400].forEach(spawnKnight);

    // boss
    s.entities.push({
      id: s.nextId++, kind: "boss", x: 3400, y: GROUND_Y, vx: 0, vy: 0, w: 70, h: 100, hp: 500, maxHp: 500, facing: -1, state: "idle", stateT: 0, attackCd: 0, name: "Margit, a Presença Ruinosa", color: "#3a2a1a",
    });

    setStarted(true);
    setChosenClass(cls);
    setGameOver(null);
    setDialog(null);
    setShowInventory(false);
    setUiTick(t => t + 1);
  }, [s]);

  // ---- input ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      s.keys[k] = true;
      if (k === "i") { setShowInventory(v => !v); s.inventoryOpen = !s.inventoryOpen; }
      if (k === "escape") { setDialog(null); setShowInventory(false); s.dialogOpen = false; s.inventoryOpen = false; }
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { s.keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [s]);

  // ---- helpers ----
  const spawnParticles = (x: number, y: number, count: number, color: string, spread = 3, life = 30) => {
    for (let i = 0; i < count; i++) {
      s.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * spread * 2,
        vy: -Math.random() * spread - 1,
        life, maxLife: life,
        color, size: 2 + Math.random() * 2, gravity: 0.15,
      });
    }
  };

  const damagePlayer = (dmg: number) => {
    const p = s.player;
    if (p.iFrames > 0 || p.state === "dead") return;
    p.hp = Math.max(0, p.hp - dmg);
    p.iFrames = 40;
    p.state = "hurt"; p.stateT = 15;
    s.screenShake = 8;
    spawnParticles(p.x, p.y - 30, 8, C.bloodDrop, 4, 25);
    sfx("hurt");
    if (p.hp <= 0) {
      p.state = "dead"; p.stateT = 0;
      sfx("death");
      setTimeout(() => setGameOver("dead"), 1200);
    }
    setUiTick(t => t + 1);
  };

  const damageEnemy = (e: Entity, dmg: number, crit = false) => {
    e.hp -= dmg;
    e.state = "hurt"; e.stateT = 12;
    s.screenShake = Math.max(s.screenShake, crit ? 6 : 3);
    spawnParticles(e.x, e.y - e.h / 2, crit ? 12 : 6, C.bloodDrop, crit ? 5 : 3, crit ? 30 : 20);
    sfx("hit");
    if (e.hp <= 0) {
      e.state = "dead";
      s.player.runes += e.kind === "boss" ? 5000 : e.kind === "npc" ? 0 : (e.maxHp > 60 ? 200 : 60);
      setUiTick(t => t + 1);
      if (e.kind === "boss") {
        sfx("victory");
        setMessage(`GRANDE INIMIGO CAÍDO\n${e.name}`);
        setTimeout(() => { setMessage(null); setGameOver("victory"); }, 3200);
      }
    }
  };

  // ---- main loop ----
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    const step = () => {
      s.t++;
      const p = s.player;

      // pause when dialog/inventory
      const paused = !!dialog || showInventory || gameOver !== null;

      if (!paused && p.state !== "dead") {
        // ---- input handling ----
        const K = s.keys;
        const left = K["a"] || K["arrowleft"];
        const right = K["d"] || K["arrowright"];
        const jump = K["w"] || K[" "] || K["arrowup"];
        const attack = K["j"] || K["x"];
        const cast = K["k"] || K["c"];
        const roll = K["l"] || K["shift"];
        const useFlask = K["r"];
        const useFpFlask = K["f"];
        const interact = K["e"];

        // regen stamina
        if (p.sta < p.maxSta) p.sta = Math.min(p.maxSta, p.sta + 0.6);

        // movement
        if (p.state !== "attack" && p.state !== "cast" && p.state !== "roll") {
          if (left) { p.vx = -MOVE_SPD; p.facing = -1; }
          else if (right) { p.vx = MOVE_SPD; p.facing = 1; }
          else p.vx *= 0.75;
          if (jump && p.onGround) { p.vy = JUMP_V; p.onGround = false; sfx("step"); }
        } else {
          p.vx *= 0.85;
        }

        // roll
        if (roll && p.rollCd <= 0 && p.sta >= 25 && p.onGround) {
          p.state = "roll"; p.stateT = 24; p.rollCd = 30; p.sta -= 25; p.iFrames = 18;
          p.vx = p.facing * 7;
          sfx("step");
        }

        // attack
        if (attack && p.attackCd <= 0 && p.state !== "attack" && p.sta >= 15) {
          p.state = "attack"; p.stateT = 22; p.attackCd = 34; p.sta -= 15;
          sfx("swing");
          // hit test on next-tick side hits — do a swept check across duration
        }

        // cast (sorcery/miracle) — uses FP
        if (cast && p.castCd <= 0 && p.fp >= 12 && p.state !== "cast") {
          p.state = "cast"; p.stateT = 28; p.castCd = 40; p.fp -= 12;
          sfx("cast");
          // projectile spawns mid-cast (below)
        }

        // flasks
        if (useFlask && p.flasks > 0 && p.hp < p.maxHp) {
          p.flasks--; p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.5));
          spawnParticles(p.x, p.y - 40, 14, "#c02628", 2, 40);
          sfx("heal");
          setUiTick(t => t + 1);
          s.keys["r"] = false;
        }
        if (useFpFlask && p.fpFlasks > 0 && p.fp < p.maxFp) {
          p.fpFlasks--; p.fp = Math.min(p.maxFp, p.fp + Math.floor(p.maxFp * 0.6));
          spawnParticles(p.x, p.y - 40, 14, "#2d5aa8", 2, 40);
          sfx("heal");
          setUiTick(t => t + 1);
          s.keys["f"] = false;
        }

        // interact
        if (interact) {
          s.keys["e"] = false;
          // grace
          const grace = s.graces.find(g => Math.abs(g.x - p.x) < 60);
          if (grace) {
            p.hp = p.maxHp; p.fp = p.maxFp; p.sta = p.maxSta;
            p.flasks = p.maxFlasks; p.fpFlasks = p.maxFpFlasks;
            grace.used = true;
            // respawn dead grunts
            s.entities.forEach(e => { if (e.kind === "enemy" && e.state === "dead") { e.hp = e.maxHp; e.state = "idle"; }});
            spawnParticles(grace.x, GROUND_Y - 40, 20, C.emberHot, 3, 60);
            sfx("grace");
            setMessage("REPOUSO CONCEDIDO");
            setTimeout(() => setMessage(null), 1400);
            setUiTick(t => t + 1);
          }
          // npc
          const npc = s.entities.find(e => e.kind === "npc" && Math.abs(e.x - p.x) < 55);
          if (npc && npc.npcId && npcDialogs[npc.npcId]) {
            setDialog({ npc: npcDialogs[npc.npcId], line: 0 });
            s.dialogOpen = true;
          }
        }

        // ---- state timers ----
        if (p.stateT > 0) p.stateT--;
        if (p.attackCd > 0) p.attackCd--;
        if (p.castCd > 0) p.castCd--;
        if (p.rollCd > 0) p.rollCd--;
        if (p.iFrames > 0) p.iFrames--;

        // attack hitbox
        if (p.state === "attack" && p.stateT > 8 && p.stateT < 18) {
          const hbX = p.x + p.facing * 30;
          const hbW = 55;
          s.entities.forEach(e => {
            if (e.kind === "npc" || e.state === "dead") return;
            if (Math.abs(e.x - hbX) < hbW && Math.abs((e.y - e.h/2) - (p.y - p.h/2)) < 60 && !(e as Entity & { _hit?: number })._hit) {
              (e as Entity & { _hit?: number })._hit = s.t;
              const crit = Math.random() < 0.15;
              damageEnemy(e, p.atk * (crit ? 2 : 1), crit);
            }
          });
        } else {
          s.entities.forEach(e => { (e as Entity & { _hit?: number })._hit = undefined; });
        }

        // cast — spawn projectile
        if (p.state === "cast" && p.stateT === 20) {
          const projColor = p.className === "prophet" ? "#ffd06b" : "#8ac6ff";
          s.projectiles.push({
            x: p.x + p.facing * 30, y: p.y - 35,
            vx: p.facing * 8, vy: 0, life: 90, friendly: true,
            color: projColor, size: 8, damage: 35,
          });
          spawnParticles(p.x + p.facing * 30, p.y - 35, 10, projColor, 2, 25);
        }

        // end states
        if (p.state !== "idle" && p.state !== "walk" && p.stateT <= 0) {
          p.state = "idle";
        }

        // physics
        p.vy += GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.onGround = true; } else p.onGround = false;
        p.x = Math.max(30, Math.min(s.worldW - 30, p.x));

        if (p.state === "idle" || p.state === "walk") {
          p.state = Math.abs(p.vx) > 0.3 ? "walk" : "idle";
        }
      }

      // ---- update entities ----
      if (!paused) {
        s.entities.forEach(e => {
          if (e.state === "dead" || e.kind === "npc") return;
          const p = s.player;
          const dx = p.x - e.x;
          const dist = Math.abs(dx);
          e.facing = dx >= 0 ? 1 : -1;
          if (e.stateT > 0) e.stateT--;
          if (e.attackCd > 0) e.attackCd--;

          if (e.state === "hurt") {
            e.vx = -e.facing * 1.5;
            if (e.stateT <= 0) e.state = "idle";
          } else if (e.state === "attack") {
            // active frames
            if (e.stateT > 8 && e.stateT < 18) {
              if (Math.abs(p.x - e.x) < (e.kind === "boss" ? 90 : 55) && Math.abs(p.y - e.y) < 60 && !(e as Entity & { _phit?: boolean })._phit) {
                (e as Entity & { _phit?: boolean })._phit = true;
                damagePlayer(e.kind === "boss" ? 28 : e.maxHp > 60 ? 22 : 14);
              }
            } else {
              (e as Entity & { _phit?: boolean })._phit = false;
            }
            if (e.stateT <= 0) e.state = "idle";
          } else {
            const aggroR = e.kind === "boss" ? 500 : 260;
            const atkR = e.kind === "boss" ? 90 : 60;
            if (dist < aggroR && dist > atkR) {
              e.vx = e.facing * (e.kind === "boss" ? 1.4 : 1.8);
              e.state = "walk";
            } else if (dist <= atkR && e.attackCd <= 0) {
              e.state = "attack"; e.stateT = 28; e.attackCd = e.kind === "boss" ? 80 : 60; e.vx = 0;
              // boss projectile
              if (e.kind === "boss" && Math.random() < 0.5) {
                s.projectiles.push({ x: e.x + e.facing * 30, y: e.y - 60, vx: e.facing * 5, vy: -1, life: 120, friendly: false, color: "#c02628", size: 10, damage: 20 });
              }
            } else {
              e.vx *= 0.85;
              e.state = "idle";
            }
          }

          // physics
          e.vy += GRAVITY;
          e.x += e.vx;
          e.y += e.vy;
          if (e.y >= GROUND_Y) { e.y = GROUND_Y; e.vy = 0; e.onGround = true; }
          e.x = Math.max(30, Math.min(s.worldW - 30, e.x));
        });
      }

      // ---- projectiles ----
      if (!paused) {
        s.projectiles = s.projectiles.filter(pr => {
          pr.x += pr.vx; pr.y += pr.vy; pr.vy += 0.02; pr.life--;
          if (pr.life <= 0) return false;
          if (pr.friendly) {
            for (const e of s.entities) {
              if (e.state === "dead" || e.kind === "npc") continue;
              if (Math.abs(e.x - pr.x) < 30 && Math.abs((e.y - e.h/2) - pr.y) < 40) {
                damageEnemy(e, pr.damage, true);
                spawnParticles(pr.x, pr.y, 12, pr.color, 4, 25);
                return false;
              }
            }
          } else {
            const pl = s.player;
            if (Math.abs(pl.x - pr.x) < 24 && Math.abs((pl.y - pl.h/2) - pr.y) < 40) {
              damagePlayer(pr.damage);
              spawnParticles(pr.x, pr.y, 8, pr.color, 3, 20);
              return false;
            }
          }
          return true;
        });
      }

      // particles
      s.particles = s.particles.filter(pa => {
        pa.x += pa.vx; pa.y += pa.vy;
        if (pa.gravity) pa.vy += pa.gravity;
        pa.life--;
        return pa.life > 0;
      });

      // camera
      const camTarget = Math.max(0, Math.min(s.worldW - GAME_W, s.player.x - GAME_W / 2));
      s.cam += (camTarget - s.cam) * 0.12;

      if (s.screenShake > 0) s.screenShake *= 0.85;

      // ---- render ----
      render(ctx);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, dialog, showInventory, gameOver]);

  // ============================================================
  // RENDER
  // ============================================================
  const render = (ctx: CanvasRenderingContext2D) => {
    const shake = s.screenShake > 0.5 ? (Math.random() - 0.5) * s.screenShake : 0;
    ctx.save();
    ctx.translate(shake, shake);

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
    g.addColorStop(0, C.sky);
    g.addColorStop(0.6, C.fog);
    g.addColorStop(1, "#0a0508");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // distant fog/moon
    ctx.fillStyle = "rgba(120,110,90,0.06)";
    ctx.beginPath(); ctx.arc(720, 90, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(200,180,140,0.12)";
    ctx.beginPath(); ctx.arc(720, 90, 30, 0, Math.PI * 2); ctx.fill();

    // parallax back walls (slower)
    drawParallaxWall(ctx, -s.cam * 0.3, 0.5);

    // main walls
    drawMainWall(ctx, -s.cam);

    // arch doorways
    for (let ax = 300; ax < s.worldW; ax += 900) {
      drawArch(ctx, ax - s.cam, GROUND_Y);
    }

    // ground
    drawGround(ctx, -s.cam);

    // graces
    s.graces.forEach(gc => drawGrace(ctx, gc.x - s.cam, gc.y, s.t));

    // torches
    s.torches.forEach(tr => drawTorch(ctx, tr.x - s.cam, tr.y, s.t));

    // entities
    const sortedEnt = [...s.entities].sort((a, b) => a.y - b.y);
    sortedEnt.forEach(e => {
      const sx = e.x - s.cam;
      if (sx < -80 || sx > GAME_W + 80) return;
      if (e.kind === "npc") drawNpc(ctx, sx, e.y, e);
      else if (e.kind === "boss") drawBoss(ctx, sx, e.y, e, s.t);
      else drawEnemy(ctx, sx, e.y, e);
      // hp bar over enemy
      if (e.kind !== "npc" && e.state !== "dead") {
        drawEntityHp(ctx, sx, e.y - e.h - 12, e);
      }
    });

    // projectiles
    s.projectiles.forEach(pr => {
      const px = pr.x - s.cam;
      ctx.fillStyle = pr.color;
      ctx.shadowColor = pr.color; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(px, pr.y, pr.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // player
    drawPlayer(ctx, s.player.x - s.cam, s.player.y);

    // particles
    s.particles.forEach(pa => {
      const alpha = pa.life / pa.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x - s.cam, pa.y, pa.size, pa.size);
    });
    ctx.globalAlpha = 1;

    // vignette
    const vg = ctx.createRadialGradient(GAME_W/2, GAME_H/2, 200, GAME_W/2, GAME_H/2, 620);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.restore();

    // BOSS bar
    const boss = s.entities.find(e => e.kind === "boss" && e.state !== "dead" && Math.abs(e.x - s.player.x) < 600);
    if (boss) drawBossBar(ctx, boss);

    if (message) drawCenterMessage(ctx, message);
  };

  // ---- draw helpers ----
  const drawParallaxWall = (ctx: CanvasRenderingContext2D, offset: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    const brickW = 60, brickH = 24;
    const startX = Math.floor(offset / brickW) * brickW;
    for (let bx = startX; bx < startX + GAME_W + brickW; bx += brickW) {
      for (let by = 40; by < GROUND_Y; by += brickH) {
        const stagger = (Math.floor(by / brickH) % 2) * (brickW / 2);
        const x = bx + stagger - offset;
        const shade = Math.random() > 0.5 ? C.wallDark : C.wallMid;
        // deterministic pattern using pos
        const seed = ((bx * 13 + by * 7) & 0xff) / 255;
        ctx.fillStyle = seed > 0.5 ? C.wallDark : "#0d0a06";
        ctx.fillRect(x, by, brickW - 2, brickH - 2);
        // highlight top
        ctx.fillStyle = "rgba(80,60,40,0.15)";
        ctx.fillRect(x, by, brickW - 2, 3);
        void shade;
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawMainWall = (ctx: CanvasRenderingContext2D, offset: number) => {
    const brickW = 72, brickH = 28;
    const rows = Math.ceil((GROUND_Y - 60) / brickH);
    for (let r = 0; r < rows; r++) {
      const by = 60 + r * brickH;
      const stagger = (r % 2) * (brickW / 2);
      const startX = Math.floor(offset / brickW) * brickW - brickW;
      for (let bx = startX; bx < startX + GAME_W + brickW * 2; bx += brickW) {
        const x = bx + stagger + offset;
        const seed = ((bx * 17 + r * 31) & 0xff) / 255;
        // brick face
        ctx.fillStyle = C.wallMid;
        ctx.fillRect(x, by, brickW - 3, brickH - 3);
        // shade variation
        if (seed > 0.7) { ctx.fillStyle = C.wallDark; ctx.fillRect(x + 4, by + 4, brickW - 12, brickH - 10); }
        else if (seed > 0.5) { ctx.fillStyle = C.wallLight; ctx.fillRect(x + 2, by + 2, 6, brickH - 8); }
        // top highlight
        ctx.fillStyle = C.wallHi;
        ctx.fillRect(x, by, brickW - 3, 2);
        // moss dots
        if (seed > 0.85) {
          ctx.fillStyle = C.vine;
          ctx.fillRect(x + 8, by + brickH - 8, 4, 3);
          ctx.fillRect(x + 20, by + brickH - 6, 6, 2);
        }
      }
    }
    // vines hanging from top
    ctx.fillStyle = C.vine;
    for (let vx = 40; vx < GAME_W + 200; vx += 180) {
      const rx = vx + (offset % 180);
      ctx.fillRect(rx, 60, 3, 40 + ((vx * 7) % 30));
      ctx.fillRect(rx + 8, 60, 2, 25);
    }
  };

  const drawArch = (ctx: CanvasRenderingContext2D, x: number, groundY: number) => {
    if (x < -180 || x > GAME_W + 180) return;
    const w = 140, h = 220;
    // dark opening
    ctx.fillStyle = "#050308";
    ctx.beginPath();
    ctx.moveTo(x - w/2, groundY);
    ctx.lineTo(x - w/2, groundY - h + 60);
    ctx.quadraticCurveTo(x, groundY - h - 20, x + w/2, groundY - h + 60);
    ctx.lineTo(x + w/2, groundY);
    ctx.closePath();
    ctx.fill();
    // bars
    ctx.fillStyle = "#1c1a14";
    for (let bx = -w/2 + 20; bx < w/2 - 15; bx += 18) {
      ctx.fillRect(x + bx, groundY - h + 40, 3, h - 40);
    }
    // arch frame stones
    ctx.strokeStyle = C.wallHi; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w/2 - 6, groundY);
    ctx.lineTo(x - w/2 - 6, groundY - h + 60);
    ctx.quadraticCurveTo(x, groundY - h - 26, x + w/2 + 6, groundY - h + 60);
    ctx.lineTo(x + w/2 + 6, groundY);
    ctx.stroke();
    // interior glow (moonlight)
    const gg = ctx.createLinearGradient(0, groundY - h, 0, groundY);
    gg.addColorStop(0, "rgba(80,90,140,0.25)");
    gg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(x - w/2 + 4, groundY);
    ctx.lineTo(x - w/2 + 4, groundY - h + 62);
    ctx.quadraticCurveTo(x, groundY - h - 14, x + w/2 - 4, groundY - h + 62);
    ctx.lineTo(x + w/2 - 4, groundY);
    ctx.closePath();
    ctx.fill();
  };

  const drawGround = (ctx: CanvasRenderingContext2D, offset: number) => {
    // grass line
    ctx.fillStyle = C.grassDark;
    ctx.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);
    // grass blades
    ctx.fillStyle = C.grass;
    for (let x = 0; x < GAME_W; x += 4) {
      const wx = x - (offset % 4);
      const h = 6 + (((wx + Math.floor(offset)) * 13) & 7);
      ctx.fillRect(wx, GROUND_Y - h, 2, h);
    }
    // grass highlights
    ctx.fillStyle = C.grassHi;
    for (let x = 0; x < GAME_W; x += 12) {
      const wx = x - (offset % 12);
      const h = 4 + (((wx + Math.floor(offset)) * 7) & 5);
      ctx.fillRect(wx, GROUND_Y - h, 1, h);
    }
    // dirt patches
    ctx.fillStyle = "#3a2a1a";
    for (let x = 0; x < GAME_W; x += 30) {
      const wx = x - (offset % 30);
      ctx.fillRect(wx, GROUND_Y + 4, 26, 2);
    }
  };

  const drawTorch = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number) => {
    if (x < -30 || x > GAME_W + 30) return;
    // bracket
    ctx.fillStyle = "#2a1e12";
    ctx.fillRect(x - 4, y, 8, 20);
    ctx.fillRect(x - 8, y + 6, 16, 4);
    // flame
    const flick = Math.sin(t * 0.4 + x) * 0.5 + Math.sin(t * 0.7 + x * 2) * 0.5;
    const fh = 22 + flick * 3;
    ctx.fillStyle = C.ember;
    ctx.beginPath();
    ctx.ellipse(x, y - fh / 2, 8, fh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.emberHot;
    ctx.beginPath();
    ctx.ellipse(x, y - fh / 2 + 2, 4, fh / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // glow
    const grad = ctx.createRadialGradient(x, y - fh/2, 5, x, y - fh/2, 80);
    grad.addColorStop(0, "rgba(255,150,60,0.35)");
    grad.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - 80, y - fh - 60, 160, 140);
  };

  const drawGrace = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number) => {
    if (x < -40 || x > GAME_W + 40) return;
    const wob = Math.sin(t * 0.1) * 2;
    // stele
    ctx.fillStyle = "#d4b467";
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = t * 0.03 + i;
      const r = 14 + Math.sin(angle) * 2;
      const px = x + Math.cos(angle) * r;
      const py = y - 20 + wob + Math.sin(angle) * r * 0.4;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // glow
    const gr = ctx.createRadialGradient(x, y - 20, 5, x, y - 20, 100);
    gr.addColorStop(0, "rgba(255,210,120,0.5)");
    gr.addColorStop(1, "rgba(255,210,120,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(x - 100, y - 120, 200, 200);
    // rising embers
    for (let i = 0; i < 4; i++) {
      const py = y - 20 - ((t * 1.5 + i * 30) % 80);
      ctx.fillStyle = "rgba(255,210,120,0.8)";
      ctx.fillRect(x + Math.sin(t * 0.05 + i) * 12, py, 2, 2);
    }
  };

  // ----- character rendering -----
  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const p = s.player;
    const flicker = p.iFrames > 0 && Math.floor(s.t / 3) % 2 === 0;
    ctx.save();
    if (flicker) ctx.globalAlpha = 0.4;
    ctx.translate(x, y);
    ctx.scale(p.facing, 1);

    if (p.state === "roll") {
      ctx.rotate(-p.stateT * 0.4);
      drawKnightSprite(ctx, 0, -20, s.t);
    } else if (p.state === "dead") {
      ctx.rotate(Math.PI / 2);
      drawKnightSprite(ctx, 0, -20, s.t);
    } else {
      const bob = p.state === "walk" ? Math.sin(s.t * 0.35) * 2 : 0;
      const attackLunge = p.state === "attack" ? Math.max(0, 8 - Math.abs(p.stateT - 14) * 2) : 0;
      const castTilt = p.state === "cast" ? -0.1 : 0;
      ctx.rotate(castTilt);
      drawKnightSprite(ctx, attackLunge, -30 + bob, s.t, p.state, p.stateT);
    }
    ctx.restore();
  };

  const drawKnightSprite = (
    ctx: CanvasRenderingContext2D,
    ox: number, oy: number, t: number,
    stateName: string = "idle", stateT: number = 0,
  ) => {
    // legs
    const legSwing = Math.sin(t * 0.35) * 4;
    ctx.fillStyle = C.playerArmorDark;
    ctx.fillRect(ox - 8, oy + 42, 8, 18); // back leg
    ctx.fillRect(ox + 2, oy + 42 + Math.abs(legSwing), 8, 18 - Math.abs(legSwing));
    // red cloth belt
    ctx.fillStyle = C.playerCloth;
    ctx.fillRect(ox - 12, oy + 34, 22, 10);
    ctx.fillStyle = C.playerClothDark;
    ctx.fillRect(ox - 12, oy + 42, 22, 2);
    // torso armor
    ctx.fillStyle = C.playerArmor;
    ctx.fillRect(ox - 12, oy + 18, 22, 18);
    ctx.fillStyle = C.playerArmorDark;
    ctx.fillRect(ox - 12, oy + 30, 22, 3);
    ctx.fillRect(ox + 6, oy + 18, 4, 18); // right shading
    // shoulder pauldron
    ctx.fillStyle = C.playerArmor;
    ctx.fillRect(ox - 14, oy + 16, 8, 10);
    ctx.fillRect(ox + 6, oy + 16, 8, 10);
    ctx.fillStyle = C.playerArmorDark;
    ctx.fillRect(ox - 14, oy + 24, 8, 2);
    ctx.fillRect(ox + 6, oy + 24, 8, 2);
    // arm holding weapon (front)
    ctx.fillStyle = C.playerArmor;
    if (stateName === "attack") {
      // extended forward
      ctx.fillRect(ox + 4, oy + 20, 16, 6);
      // sword
      drawSword(ctx, ox + 22, oy + 18);
    } else if (stateName === "cast") {
      ctx.fillRect(ox + 4, oy + 14, 6, 20);
      // staff/seal glow
      const col = s.player.className === "prophet" ? "#ffd06b" : "#8ac6ff";
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(ox + 14, oy + 12, 6 + Math.sin(t*0.4)*2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillRect(ox + 4, oy + 22, 6, 18);
      // sword at hip
      drawSword(ctx, ox + 8, oy + 24);
    }
    // helm
    ctx.fillStyle = C.playerArmor;
    ctx.fillRect(ox - 10, oy + 2, 20, 16);
    ctx.fillStyle = C.playerArmorDark;
    ctx.fillRect(ox - 10, oy + 14, 20, 4);
    // visor slit
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(ox - 8, oy + 8, 16, 3);
    // helm ridge
    ctx.fillStyle = "#e8e8ec";
    ctx.fillRect(ox - 2, oy + 2, 4, 4);
    ctx.fillRect(ox - 10, oy + 2, 20, 2);
    void stateT;
  };

  const drawSword = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // grip
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(x - 2, y, 4, 8);
    // guard
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x - 6, y - 2, 12, 3);
    // blade
    ctx.fillStyle = "#e8ecf0";
    ctx.fillRect(x - 1, y - 30, 2, 28);
    ctx.fillStyle = "#a8b0b8";
    ctx.fillRect(x, y - 30, 1, 28);
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(e.facing, 1);
    if (e.state === "dead") { ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.6; }
    const bob = e.state === "walk" ? Math.sin(s.t * 0.3) * 2 : 0;
    const oy = -e.h + bob;
    // legs
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(-8, oy + 40, 6, 14);
    ctx.fillRect(2, oy + 40, 6, 14);
    // body
    ctx.fillStyle = e.color || "#4a3a2a";
    ctx.fillRect(-10, oy + 18, 20, 24);
    ctx.fillStyle = "#2a1e12";
    ctx.fillRect(-10, oy + 34, 20, 3);
    // arm + weapon
    if (e.state === "attack") {
      ctx.fillStyle = e.color || "#4a3a2a";
      ctx.fillRect(4, oy + 20, 16, 5);
      // rusty blade
      ctx.fillStyle = "#8a7050";
      ctx.fillRect(20, oy + 6, 2, 22);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(18, oy + 20, 6, 3);
    } else {
      ctx.fillStyle = e.color || "#4a3a2a";
      ctx.fillRect(4, oy + 22, 6, 16);
    }
    // head — hooded/skull
    ctx.fillStyle = "#1a1208";
    ctx.fillRect(-9, oy, 18, 14);
    ctx.fillStyle = "#c02628";
    ctx.fillRect(-5, oy + 6, 3, 3);
    ctx.fillRect(2, oy + 6, 3, 3);
    ctx.restore();
  };

  const drawBoss = (ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity, t: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(e.facing, 1);
    if (e.state === "dead") { ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.5; }
    const bob = e.state === "walk" ? Math.sin(t * 0.25) * 3 : Math.sin(t * 0.08) * 2;
    const oy = -e.h + bob;
    // cloak/body
    ctx.fillStyle = "#1a0f08";
    ctx.beginPath();
    ctx.moveTo(-30, oy + 100);
    ctx.lineTo(-22, oy + 20);
    ctx.lineTo(22, oy + 20);
    ctx.lineTo(30, oy + 100);
    ctx.closePath();
    ctx.fill();
    // gold trim
    ctx.fillStyle = "#8a6a2a";
    ctx.fillRect(-30, oy + 96, 60, 4);
    // armor plate
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(-18, oy + 30, 36, 30);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(-16, oy + 32, 32, 3);
    // arm — mace/staff
    if (e.state === "attack") {
      ctx.fillStyle = "#3a2818";
      ctx.fillRect(10, oy + 22, 22, 6);
      // hammer head
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(30, oy + 12, 14, 22);
      ctx.fillStyle = "#8a6a2a";
      ctx.fillRect(30, oy + 30, 14, 4);
    } else {
      ctx.fillStyle = "#3a2818";
      ctx.fillRect(12, oy + 28, 8, 30);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(10, oy + 56, 12, 16);
    }
    // horns/helm
    ctx.fillStyle = "#0a0805";
    ctx.fillRect(-14, oy - 4, 28, 22);
    ctx.fillStyle = "#c9a24a";
    // horns
    ctx.beginPath();
    ctx.moveTo(-14, oy - 4); ctx.lineTo(-22, oy - 22); ctx.lineTo(-10, oy);
    ctx.moveTo(14, oy - 4); ctx.lineTo(22, oy - 22); ctx.lineTo(10, oy);
    ctx.fill();
    // eye glow
    ctx.fillStyle = "#ffd06b";
    ctx.shadowColor = "#ff9040"; ctx.shadowBlur = 8;
    ctx.fillRect(-6, oy + 6, 3, 3);
    ctx.fillRect(3, oy + 6, 3, 3);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawNpc = (ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity) => {
    ctx.save();
    ctx.translate(x, y);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0, 2, 18, 4, 0, 0, Math.PI*2); ctx.fill();
    // robe
    ctx.fillStyle = "#141018";
    ctx.beginPath();
    ctx.moveTo(-18, 0); ctx.lineTo(-12, -50); ctx.lineTo(12, -50); ctx.lineTo(18, 0);
    ctx.closePath(); ctx.fill();
    // hood
    ctx.fillStyle = "#0a0810";
    ctx.beginPath(); ctx.arc(0, -50, 12, Math.PI, 0); ctx.fill();
    ctx.fillRect(-12, -52, 24, 8);
    // face
    ctx.fillStyle = "#e8ceac";
    ctx.fillRect(-6, -46, 12, 8);
    // hair (blonde bangs)
    ctx.fillStyle = "#d4b467";
    ctx.fillRect(-8, -50, 16, 4);
    ctx.fillRect(-6, -44, 3, 2);
    ctx.fillRect(3, -44, 3, 2);
    // eyes
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(-4, -42, 2, 2);
    ctx.fillRect(2, -42, 2, 2);
    // interact prompt
    const p = s.player;
    if (Math.abs(p.x - e.x) < 60) {
      const wob = Math.sin(s.t * 0.15) * 2;
      ctx.fillStyle = C.parchment;
      ctx.font = "bold 12px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.fillText("[E] Falar", 0, -72 + wob);
    }
    ctx.restore();
  };

  // ----- HUD/UI -----
  const drawEntityHp = (ctx: CanvasRenderingContext2D, x: number, y: number, e: Entity) => {
    const w = 40, h = 3;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - w/2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = C.hpRedDark;
    ctx.fillRect(x - w/2, y, w, h);
    ctx.fillStyle = C.hpRed;
    ctx.fillRect(x - w/2, y, w * (e.hp / e.maxHp), h);
  };

  const drawBossBar = (ctx: CanvasRenderingContext2D, e: Entity) => {
    const bw = 620, bh = 8;
    const bx = GAME_W/2 - bw/2, by = GAME_H - 60;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(bx - 4, by - 20, bw + 8, bh + 26);
    ctx.fillStyle = C.hpRedDark;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = C.hpRed;
    ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    ctx.fillStyle = C.frame;
    ctx.font = "bold 14px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.fillText(e.name || "", GAME_W/2, by - 6);
  };

  const drawCenterMessage = (ctx: CanvasRenderingContext2D, msg: string) => {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, GAME_H/2 - 60, GAME_W, 120);
    ctx.textAlign = "center";
    ctx.fillStyle = C.parchment;
    ctx.font = "bold 34px 'Cinzel', serif";
    const lines = msg.split("\n");
    lines.forEach((l, i) => ctx.fillText(l, GAME_W/2, GAME_H/2 - 8 + i * 40));
  };

  // ============================================================
  // React UI
  // ============================================================
  const p = s.player;
  void uiTick;

  if (!started) {
    return <TitleScreen onStart={initWorld} />;
  }

  return (
    <div className="mx-auto w-full max-w-[960px] select-none">
      <div className="relative" style={{ width: GAME_W, height: GAME_H, margin: "0 auto" }}>
        <canvas
          ref={canvasRef}
          width={GAME_W}
          height={GAME_H}
          className="w-full h-full block border border-[color:var(--color-frame,#c9a24a)]/40 shadow-[0_0_60px_rgba(0,0,0,0.9)]"
          style={{ imageRendering: "pixelated", background: "#000" }}
        />

        {/* HUD top-left */}
        <TopLeftHUD player={p} />

        {/* Inventory quickbar bottom-left */}
        <QuickInventoryBar player={p} />

        {/* Rune counter bottom-right */}
        <div className="absolute right-4 bottom-4 font-display text-[color:var(--color-gold)] text-sm tracking-widest">
          <div className="flex items-center gap-2 bg-black/60 border border-[color:var(--color-gold)]/40 px-3 py-1.5">
            <RuneIcon />
            <span>{p.runes.toLocaleString()}</span>
          </div>
        </div>

        {/* Controls hint */}
        <div className="absolute right-4 top-4 text-[10px] text-[color:var(--color-parchment,#e8c98a)]/70 font-body leading-tight text-right bg-black/50 border border-[color:var(--color-gold)]/20 px-2 py-1">
          <div>A / D · Mover · W Pular</div>
          <div>J Ataque · K Magia · L Esquiva</div>
          <div>R Frasco HP · F Frasco FP · E Interagir</div>
          <div>I Inventário</div>
        </div>

        {/* Dialog */}
        {dialog && <DialogueBox
          dialog={dialog}
          onAdvance={(next, action) => {
            action?.();
            if (next === -1 || next === undefined) { setDialog(null); s.dialogOpen = false; }
            else setDialog({ ...dialog, line: next });
          }}
        />}

        {/* Inventory */}
        {showInventory && <InventoryPanel player={p} onClose={() => { setShowInventory(false); s.inventoryOpen = false; }} onEquip={(k) => { s.player.equipped.weapon = k; setUiTick(t=>t+1); }} />}

        {/* Game over */}
        {gameOver === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85">
            <div className="font-display text-5xl text-[color:var(--color-hpRed,#c02628)] tracking-[0.3em] mb-6" style={{textShadow: "0 0 20px rgba(192,38,40,0.6)"}}>VOCÊ MORREU</div>
            <button onClick={() => initWorld(chosenClass!)} className="font-display px-8 py-3 border border-[color:var(--color-gold)] text-[color:var(--color-gold)] hover:bg-[color:var(--color-gold)]/10 tracking-widest">Renascer no Sítio da Graça</button>
          </div>
        )}
        {gameOver === "victory" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85">
            <div className="font-display text-4xl text-[color:var(--color-gold)] tracking-[0.3em] mb-2 animate-flicker">SENHOR ANCESTRAL CAÍDO</div>
            <div className="font-body italic text-[color:var(--color-parchment,#e8c98a)] mb-6">A Árvore Áurea range sob teu passo.</div>
            <button onClick={() => initWorld(chosenClass!)} className="font-display px-8 py-3 border border-[color:var(--color-gold)] text-[color:var(--color-gold)] hover:bg-[color:var(--color-gold)]/10 tracking-widest">Recomeçar Jornada</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// UI Sub-components
// ============================================================

function TitleScreen({ onStart }: { onStart: (cls: ClassKey) => void }) {
  const [sel, setSel] = useState<ClassKey>("tarnished");
  return (
    <div className="mx-auto max-w-[960px] py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-5xl md:text-6xl tracking-[0.25em] text-gold-glow animate-flicker">SHADOW HEARTH</h1>
        <div className="font-body italic text-[color:var(--color-parchment,#e8c98a)]/80 mt-2">Uma peregrinação nas terras cinzentas.</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(Object.keys(CLASSES) as ClassKey[]).map(k => {
          const c = CLASSES[k];
          const active = sel === k;
          return (
            <button key={k} onClick={() => setSel(k)}
              className={`p-4 text-left border transition-all ${active ? "border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10" : "border-[color:var(--color-gold)]/20 bg-black/40 hover:border-[color:var(--color-gold)]/60"}`}>
              <div className="font-display text-[color:var(--color-gold)] tracking-widest text-sm">{c.name.toUpperCase()}</div>
              <div className="font-body italic text-xs text-[color:var(--color-parchment,#e8c98a)]/70 mb-2">{c.title}</div>
              <div className="text-[10px] text-[color:var(--color-parchment,#e8c98a)]/60 space-y-0.5">
                <div>HP <span className="text-[color:var(--color-hpRed,#c02628)]">{c.hp}</span> · FP <span className="text-[color:var(--color-fpBlue,#2d5aa8)]">{c.fp}</span> · STA <span className="text-[color:var(--color-staGreen,#3e8a3a)]">{c.sta}</span></div>
                <div>ATK {c.atk}</div>
              </div>
              <div className="text-[10px] text-[color:var(--color-parchment,#e8c98a)]/50 mt-2 italic">{c.blurb}</div>
            </button>
          );
        })}
      </div>
      <div className="text-center">
        <button onClick={() => onStart(sel)}
          className="font-display px-12 py-3 border-2 border-[color:var(--color-gold)] text-[color:var(--color-gold)] hover:bg-[color:var(--color-gold)]/15 tracking-[0.3em] text-lg">
          COMEÇAR JORNADA
        </button>
      </div>
    </div>
  );
}

function TopLeftHUD({ player }: { player: { hp: number; maxHp: number; fp: number; maxFp: number; sta: number; maxSta: number } }) {
  return (
    <div className="absolute top-3 left-3 flex items-start gap-2">
      {/* Sigil */}
      <div className="relative" style={{ width: 62, height: 62 }}>
        <svg viewBox="0 0 62 62" width="62" height="62">
          <defs>
            <radialGradient id="sigilGrad" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#3a2a1a" />
              <stop offset="1" stopColor="#0a0805" />
            </radialGradient>
          </defs>
          <rect x="1" y="1" width="60" height="60" fill="url(#sigilGrad)" stroke="#c9a24a" strokeWidth="1.5" />
          {/* runic circle */}
          <circle cx="31" cy="31" r="20" fill="none" stroke="#8a6a2a" strokeWidth="1" />
          <circle cx="31" cy="31" r="14" fill="none" stroke="#c9a24a" strokeWidth="1" />
          {/* triangle */}
          <path d="M31 16 L46 42 L16 42 Z" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
          <path d="M31 46 L20 27 L42 27 Z" fill="none" stroke="#c9a24a" strokeWidth="1" />
          {/* corners */}
          <path d="M1 1 L10 1 M1 1 L1 10 M61 1 L52 1 M61 1 L61 10 M1 61 L10 61 M1 61 L1 52 M61 61 L52 61 M61 61 L61 52" stroke="#c9a24a" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      {/* Bars */}
      <div className="flex flex-col gap-1 pt-1">
        <Bar value={player.hp} max={player.maxHp} color="#c02628" dark="#3a0a0c" width={220} />
        <Bar value={player.fp} max={player.maxFp} color="#2d5aa8" dark="#0e1c3a" width={190} />
        <Bar value={player.sta} max={player.maxSta} color="#3e8a3a" dark="#0f2810" width={170} />
      </div>
    </div>
  );
}

function Bar({ value, max, color, dark, width }: { value: number; max: number; color: string; dark: string; width: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative" style={{ width, height: 10 }}>
      {/* frame */}
      <div className="absolute inset-0" style={{ background: "#0a0705", border: "1px solid #c9a24a", boxShadow: "0 0 4px rgba(0,0,0,0.8)" }} />
      <div className="absolute" style={{ left: 1, top: 1, right: 1, bottom: 1, background: dark }} />
      <div className="absolute" style={{
        left: 1, top: 1, bottom: 1,
        width: `calc(${pct * 100}% - 2px)`,
        background: `linear-gradient(to bottom, ${color} 0%, ${color} 40%, ${dark} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 6px ${color}80`,
      }} />
    </div>
  );
}

function QuickInventoryBar({ player }: { player: { equipped: { weapon: string }; flasks: number; fpFlasks: number } }) {
  const wpn = ITEMS[player.equipped.weapon];
  return (
    <div className="absolute bottom-3 left-3 flex gap-1.5">
      <Slot icon={wpn?.icon || "sword"} label={wpn?.name} />
      <Slot icon="flask" label={`x${player.flasks}`} flaskColor="#c02628" />
      <Slot icon="flask" label={`x${player.fpFlasks}`} flaskColor="#2d5aa8" />
      <Slot icon="orb" label="" />
    </div>
  );
}

function Slot({ icon, label, flaskColor }: { icon: string; label?: string; flaskColor?: string }) {
  return (
    <div className="relative" style={{ width: 46, height: 54 }}>
      <div className="absolute inset-0 border" style={{
        borderColor: "#c9a24a",
        background: "linear-gradient(to bottom, #1a1208, #0a0705)",
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)",
      }} />
      {/* ornate corners */}
      <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t border-l" style={{ borderColor: "#c9a24a" }} />
      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t border-r" style={{ borderColor: "#c9a24a" }} />
      <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b border-l" style={{ borderColor: "#c9a24a" }} />
      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b border-r" style={{ borderColor: "#c9a24a" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <SlotIcon type={icon} flaskColor={flaskColor} />
      </div>
      {label && (
        <div className="absolute -bottom-1 right-0.5 font-display text-[10px] text-[color:var(--color-gold)] bg-black/70 px-1 leading-none">{label}</div>
      )}
    </div>
  );
}

function SlotIcon({ type, flaskColor }: { type: string; flaskColor?: string }) {
  if (type === "sword") return (
    <svg width="30" height="36" viewBox="0 0 30 36">
      <rect x="14" y="4" width="2" height="22" fill="#e8ecf0" />
      <rect x="15" y="4" width="1" height="22" fill="#a8b0b8" />
      <rect x="8" y="24" width="14" height="3" fill="#c9a24a" />
      <rect x="13" y="27" width="4" height="7" fill="#3a2818" />
    </svg>
  );
  if (type === "dagger") return (
    <svg width="30" height="36" viewBox="0 0 30 36">
      <rect x="14" y="10" width="2" height="14" fill="#e8ecf0" />
      <rect x="10" y="22" width="10" height="2" fill="#c9a24a" />
      <rect x="13" y="24" width="4" height="6" fill="#3a2818" />
    </svg>
  );
  if (type === "staff") return (
    <svg width="30" height="36" viewBox="0 0 30 36">
      <rect x="14" y="8" width="2" height="24" fill="#3a2818" />
      <circle cx="15" cy="8" r="5" fill="#8ac6ff" opacity="0.8" />
      <circle cx="15" cy="8" r="3" fill="#e0f0ff" />
    </svg>
  );
  if (type === "orb") return (
    <svg width="30" height="36" viewBox="0 0 30 36">
      <circle cx="15" cy="18" r="10" fill="#c9a24a" opacity="0.3" />
      <circle cx="15" cy="18" r="7" fill="#ffd06b" />
      <circle cx="13" cy="16" r="2" fill="#fff2cc" />
    </svg>
  );
  if (type === "flask") return (
    <svg width="30" height="36" viewBox="0 0 30 36">
      <rect x="12" y="4" width="6" height="4" fill="#3a2818" />
      <path d="M11 8 L11 14 L7 30 Q7 34 15 34 Q23 34 23 30 L19 14 L19 8 Z" fill="#1a1208" stroke="#c9a24a" strokeWidth="0.5" />
      <path d="M11.5 16 L9 30 Q9 32.5 15 32.5 Q21 32.5 21 30 L18.5 16 Z" fill={flaskColor || "#c02628"} />
      <ellipse cx="12" cy="20" rx="1" ry="3" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
  return null;
}

function RuneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="none" stroke="#c9a24a" />
      <path d="M8 3 L8 13 M3 8 L13 8" stroke="#c9a24a" strokeWidth="1" />
      <circle cx="8" cy="8" r="2" fill="#ffd06b" />
    </svg>
  );
}

// ---- Dialogue ----
function DialogueBox({ dialog, onAdvance }: {
  dialog: { npc: NpcDialog; line: number };
  onAdvance: (next: number, action?: () => void) => void;
}) {
  const line = dialog.npc.lines[dialog.line];
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end pointer-events-auto">
      {/* Left NPC portrait */}
      <Portrait name={dialog.npc.name} which="npc" portraitKey={dialog.npc.portrait} />

      {/* Dialogue box */}
      <div className="flex-1 mx-2 mb-1 relative" style={{
        background: "linear-gradient(to bottom, #0d0806 0%, #1a1208 100%)",
        border: "2px solid #c9a24a",
        boxShadow: "inset 0 0 20px rgba(0,0,0,0.9), 0 4px 20px rgba(0,0,0,0.8)",
        minHeight: 130,
      }}>
        <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-[color:var(--color-gold)]" />
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-[color:var(--color-gold)]" />
        <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-[color:var(--color-gold)]" />
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-[color:var(--color-gold)]" />

        <div className="p-4 pl-6 grid grid-cols-2 gap-4 h-full">
          <div className="font-body text-[color:var(--color-parchment,#e8c98a)] text-lg leading-relaxed">
            {line.text}
          </div>
          <div className="flex flex-col justify-center gap-1.5">
            {line.choices?.map((c, i) => (
              <button key={i} onClick={() => onAdvance(c.next ?? -1, c.action)}
                className="text-left font-body text-[color:var(--color-parchment,#e8c98a)] hover:text-[color:var(--color-gold)] hover:bg-[color:var(--color-gold)]/10 px-2 py-1 transition-colors">
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right player portrait */}
      <Portrait name="Manchado" which="player" portraitKey="knight" />
    </div>
  );
}

function Portrait({ name, which, portraitKey }: { name: string; which: "npc" | "player"; portraitKey: string }) {
  return (
    <div className="mb-1 relative" style={{ width: 130, height: 130 }}>
      <div className="absolute inset-0" style={{
        background: "linear-gradient(to bottom, #0d0806, #1a1208)",
        border: "2px solid #c9a24a",
      }} />
      <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-[color:var(--color-gold)]" />
      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-[color:var(--color-gold)]" />
      <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-[color:var(--color-gold)]" />
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-[color:var(--color-gold)]" />
      <div className="absolute inset-2 overflow-hidden flex items-center justify-center">
        {which === "player" ? <PortraitKnight /> : <PortraitNpc kind={portraitKey} />}
      </div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/90 border border-[color:var(--color-gold)] px-3 py-0.5 font-display text-xs text-[color:var(--color-gold)] tracking-widest whitespace-nowrap">
        {name}
      </div>
    </div>
  );
}

function PortraitKnight() {
  return (
    <svg width="100" height="110" viewBox="0 0 100 110">
      {/* helm */}
      <rect x="30" y="20" width="40" height="42" fill="#c4c8cc" />
      <rect x="30" y="52" width="40" height="6" fill="#6b6f74" />
      <rect x="30" y="20" width="40" height="4" fill="#e8ecef" />
      <rect x="46" y="18" width="8" height="6" fill="#e8ecef" />
      {/* visor */}
      <rect x="34" y="34" width="32" height="4" fill="#0a0a0a" />
      <rect x="34" y="42" width="32" height="2" fill="#0a0a0a" />
      {/* pauldrons */}
      <rect x="18" y="60" width="18" height="24" fill="#c4c8cc" />
      <rect x="64" y="60" width="18" height="24" fill="#c4c8cc" />
      <rect x="18" y="78" width="18" height="4" fill="#6b6f74" />
      <rect x="64" y="78" width="18" height="4" fill="#6b6f74" />
      {/* chest */}
      <rect x="34" y="62" width="32" height="30" fill="#a8232a" />
      <rect x="34" y="84" width="32" height="4" fill="#5a1216" />
      {/* rivets */}
      <circle cx="24" cy="72" r="1.5" fill="#3a3a3e" />
      <circle cx="76" cy="72" r="1.5" fill="#3a3a3e" />
    </svg>
  );
}

function PortraitNpc({ kind }: { kind: string }) {
  return (
    <svg width="100" height="110" viewBox="0 0 100 110">
      {/* hood */}
      <path d="M20 40 Q20 15 50 12 Q80 15 80 40 L80 80 L20 80 Z" fill="#0d0812" />
      <path d="M22 42 Q22 20 50 18 Q78 20 78 42 L78 70" fill="none" stroke="#2a1a2a" strokeWidth="1" />
      {/* face */}
      <ellipse cx="50" cy="50" rx="18" ry="22" fill="#e8ceac" />
      {/* hair blonde */}
      <path d="M32 32 Q50 22 68 32 L66 44 L60 40 L54 42 L50 40 L46 42 L40 40 L34 44 Z" fill="#d4b467" />
      {/* eyes */}
      <ellipse cx="43" cy="50" rx="2" ry="1.5" fill="#3a2818" />
      <ellipse cx="57" cy="50" rx="2" ry="1.5" fill="#3a2818" />
      {/* smile */}
      <path d="M44 62 Q50 66 56 62" stroke="#8a4a3a" strokeWidth="1.2" fill="none" />
      {/* small blush */}
      <ellipse cx="40" cy="58" rx="3" ry="1.5" fill="#c47a7a" opacity="0.4" />
      <ellipse cx="60" cy="58" rx="3" ry="1.5" fill="#c47a7a" opacity="0.4" />
      {void kind}
    </svg>
  );
}

// ---- Inventory ----
function InventoryPanel({ player, onClose, onEquip }: {
  player: { inventory: string[]; equipped: { weapon: string }; className: ClassKey; runes: number };
  onClose: () => void;
  onEquip: (k: string) => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
      <div className="relative w-[720px] max-h-[440px]" style={{
        background: "linear-gradient(to bottom, #1a1208 0%, #0d0806 100%)",
        border: "2px solid #c9a24a",
        boxShadow: "inset 0 0 30px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.9)",
      }}>
        <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-[color:var(--color-gold)]" />
        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-[color:var(--color-gold)]" />
        <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-[color:var(--color-gold)]" />
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-[color:var(--color-gold)]" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-[color:var(--color-gold)] text-2xl tracking-[0.25em]">INVENTÁRIO</h2>
            <button onClick={onClose} className="font-display text-[color:var(--color-parchment,#e8c98a)] hover:text-[color:var(--color-gold)] text-sm">[ESC] FECHAR</button>
          </div>
          <div className="text-xs font-body italic text-[color:var(--color-parchment,#e8c98a)]/70 mb-4">
            {CLASSES[player.className].name} · Runas: <span className="text-[color:var(--color-gold)]">{player.runes}</span>
          </div>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {Array.from({ length: 18 }).map((_, i) => {
              const key = player.inventory[i];
              const it = key ? ITEMS[key] : undefined;
              const equipped = it && it.key === player.equipped.weapon;
              return (
                <button key={i} disabled={!it}
                  onClick={() => it && it.kind === "weapon" && onEquip(it.key)}
                  className={`relative aspect-square flex items-center justify-center border ${equipped ? "border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10" : "border-[color:var(--color-gold)]/30 bg-black/50 hover:border-[color:var(--color-gold)]/70"}`}>
                  {it && <SlotIcon type={it.icon} flaskColor={it.key === "crimson_flask" ? "#c02628" : it.key === "cerulean_flask" ? "#2d5aa8" : undefined} />}
                  {equipped && <div className="absolute top-0.5 right-0.5 font-display text-[8px] text-[color:var(--color-gold)]">E</div>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[color:var(--color-gold)]/30 pt-3 text-xs font-body text-[color:var(--color-parchment,#e8c98a)]/80">
            Clique numa arma para equipá-la. Frascos são usados com R (HP) e F (FP).
          </div>
        </div>
      </div>
    </div>
  );
}
