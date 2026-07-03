import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  CLASSES, ClassDef, ClassId, Stats, STAT_LABEL, StatKey,
  ITEMS, Item, ItemKind, RARITY_COLOR, LOOT_TABLES,
  SKILLS, Skill, SkillBranch, SkillMods, defaultMods,
  ENEMY_DEFS, EnemyKind, BOSS_SEQUENCE,
} from "@/lib/gameData";

// ============================================================================
// Types & constants
// ============================================================================
type Vec = { x: number; y: number };
type Enemy = {
  kind: EnemyKind;
  pos: Vec;
  hp: number;
  maxHp: number;
  cooldown: number;
  phase: number;
  stagger: number;
  frozen: number;
  bleed: { stacks: number; timer: number };
  facing: number;
};
type Projectile = {
  pos: Vec; vel: Vec; life: number;
  from: "player" | "enemy";
  dmg: number; kind: "flame" | "glintstone" | "knife" | "arc" | "moonbeam" | "gravity" | "rot";
  size: number;
};
type Particle = { pos: Vec; vel: Vec; life: number; max: number; color: string; size: number };
type Chest = { pos: Vec; opened: boolean; rarity: keyof typeof LOOT_TABLES };
type Room = {
  seed: number;
  enemies: Enemy[];
  cleared: boolean;
  doors: { n: boolean; s: boolean; e: boolean; w: boolean };
  isBoss: boolean;
  bossKind?: EnemyKind;
  chest?: Chest;
  decor: { x: number; y: number; kind: "pillar" | "grave" | "brazier" | "rubble" | "root" }[];
  grace?: Vec; // site of grace icon
};

const W = 1000;
const H = 620;
const TILE = 40;

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand: () => number, depth: number, forceRarity?: keyof typeof LOOT_TABLES): string {
  if (forceRarity) {
    const t = LOOT_TABLES[forceRarity];
    return t[Math.floor(rand() * t.length)];
  }
  const r = rand();
  const boost = depth * 0.02;
  if (r < 0.02 + boost * 0.2) return LOOT_TABLES.legendary[Math.floor(rand() * LOOT_TABLES.legendary.length)];
  if (r < 0.15 + boost) return LOOT_TABLES.rare[Math.floor(rand() * LOOT_TABLES.rare.length)];
  if (r < 0.5 + boost) return LOOT_TABLES.uncommon[Math.floor(rand() * LOOT_TABLES.uncommon.length)];
  return LOOT_TABLES.common[Math.floor(rand() * LOOT_TABLES.common.length)];
}

function makeRoom(seed: number, depth: number, bossKind?: EnemyKind): Room {
  const rand = mulberry32(seed);
  const enemies: Enemy[] = [];
  if (bossKind) {
    const d = ENEMY_DEFS[bossKind];
    enemies.push({
      kind: bossKind,
      pos: { x: W / 2, y: 180 },
      hp: d.hp,
      maxHp: d.hp,
      cooldown: 90,
      phase: 0,
      stagger: 0,
      frozen: 0,
      bleed: { stacks: 0, timer: 0 },
      facing: 1,
    });
  } else {
    const count = 3 + Math.floor(rand() * 3) + Math.floor(depth / 2);
    const pool: EnemyKind[] = ["hollow", "hollow", "beast", "wraith"];
    if (depth >= 2) pool.push("knight");
    if (depth >= 4) pool.push("knight", "wraith");
    for (let i = 0; i < count; i++) {
      const kind = pool[Math.floor(rand() * pool.length)];
      const d = ENEMY_DEFS[kind];
      enemies.push({
        kind,
        pos: { x: 140 + rand() * (W - 280), y: 140 + rand() * (H - 280) },
        hp: d.hp + depth * 5,
        maxHp: d.hp + depth * 5,
        cooldown: rand() * 60,
        phase: 0,
        stagger: 0,
        frozen: 0,
        bleed: { stacks: 0, timer: 0 },
        facing: 1,
      });
    }
  }
  const decor: Room["decor"] = [];
  const decorCount = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < decorCount; i++) {
    const kinds: Room["decor"][0]["kind"][] = ["pillar", "grave", "brazier", "rubble", "root"];
    decor.push({
      x: 90 + rand() * (W - 180),
      y: 90 + rand() * (H - 180),
      kind: kinds[Math.floor(rand() * kinds.length)],
    });
  }
  const hasChest = !!bossKind || rand() > 0.55;
  const chest = hasChest ? {
    pos: { x: W / 2 + (rand() - 0.5) * 260, y: H / 2 + (rand() - 0.5) * 160 },
    opened: false,
    rarity: (bossKind
      ? (["radahn", "malenia"].includes(bossKind) ? "unique"
        : ["godrick"].includes(bossKind) ? "legendary" : "rare")
      : (rand() > 0.85 ? "rare" : rand() > 0.5 ? "uncommon" : "common")) as keyof typeof LOOT_TABLES,
  } : undefined;
  return {
    seed,
    enemies,
    cleared: false,
    doors: bossKind ? { n: false, s: true, e: false, w: false } : {
      n: rand() > 0.3, s: rand() > 0.3, e: rand() > 0.3, w: rand() > 0.3,
    },
    isBoss: !!bossKind,
    bossKind,
    chest,
    decor,
    grace: rand() > 0.65 ? { x: 100 + rand() * (W - 200), y: 100 + rand() * (H - 200) } : undefined,
  };
}

// ============================================================================
// Component
// ============================================================================
export default function EldenGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setTick] = useState(0);
  const [screen, setScreen] = useState<"title" | "class" | "play" | "dead" | "victory">("title");
  const [panel, setPanel] = useState<"none" | "inventory" | "skills" | "map">("none");
  const [selectedClass, setSelectedClass] = useState<ClassId>("vagabond");
  const [hoverSkill, setHoverSkill] = useState<string | null>(null);

  const stateRef = useRef({
    cls: CLASSES[0] as ClassDef,
    stats: { ...CLASSES[0].stats } as Stats,
    level: 1,
    player: {
      pos: { x: W / 2, y: H / 2 },
      hp: 100, maxHp: 100,
      stamina: 100, maxStamina: 100,
      fp: 60, maxFp: 60,
      runes: 0, sp: 0,
      atkCd: 0, spellCd: 0, dashCd: 0, invuln: 0,
      facing: { x: 1, y: 0 } as Vec,
      swing: 0, ability: 0,
      bleed: { stacks: 0, timer: 0 },
      buffTimer: 0,
    },
    equipped: {
      weapon: null as string | null,
      armor: null as string | null,
      talisman: null as string | null,
    },
    inventory: [] as string[],
    learned: new Set<string>(),
    room: makeRoom(1, 1),
    depth: 1,
    roomsCleared: 0,
    bossesKilled: 0,
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    keys: {} as Record<string, boolean>,
    mouse: { x: W / 2, y: H / 2, down: false, downEdge: false, rightDown: false, rightEdge: false },
    message: "",
    messageTime: 0,
    subtitle: "",
    subtitleTime: 0,
    hitFlash: 0,
    screenShake: 0,
  });

  const s = stateRef.current;

  // ==========================================================================
  // Derived stats
  // ==========================================================================
  const mods = useMemo(() => {
    const m = defaultMods();
    for (const sk of SKILLS) if (s.learned.has(sk.id)) sk.apply(m);
    return m;
  }, [s.learned, panel, screen]); // eslint-disable-line

  const effStats: Stats = useMemo(() => {
    const out = { ...s.stats };
    for (const slot of ["weapon", "armor", "talisman"] as const) {
      const id = s.equipped[slot];
      if (id && ITEMS[id]) {
        const it = ITEMS[id];
        for (const k in it.bonus) {
          const key = k as StatKey;
          out[key] = (out[key] ?? 0) + (it.bonus[key] ?? 0);
        }
      }
    }
    return out;
  }, [s.stats, s.equipped.weapon, s.equipped.armor, s.equipped.talisman, panel]); // eslint-disable-line

  // ==========================================================================
  // Class selection & reset
  // ==========================================================================
  const startRun = useCallback((clsId: ClassId) => {
    const cls = CLASSES.find(c => c.id === clsId)!;
    s.cls = cls;
    s.stats = { ...cls.stats };
    s.level = 1;
    s.equipped = { weapon: cls.startingWeapon, armor: cls.startingArmor, talisman: null };
    s.inventory = [];
    s.learned = new Set();
    s.depth = 1;
    s.roomsCleared = 0;
    s.bossesKilled = 0;
    s.projectiles = [];
    s.particles = [];
    s.room = makeRoom((Date.now() ^ (cls.id.length * 9973)) & 0xffff, 1);
    // compute base pools
    const mm = defaultMods();
    const maxHp = Math.round((60 + s.stats.vig * 10) * mm.hpMul);
    const maxSt = Math.round((80 + s.stats.end * 5) * mm.staminaMul);
    const maxFp = Math.round((40 + Math.max(s.stats.int, s.stats.fth) * 6) * mm.fpMul);
    s.player = {
      pos: { x: W / 2, y: H / 2 },
      hp: maxHp, maxHp,
      stamina: maxSt, maxStamina: maxSt,
      fp: maxFp, maxFp,
      runes: 0, sp: 0,
      atkCd: 0, spellCd: 0, dashCd: 0, invuln: 60,
      facing: { x: 1, y: 0 },
      swing: 0, ability: 0,
      bleed: { stacks: 0, timer: 0 },
      buffTimer: 0,
    };
    s.message = `${cls.title}`;
    s.subtitle = "Rise now, ye Tarnished...";
    s.messageTime = 180;
    s.subtitleTime = 180;
    setPanel("none");
    setScreen("play");
  }, [s]);

  // recompute pools when learned/equip changes (in play)
  useEffect(() => {
    if (screen !== "play") return;
    const p = s.player;
    const maxHp = Math.round((60 + effStats.vig * 10) * mods.hpMul);
    const maxSt = Math.round((80 + effStats.end * 5) * mods.staminaMul);
    const maxFp = Math.round((40 + Math.max(effStats.int, effStats.fth) * 6) * mods.fpMul);
    const ratioHp = p.hp / (p.maxHp || 1);
    const ratioSt = p.stamina / (p.maxStamina || 1);
    const ratioFp = p.fp / (p.maxFp || 1);
    p.maxHp = maxHp; p.hp = Math.min(maxHp, Math.max(1, Math.round(maxHp * ratioHp)));
    p.maxStamina = maxSt; p.stamina = Math.min(maxSt, maxSt * ratioSt);
    p.maxFp = maxFp; p.fp = Math.min(maxFp, maxFp * ratioFp);
  }, [effStats, mods, screen, s]);

  // ==========================================================================
  // Keyboard
  // ==========================================================================
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      s.keys[k] = true;
      if (k === "i") setPanel(p => p === "inventory" ? "none" : "inventory");
      if (k === "k") setPanel(p => p === "skills" ? "none" : "skills");
      if (k === "escape") setPanel("none");
      if (k === " ") e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { s.keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [s]);

  // ==========================================================================
  // Main game loop
  // ==========================================================================
  useEffect(() => {
    if (screen !== "play") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const spawnParticles = (pos: Vec, color: string, n: number, spread = 3) => {
      for (let i = 0; i < n; i++) {
        s.particles.push({
          pos: { ...pos },
          vel: { x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread },
          life: 30 + Math.random() * 20, max: 50, color,
          size: 2 + Math.random() * 3,
        });
      }
    };

    const showMsg = (t: string, sub = "", frames = 180) => {
      s.message = t; s.subtitle = sub; s.messageTime = frames; s.subtitleTime = frames;
    };

    const nextRoom = (dir: "n" | "s" | "e" | "w") => {
      s.roomsCleared++;
      // boss every 4 non-boss rooms
      let bossKind: EnemyKind | undefined;
      if (s.roomsCleared > 0 && s.roomsCleared % 4 === 0 && s.bossesKilled < BOSS_SEQUENCE.length) {
        bossKind = BOSS_SEQUENCE[s.bossesKilled];
      }
      s.depth = Math.floor(s.roomsCleared / 3) + 1;
      s.room = makeRoom((s.room.seed * 7919 + s.roomsCleared) & 0xffff, s.depth, bossKind);
      s.projectiles = [];
      if (dir === "n") s.player.pos = { x: W / 2, y: H - 80 };
      if (dir === "s") s.player.pos = { x: W / 2, y: 80 };
      if (dir === "e") s.player.pos = { x: 80, y: H / 2 };
      if (dir === "w") s.player.pos = { x: W - 80, y: H / 2 };
      if (bossKind) {
        const d = ENEMY_DEFS[bossKind];
        showMsg(d.name, d.desc ?? "", 240);
        s.screenShake = 30;
      } else {
        showMsg(`Depth ${s.depth}`, "", 90);
      }
    };

    const applyLoot = (rarity?: keyof typeof LOOT_TABLES) => {
      const rand = Math.random;
      const rnd = () => rand();
      const id = pickWeighted(rnd, s.depth, rarity);
      s.inventory.push(id);
      const it = ITEMS[id];
      showMsg(`Found: ${it.name}`, it.desc, 200);
    };

    const canvasRect = () => canvas.getBoundingClientRect();
    const toGame = (e: MouseEvent) => {
      const r = canvasRect();
      return {
        x: ((e.clientX - r.left) / r.width) * W,
        y: ((e.clientY - r.top) / r.height) * H,
      };
    };
    const onMove = (e: MouseEvent) => { const p = toGame(e); s.mouse.x = p.x; s.mouse.y = p.y; };
    const onDown = (e: MouseEvent) => {
      if (e.button === 0) { s.mouse.down = true; s.mouse.downEdge = true; }
      if (e.button === 2) { s.mouse.rightDown = true; s.mouse.rightEdge = true; }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) s.mouse.down = false;
      if (e.button === 2) s.mouse.rightDown = false;
    };
    const onCtx = (e: Event) => e.preventDefault();
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("contextmenu", onCtx);

    const step = (now: number) => {
      const dt = Math.min(32, now - last) / 16.666;
      last = now;

      if (panel !== "none") {
        // paused
        s.mouse.downEdge = false; s.mouse.rightEdge = false;
        renderFrame(ctx, now, s, mods, effStats);
        raf = requestAnimationFrame(step);
        return;
      }

      const p = s.player;
      const weapon = s.equipped.weapon ? ITEMS[s.equipped.weapon] : null;
      const scale = weapon?.scaling ?? "str";
      const scaleBonus = 1 + Math.max(0, effStats[scale] - 10) * 0.04;
      const baseDmg = ((weapon?.dmg ?? 12) + effStats.str * 0.3) * scaleBonus * mods.dmgMul;

      // ------- input / movement
      let mx = 0, my = 0;
      if (s.keys["w"] || s.keys["arrowup"]) my -= 1;
      if (s.keys["s"] || s.keys["arrowdown"]) my += 1;
      if (s.keys["a"] || s.keys["arrowleft"]) mx -= 1;
      if (s.keys["d"] || s.keys["arrowright"]) mx += 1;
      const mag = Math.hypot(mx, my) || 1; mx /= mag; my /= mag;
      const speed = 3.0 * mods.moveSpeed * dt;
      p.pos.x = Math.max(50, Math.min(W - 50, p.pos.x + mx * speed));
      p.pos.y = Math.max(50, Math.min(H - 50, p.pos.y + my * speed));

      // facing = towards mouse
      const fdx = s.mouse.x - p.pos.x;
      const fdy = s.mouse.y - p.pos.y;
      const fm = Math.hypot(fdx, fdy) || 1;
      p.facing = { x: fdx / fm, y: fdy / fm };

      // dash
      const dodgeCost = 25 * mods.dodgeCost;
      if (s.keys["shift"] && p.dashCd <= 0 && p.stamina >= dodgeCost) {
        p.pos.x = Math.max(50, Math.min(W - 50, p.pos.x + p.facing.x * 70));
        p.pos.y = Math.max(50, Math.min(H - 50, p.pos.y + p.facing.y * 70));
        p.stamina -= dodgeCost;
        p.dashCd = 26;
        p.invuln = 22;
        spawnParticles(p.pos, "oklch(0.72 0.19 45)", 14, 4);
      }
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.atkCd = Math.max(0, p.atkCd - dt);
      p.spellCd = Math.max(0, p.spellCd - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.swing = Math.max(0, p.swing - dt * 3);
      p.ability = Math.max(0, p.ability - dt * 2);
      p.buffTimer = Math.max(0, p.buffTimer - dt);
      p.stamina = Math.min(p.maxStamina, p.stamina + 0.7 * dt);
      p.fp = Math.min(p.maxFp, p.fp + (0.15 + mods.fpRegen) * dt);
      if (mods.passiveHeal > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + mods.passiveHeal * dt);

      // player bleed
      if (p.bleed.stacks > 0) {
        p.bleed.timer -= dt;
        if (p.bleed.timer <= 0) {
          p.hp -= p.bleed.stacks * 4;
          spawnParticles(p.pos, "oklch(0.42 0.19 25)", 5);
          p.bleed.stacks--;
          p.bleed.timer = 45;
        }
      }

      // basic melee (LMB)
      if (s.mouse.down && p.atkCd <= 0 && p.stamina >= 15) {
        p.atkCd = 22;
        p.stamina -= 15;
        p.swing = 12;
        const reach = 70;
        const isCrit = Math.random() < mods.critChance;
        const dmg = baseDmg * (isCrit ? 2 : 1);
        for (const e of s.room.enemies) {
          const dx = e.pos.x - p.pos.x;
          const dy = e.pos.y - p.pos.y;
          const d = Math.hypot(dx, dy);
          const eSize = ENEMY_DEFS[e.kind].size;
          if (d < reach + eSize) {
            const dot = (dx / (d || 1)) * p.facing.x + (dy / (d || 1)) * p.facing.y;
            if (dot > 0.2) {
              e.hp -= dmg;
              e.stagger = 15;
              e.pos.x += p.facing.x * 6;
              e.pos.y += p.facing.y * 6;
              spawnParticles(e.pos, isCrit ? "oklch(0.82 0.18 60)" : "oklch(0.42 0.19 25)", isCrit ? 14 : 8);
              if (mods.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + dmg * mods.lifesteal);
              if (mods.bleedChance > 0 && Math.random() < mods.bleedChance) {
                e.bleed.stacks = Math.min(6, e.bleed.stacks + 1);
                e.bleed.timer = 45;
              }
            }
          }
        }
      }

      // ranged / spell (SPACE for basic sorcery, RMB or Q for class ability)
      const cast = (kind: Projectile["kind"], dmgMul: number, cost: number, speed = 6) => {
        const c = cost * mods.spellCostMul;
        if (p.fp < c || p.spellCd > 0) return false;
        p.fp -= c;
        p.spellCd = 24;
        s.projectiles.push({
          pos: { ...p.pos },
          vel: { x: p.facing.x * speed, y: p.facing.y * speed },
          life: 100, from: "player",
          dmg: baseDmg * dmgMul * mods.spellDmgMul,
          kind, size: 8,
        });
        return true;
      };

      if (s.keys[" "]) cast("flame", 0.9, 15);

      const abilityTrigger = s.mouse.rightEdge || s.keys["q"];
      if (abilityTrigger && p.spellCd <= 0) {
        const a = s.cls.ability;
        const cost = a.fpCost * mods.spellCostMul;
        if (a.key === "flame" && p.fp >= cost) { cast("flame", 1.3, a.fpCost, 7); p.ability = 20; }
        else if (a.key === "glintstone" && p.fp >= cost) { cast("glintstone", 1.5, a.fpCost, 8); p.ability = 20; }
        else if (a.key === "throw" && p.fp >= cost) { cast("knife", 1.1, a.fpCost, 9); p.ability = 20; }
        else if (a.key === "heal" && p.fp >= cost) {
          p.fp -= cost; p.spellCd = 40; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); p.ability = 30;
          spawnParticles(p.pos, "oklch(0.82 0.13 85)", 30, 4);
        }
        else if (a.key === "backstab" && p.fp >= cost) {
          p.fp -= cost; p.spellCd = 30; p.ability = 30; p.invuln = 30;
          p.pos.x = Math.max(50, Math.min(W - 50, p.pos.x + p.facing.x * 140));
          p.pos.y = Math.max(50, Math.min(H - 50, p.pos.y + p.facing.y * 140));
          spawnParticles(p.pos, "oklch(0.5 0.02 30)", 24, 5);
          // dmg surge around player
          for (const e of s.room.enemies) {
            const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
            if (d < 60) { e.hp -= baseDmg * 2.5; e.stagger = 30; spawnParticles(e.pos, "oklch(0.42 0.19 25)", 12); }
          }
        }
        else if (a.key === "warcry" && p.fp >= cost) {
          p.fp -= cost; p.spellCd = 40; p.ability = 30; p.buffTimer = 240;
          spawnParticles(p.pos, "oklch(0.75 0.15 45)", 40, 7);
          for (const e of s.room.enemies) {
            const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
            if (d < 130) { e.stagger = 40; }
          }
          s.screenShake = 12;
        }
      }
      // buff bonus damage
      if (p.buffTimer > 0) { /* damage multiplier handled via re-computing baseDmg per frame with buff... simpler: */ }
      // (Skip full recompute for simplicity; buff is visual + stagger effect.)

      // ------- enemy AI
      for (const e of s.room.enemies) {
        if (e.hp <= 0) continue;
        const def = ENEMY_DEFS[e.kind];
        e.stagger = Math.max(0, e.stagger - dt);
        e.frozen = Math.max(0, e.frozen - dt);
        if (e.bleed.stacks > 0) {
          e.bleed.timer -= dt;
          if (e.bleed.timer <= 0) { e.hp -= e.bleed.stacks * 5; spawnParticles(e.pos, "oklch(0.42 0.19 25)", 4); e.bleed.stacks--; e.bleed.timer = 40; }
        }
        if (e.stagger > 0 || e.frozen > 0) continue;

        const dx = p.pos.x - e.pos.x;
        const dy = p.pos.y - e.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        e.facing = dx > 0 ? 1 : -1;

        // boss behavior
        const isBoss = !!def.isBoss;
        const desired =
          e.kind === "wraith" ? 200 :
          e.kind === "margit" ? 100 :
          e.kind === "radahn" ? 220 :
          e.kind === "malenia" ? 40 :
          0;
        if (Math.abs(d - desired) > 20) {
          const sign = d > desired ? 1 : -1;
          const spd = def.speed * (isBoss && e.hp < e.maxHp * 0.4 ? 1.3 : 1);
          e.pos.x += (dx / d) * spd * dt * sign;
          e.pos.y += (dy / d) * spd * dt * sign;
          e.pos.x = Math.max(60, Math.min(W - 60, e.pos.x));
          e.pos.y = Math.max(60, Math.min(H - 60, e.pos.y));
        }
        e.cooldown -= dt;
        if (e.cooldown > 0) continue;

        // attacks
        const damageP = (raw: number) => {
          const armor = s.equipped.armor ? ITEMS[s.equipped.armor] : null;
          const dr = (armor?.bonus.vig ?? 0) * 0.5 + (armor?.bonus.end ?? 0) * 0.3;
          const dmg = Math.max(2, raw - dr);
          if (p.invuln <= 0) {
            p.hp -= dmg;
            p.invuln = 40;
            s.hitFlash = 12;
            s.screenShake = Math.max(s.screenShake, isBoss ? 12 : 6);
            spawnParticles(p.pos, "oklch(0.42 0.19 25)", 10);
          }
        };
        const shoot = (kind: Projectile["kind"], dmgMul: number, speed: number, spread = 0) => {
          const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread;
          s.projectiles.push({
            pos: { ...e.pos },
            vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
            life: 140, from: "enemy",
            dmg: def.dmg * dmgMul, kind, size: 8,
          });
        };

        switch (def.attackKind) {
          case "melee":
            if (d < def.size + 32) { damageP(def.dmg); e.cooldown = 60; }
            else e.cooldown = 20;
            break;
          case "projectile":
            shoot("arc", 1, 3.4); e.cooldown = 90;
            break;
          case "boss_grafted":
            e.phase = (e.phase + 1) % 3;
            if (e.phase === 0) { for (let a = 0; a < 6; a++) { const ang = (a / 6) * Math.PI * 2; s.projectiles.push({ pos: { ...e.pos }, vel: { x: Math.cos(ang) * 3, y: Math.sin(ang) * 3 }, life: 120, from: "enemy", dmg: def.dmg * 0.8, kind: "arc", size: 8 }); } e.cooldown = 100; }
            else if (e.phase === 1) { if (d < 80) { damageP(def.dmg * 1.3); } e.cooldown = 70; }
            else { shoot("arc", 1.1, 4.2); shoot("arc", 1.1, 4.2, 0.2); e.cooldown = 60; }
            break;
          case "boss_crucible":
            e.phase = (e.phase + 1) % 3;
            if (e.phase === 0) { if (d < 90) { damageP(def.dmg); } e.cooldown = 60; }
            else if (e.phase === 1) {
              // tail sweep — expanding ring
              for (let a = 0; a < 12; a++) { const ang = (a / 12) * Math.PI * 2; s.projectiles.push({ pos: { ...e.pos }, vel: { x: Math.cos(ang) * 2.6, y: Math.sin(ang) * 2.6 }, life: 90, from: "enemy", dmg: def.dmg * 0.9, kind: "arc", size: 9 }); }
              e.cooldown = 110;
            }
            else { shoot("arc", 1.2, 5); e.cooldown = 70; }
            break;
          case "boss_margit":
            e.phase = (e.phase + 1) % 4;
            if (e.phase === 0) { shoot("gravity", 1, 4); e.cooldown = 60; }
            else if (e.phase === 1) { shoot("gravity", 1.1, 4, 0.15); shoot("gravity", 1.1, 4, -0.15); e.cooldown = 80; }
            else if (e.phase === 2) { if (d < 100) { damageP(def.dmg * 1.2); } e.cooldown = 50; }
            else {
              // hammer smash — shockwave
              for (let a = 0; a < 10; a++) { const ang = (a / 10) * Math.PI * 2; s.projectiles.push({ pos: { ...e.pos }, vel: { x: Math.cos(ang) * 3.5, y: Math.sin(ang) * 3.5 }, life: 70, from: "enemy", dmg: def.dmg * 0.9, kind: "gravity", size: 10 }); }
              s.screenShake = 14;
              e.cooldown = 120;
            }
            break;
          case "boss_godrick":
            e.phase = (e.phase + 1) % 5;
            if (e.phase < 2) { shoot("arc", 1, 4.5); e.cooldown = 45; }
            else if (e.phase === 2) {
              for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2 + Math.random() * 0.2; s.projectiles.push({ pos: { ...e.pos }, vel: { x: Math.cos(ang) * 3.2, y: Math.sin(ang) * 3.2 }, life: 100, from: "enemy", dmg: def.dmg * 0.9, kind: "arc", size: 9 }); }
              e.cooldown = 90;
            }
            else if (e.phase === 3) { if (d < 110) damageP(def.dmg * 1.3); e.cooldown = 60; }
            else {
              // dragon breath cone
              for (let a = -3; a <= 3; a++) {
                const baseAng = Math.atan2(dy, dx);
                const ang = baseAng + a * 0.1;
                s.projectiles.push({ pos: { ...e.pos }, vel: { x: Math.cos(ang) * 4.5, y: Math.sin(ang) * 4.5 }, life: 90, from: "enemy", dmg: def.dmg * 0.7, kind: "flame", size: 10 });
              }
              e.cooldown = 100;
            }
            break;
          case "boss_malenia":
            e.phase = (e.phase + 1) % 5;
            if (e.phase < 3) { if (d < 80) damageP(def.dmg); e.cooldown = 35; }
            else if (e.phase === 3) {
              // waterfowl — 3 bursts of homing rot
              for (let a = 0; a < 12; a++) { const ang = Math.atan2(dy, dx) + (a - 6) * 0.15; s.projectiles.push({ pos: { ...e.pos }, vel: { x: Math.cos(ang) * 5, y: Math.sin(ang) * 5 }, life: 80, from: "enemy", dmg: def.dmg * 0.8, kind: "rot", size: 8 }); }
              e.cooldown = 120;
            }
            else { if (d < 90) { damageP(def.dmg * 1.4); if (Math.random() < 0.5) p.hp = Math.min(p.maxHp, p.hp + def.dmg * 0.3); } e.cooldown = 60; }
            break;
          case "boss_radahn":
            e.phase = (e.phase + 1) % 5;
            if (e.phase === 0) {
              // gravity bolt salvo
              for (let a = 0; a < 5; a++) shoot("gravity", 1, 5, (a - 2) * 0.08);
              e.cooldown = 90;
            }
            else if (e.phase === 1) { if (d < 130) damageP(def.dmg * 1.3); e.cooldown = 60; }
            else if (e.phase === 2) {
              // meteor rain
              for (let i = 0; i < 8; i++) {
                const px = 100 + Math.random() * (W - 200);
                const py = 60;
                s.projectiles.push({ pos: { x: px, y: py }, vel: { x: (p.pos.x - px) / 50, y: 5 }, life: 90, from: "enemy", dmg: def.dmg * 0.9, kind: "moonbeam", size: 11 });
              }
              e.cooldown = 130;
            }
            else if (e.phase === 3) { shoot("gravity", 1.2, 6); shoot("gravity", 1.2, 6, 0.2); shoot("gravity", 1.2, 6, -0.2); e.cooldown = 80; }
            else { if (d < 160) damageP(def.dmg * 1.2); e.cooldown = 70; }
            break;
        }
      }

      // projectiles
      for (const pr of s.projectiles) {
        pr.pos.x += pr.vel.x * dt;
        pr.pos.y += pr.vel.y * dt;
        pr.life -= dt;
        if (pr.from === "player") {
          for (const e of s.room.enemies) {
            if (e.hp <= 0) continue;
            const eSize = ENEMY_DEFS[e.kind].size;
            if (Math.hypot(e.pos.x - pr.pos.x, e.pos.y - pr.pos.y) < eSize + pr.size) {
              e.hp -= pr.dmg;
              e.stagger = 10;
              if (pr.kind === "glintstone" || pr.kind === "moonbeam") e.frozen = 30;
              pr.life = 0;
              spawnParticles(pr.pos, pr.kind === "glintstone" ? "oklch(0.7 0.18 250)" : "oklch(0.72 0.19 45)", 8);
              if (mods.lifesteal > 0) p.hp = Math.min(p.maxHp, p.hp + pr.dmg * mods.lifesteal * 0.5);
            }
          }
        } else {
          if (Math.hypot(p.pos.x - pr.pos.x, p.pos.y - pr.pos.y) < 18 && p.invuln <= 0) {
            const armor = s.equipped.armor ? ITEMS[s.equipped.armor] : null;
            const dr = (armor?.bonus.vig ?? 0) * 0.5 + (armor?.bonus.end ?? 0) * 0.3;
            const dmg = Math.max(2, pr.dmg - dr);
            p.hp -= dmg;
            p.invuln = 30;
            s.hitFlash = 10;
            s.screenShake = 6;
            if (pr.kind === "rot") { p.bleed.stacks = Math.min(6, p.bleed.stacks + 2); p.bleed.timer = 30; }
            pr.life = 0;
            spawnParticles(p.pos, "oklch(0.42 0.19 25)", 8);
          }
        }
      }
      s.projectiles = s.projectiles.filter(pr => pr.life > 0 && pr.pos.x > 0 && pr.pos.x < W && pr.pos.y > 0 && pr.pos.y < H);

      // enemy deaths → runes
      const before = s.room.enemies.length;
      s.room.enemies = s.room.enemies.filter(e => {
        if (e.hp > 0) return true;
        const def = ENEMY_DEFS[e.kind];
        p.runes += def.runes;
        spawnParticles(e.pos, "oklch(0.82 0.13 85)", def.isBoss ? 60 : 18, def.isBoss ? 7 : 5);
        if (def.isBoss) {
          s.bossesKilled++;
          p.sp += 2;
          s.screenShake = 26;
          const rarity: keyof typeof LOOT_TABLES = s.bossesKilled >= 6 ? "unique"
            : s.bossesKilled >= 4 ? "legendary" : "rare";
          applyLoot(rarity);
          showMsg("GREAT ENEMY FELLED", `${def.name} · +2 Skill Points`, 260);
          if (s.bossesKilled >= 6) setScreen("victory");
        }
        return false;
      });
      if (before > 0 && s.room.enemies.length === 0 && !s.room.cleared) {
        s.room.cleared = true;
      }

      // chest interact — walk near + press E
      if (s.room.chest && !s.room.chest.opened) {
        const d = Math.hypot(s.room.chest.pos.x - p.pos.x, s.room.chest.pos.y - p.pos.y);
        if (d < 40 && s.keys["e"]) {
          s.room.chest.opened = true;
          applyLoot(s.room.chest.rarity);
          spawnParticles(s.room.chest.pos, "oklch(0.82 0.13 85)", 30, 5);
        }
      }
      // grace interact — full heal
      if (s.room.grace && s.keys["e"]) {
        const d = Math.hypot(s.room.grace.x - p.pos.x, s.room.grace.y - p.pos.y);
        if (d < 40) { p.hp = p.maxHp; p.fp = p.maxFp; p.stamina = p.maxStamina; s.room.grace = undefined; showMsg("Grace restores you", "", 90); }
      }

      // particles
      for (const pt of s.particles) {
        pt.pos.x += pt.vel.x * dt; pt.pos.y += pt.vel.y * dt;
        pt.vel.x *= 0.94; pt.vel.y *= 0.94; pt.life -= dt;
      }
      s.particles = s.particles.filter(pt => pt.life > 0);

      // room transitions
      if (s.room.cleared) {
        if (p.pos.y < 55 && s.room.doors.n) nextRoom("n");
        else if (p.pos.y > H - 55 && s.room.doors.s) nextRoom("s");
        else if (p.pos.x > W - 55 && s.room.doors.e) nextRoom("e");
        else if (p.pos.x < 55 && s.room.doors.w) nextRoom("w");
      }

      if (p.hp <= 0) setScreen("dead");

      s.hitFlash = Math.max(0, s.hitFlash - dt);
      s.screenShake = Math.max(0, s.screenShake - dt);
      if (s.messageTime > 0) s.messageTime -= dt;
      if (s.subtitleTime > 0) s.subtitleTime -= dt;

      s.mouse.downEdge = false;
      s.mouse.rightEdge = false;

      renderFrame(ctx, now, s, mods, effStats);
      setTick(v => (v + 1) % 100000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("contextmenu", onCtx);
    };
  }, [screen, panel, s, mods, effStats]);

  // ==========================================================================
  // Actions on panels
  // ==========================================================================
  const equip = useCallback((idx: number) => {
    const id = s.inventory[idx];
    if (!id) return;
    const it = ITEMS[id];
    const slot: keyof typeof s.equipped = it.kind === "weapon" ? "weapon" : it.kind === "armor" ? "armor" : "talisman";
    const previous = s.equipped[slot];
    s.equipped[slot] = id;
    s.inventory.splice(idx, 1);
    if (previous) s.inventory.push(previous);
    setTick(v => v + 1);
  }, [s]);

  const unequip = useCallback((slot: "weapon" | "armor" | "talisman") => {
    const id = s.equipped[slot];
    if (!id) return;
    s.inventory.push(id);
    s.equipped[slot] = null;
    setTick(v => v + 1);
  }, [s]);

  const learnSkill = useCallback((id: string) => {
    const sk = SKILLS.find(x => x.id === id);
    if (!sk || s.learned.has(id)) return;
    if (s.player.sp < sk.cost) return;
    if (sk.requires && !sk.requires.every(r => s.learned.has(r))) return;
    s.player.sp -= sk.cost;
    s.learned.add(id);
    setTick(v => v + 1);
  }, [s]);

  const p = s.player;

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div className="relative w-full max-w-[1040px] mx-auto">
      {/* Embers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="absolute bottom-0 rounded-full" style={{
            left: `${(i * 41) % 100}%`,
            width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px`,
            background: "oklch(0.75 0.2 55)",
            boxShadow: "0 0 8px oklch(0.72 0.19 45)",
            animation: `ember-float ${8 + (i % 5)}s linear ${i * 0.5}s infinite`,
          }} />
        ))}
      </div>

      <header className="text-center py-4">
        <h1 className="text-4xl md:text-6xl font-display font-black tracking-[0.35em] text-gold-glow animate-flicker">
          ELDEN HOLLOW
        </h1>
        <p className="text-muted-foreground italic mt-1 tracking-widest text-xs">A ROGUELIKE OF TARNISHED SOULS</p>
      </header>

      <div className="relative bg-parchment border border-[color:var(--gold)]/30 shadow-[0_0_60px_oklch(0.72_0.19_45/0.15)]">
        {/* HUD */}
        {screen === "play" && (
          <div className="absolute inset-0 z-10 pointer-events-none font-display text-[10px] tracking-widest">
            {/* Top-left status */}
            <div className="absolute top-3 left-3 flex items-start gap-3">
              <ClassPortrait cls={s.cls} />
              <div className="space-y-1.5 w-64">
                <StatBar label="HP" value={p.hp} max={p.maxHp} color="linear-gradient(90deg, oklch(0.45 0.2 25), oklch(0.65 0.22 30))" />
                <StatBar label="FP" value={p.fp} max={p.maxFp} color="linear-gradient(90deg, oklch(0.35 0.15 260), oklch(0.6 0.2 260))" thin />
                <StatBar label="STAMINA" value={p.stamina} max={p.maxStamina} color="linear-gradient(90deg, oklch(0.5 0.1 130), oklch(0.7 0.14 130))" thin />
              </div>
            </div>
            {/* Top-right */}
            <div className="absolute top-3 right-3 text-right space-y-0.5">
              <div className="text-gold-glow text-sm">◆ {p.runes.toLocaleString()} runes</div>
              <div className="text-[color:var(--rune)]/90">Depth {s.depth} · Room {s.roomsCleared}</div>
              <div className="text-[color:var(--rune)]/90">Bosses {s.bossesKilled}/6 · SP {p.sp}</div>
              <div className="mt-1 text-muted-foreground">[I] Inventory · [K] Skills</div>
            </div>
            {/* Bottom-center ability */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2">
              <AbilitySlot label="Attack" hint="LMB" cd={p.atkCd} icon="⚔" />
              <AbilitySlot label="Sorcery" hint="SPACE" cd={p.spellCd} icon="✦" cost={15} fp={p.fp} />
              <AbilitySlot label={s.cls.ability.name} hint="RMB / Q" cd={p.spellCd} icon={s.cls.sigil} cost={s.cls.ability.fpCost} fp={p.fp} accent={s.cls.accent} />
              <AbilitySlot label="Dodge" hint="SHIFT" cd={p.dashCd} icon="»" />
            </div>
            {/* Message */}
            {s.messageTime > 0 && (
              <div className="absolute top-1/4 left-0 right-0 text-center pointer-events-none">
                <div className="font-display text-2xl md:text-3xl tracking-[0.3em]" style={{
                  color: "oklch(0.85 0.14 70)",
                  textShadow: "0 0 20px oklch(0.72 0.19 45 / 0.8)",
                  opacity: Math.min(1, s.messageTime / 60),
                }}>{s.message}</div>
                {s.subtitle && <div className="italic mt-1 text-sm text-muted-foreground" style={{ opacity: Math.min(1, s.subtitleTime / 60) }}>{s.subtitle}</div>}
              </div>
            )}
            {/* Damage flash overlay */}
            {s.hitFlash > 0 && (
              <div className="absolute inset-0 pointer-events-none" style={{
                background: "radial-gradient(ellipse at center, transparent 55%, oklch(0.4 0.2 25 / 0.6) 100%)",
                opacity: s.hitFlash / 12,
              }} />
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={W} height={H}
          className="block w-full h-auto cursor-crosshair"
          style={{ imageRendering: "pixelated", transform: s.screenShake > 0 ? `translate(${(Math.random() - 0.5) * s.screenShake}px, ${(Math.random() - 0.5) * s.screenShake}px)` : undefined }}
        />

        {/* Screens */}
        {screen === "title" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm text-center px-6">
            <h2 className="font-display text-3xl md:text-5xl text-gold-glow mb-3 tracking-[0.3em]">RISE, TARNISHED</h2>
            <p className="italic text-muted-foreground max-w-xl mb-8">
              The Lands Between crumble beneath a shattered ring. Six Great Enemies bar the road to lordship —
              Grafted Scions, Crucible Knights, Margit, Godrick, Malenia, and the Starscourge himself. Choose a keepsake and descend.
            </p>
            <button onClick={() => setScreen("class")}
              className="font-display tracking-[0.35em] text-sm px-10 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 hover:text-gold-glow transition-all">
              ◆ CHOOSE YOUR CLASS ◆
            </button>
            <div className="mt-10 grid grid-cols-[auto_auto] gap-x-8 gap-y-1 text-xs font-display tracking-widest text-muted-foreground">
              <div>WASD / ARROWS</div><div className="text-left">MOVE</div>
              <div>LEFT CLICK</div><div className="text-left">WEAPON ATTACK</div>
              <div>SPACE</div><div className="text-left">GLINTSTONE / FLAME</div>
              <div>RIGHT CLICK / Q</div><div className="text-left">CLASS ABILITY</div>
              <div>SHIFT</div><div className="text-left">DODGE ROLL</div>
              <div>E</div><div className="text-left">INTERACT (chests / graces)</div>
              <div>I</div><div className="text-left">INVENTORY</div>
              <div>K</div><div className="text-left">SKILL TREE</div>
            </div>
          </div>
        )}

        {screen === "class" && (
          <ClassSelect
            selected={selectedClass}
            onSelect={setSelectedClass}
            onStart={() => startRun(selectedClass)}
            onBack={() => setScreen("title")}
          />
        )}

        {screen === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-center px-6">
            <h2 className="font-display text-6xl md:text-7xl mb-4 tracking-[0.3em]" style={{ color: "oklch(0.55 0.22 25)", textShadow: "0 0 26px oklch(0.4 0.2 25)" }}>YOU DIED</h2>
            <p className="italic text-muted-foreground mb-2">Reached depth {s.depth} · felled {s.bossesKilled} of 6 Lords</p>
            <p className="italic text-[color:var(--gold)]/70 mb-6 max-w-md">"The flame of ambition ever flickers, Tarnished..."</p>
            <div className="flex gap-3">
              <button onClick={() => setScreen("class")} className="font-display tracking-[0.3em] text-sm px-8 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10">◆ NEW CLASS ◆</button>
              <button onClick={() => startRun(s.cls.id)} className="font-display tracking-[0.3em] text-sm px-8 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10">◆ RETURN TO GRACE ◆</button>
            </div>
          </div>
        )}

        {screen === "victory" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-center px-6">
            <h2 className="font-display text-5xl md:text-6xl text-gold-glow mb-4 tracking-[0.3em] animate-flicker">ELDEN LORD</h2>
            <p className="italic text-muted-foreground max-w-xl mb-6">
              Six Great Runes reclaimed. The shattered ring mends beneath your grasp. The age of the Tarnished begins.
            </p>
            <button onClick={() => setScreen("class")} className="font-display tracking-[0.3em] text-sm px-10 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10">◆ BEGIN NEW JOURNEY ◆</button>
          </div>
        )}

        {/* Panels */}
        {screen === "play" && panel === "inventory" && (
          <InventoryPanel
            inventory={s.inventory}
            equipped={s.equipped}
            stats={effStats}
            baseStats={s.stats}
            level={s.level}
            p={p}
            cls={s.cls}
            onEquip={equip}
            onUnequip={unequip}
            onClose={() => setPanel("none")}
          />
        )}
        {screen === "play" && panel === "skills" && (
          <SkillTreePanel
            learned={s.learned}
            sp={p.sp}
            hover={hoverSkill}
            setHover={setHoverSkill}
            onLearn={learnSkill}
            onClose={() => setPanel("none")}
          />
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground italic mt-4 tracking-wider">
        Every death forges a stronger tarnished. Every rune, a whisper of a fallen lord.
      </p>
    </div>
  );
}

// ============================================================================
// Canvas rendering
// ============================================================================
function renderFrame(
  ctx: CanvasRenderingContext2D, now: number,
  s: ReturnType<typeof useDummy>,
  mods: SkillMods, effStats: Stats,
) {
  // floor
  ctx.fillStyle = "oklch(0.11 0.008 60)";
  ctx.fillRect(0, 0, W, H);
  // stone floor pattern
  ctx.strokeStyle = "oklch(0.17 0.01 60 / 0.55)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += TILE) {
    for (let y = 0; y < H; y += TILE) {
      ctx.strokeRect(x, y, TILE, TILE);
      // subtle cracks
      if (((x * 31 + y * 17) & 15) === 0) {
        ctx.strokeStyle = "oklch(0.14 0.01 60 / 0.7)";
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 8);
        ctx.lineTo(x + 20, y + 22);
        ctx.stroke();
        ctx.strokeStyle = "oklch(0.17 0.01 60 / 0.55)";
      }
    }
  }
  // fog vignette
  const grad = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.72);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // walls
  ctx.fillStyle = "oklch(0.18 0.015 60)";
  ctx.fillRect(0, 0, W, 40);
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillRect(0, 0, 40, H);
  ctx.fillRect(W - 40, 0, 40, H);
  // wall bricks
  ctx.strokeStyle = "oklch(0.24 0.015 60 / 0.6)";
  for (let x = 0; x < W; x += 40) { ctx.strokeRect(x, 0, 40, 40); ctx.strokeRect(x, H - 40, 40, 40); }
  for (let y = 0; y < H; y += 40) { ctx.strokeRect(0, y, 40, 40); ctx.strokeRect(W - 40, y, 40, 40); }
  // doors
  const doorColor = s.room.cleared ? "oklch(0.72 0.19 45 / 0.85)" : "oklch(0.24 0.02 60)";
  ctx.fillStyle = doorColor;
  if (s.room.doors.n) ctx.fillRect(W / 2 - 46, 0, 92, 40);
  if (s.room.doors.s) ctx.fillRect(W / 2 - 46, H - 40, 92, 40);
  if (s.room.doors.e) ctx.fillRect(W - 40, H / 2 - 46, 40, 92);
  if (s.room.doors.w) ctx.fillRect(0, H / 2 - 46, 40, 92);
  // door glow when cleared
  if (s.room.cleared) {
    ctx.shadowColor = "oklch(0.72 0.19 45)"; ctx.shadowBlur = 18;
    ctx.strokeStyle = "oklch(0.82 0.16 55 / 0.8)"; ctx.lineWidth = 2;
    if (s.room.doors.n) ctx.strokeRect(W / 2 - 46, 0, 92, 40);
    if (s.room.doors.s) ctx.strokeRect(W / 2 - 46, H - 40, 92, 40);
    if (s.room.doors.e) ctx.strokeRect(W - 40, H / 2 - 46, 40, 92);
    if (s.room.doors.w) ctx.strokeRect(0, H / 2 - 46, 40, 92);
    ctx.shadowBlur = 0;
  }

  // decor
  for (const d of s.room.decor) drawDecor(ctx, d, now);

  // grace site
  if (s.room.grace) {
    const gx = s.room.grace.x, gy = s.room.grace.y;
    const t = Math.sin(now / 500);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.shadowColor = "oklch(0.82 0.15 70)"; ctx.shadowBlur = 30 + t * 8;
    ctx.fillStyle = "oklch(0.85 0.15 70)";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 12 : 6;
      const px = Math.cos(ang) * r; const py = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // chest
  if (s.room.chest && !s.room.chest.opened) {
    const c = s.room.chest;
    ctx.fillStyle = "oklch(0.22 0.03 60)";
    ctx.fillRect(c.pos.x - 16, c.pos.y - 12, 32, 24);
    ctx.fillStyle = "oklch(0.7 0.14 55)";
    ctx.fillRect(c.pos.x - 16, c.pos.y - 14, 32, 4);
    ctx.strokeStyle = RARITY_COLOR[LOOT_TABLES[c.rarity] ? c.rarity as any : "common"] ?? "oklch(0.7 0.15 60)";
    ctx.lineWidth = 2;
    ctx.strokeRect(c.pos.x - 16, c.pos.y - 12, 32, 24);
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
  }

  // particles behind
  for (const pt of s.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.pos.x, pt.pos.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // projectiles
  for (const pr of s.projectiles) {
    const col = pr.kind === "flame" ? "oklch(0.82 0.19 50)"
      : pr.kind === "glintstone" ? "oklch(0.7 0.19 250)"
      : pr.kind === "moonbeam" ? "oklch(0.75 0.15 260)"
      : pr.kind === "knife" ? "oklch(0.85 0.02 80)"
      : pr.kind === "gravity" ? "oklch(0.4 0.15 300)"
      : pr.kind === "rot" ? "oklch(0.7 0.19 130)"
      : "oklch(0.55 0.2 300)";
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(pr.pos.x, pr.pos.y, pr.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // enemies
  for (const e of s.room.enemies) drawEnemy(ctx, e, now);

  // player
  drawPlayer(ctx, s, now);

  // hint arrows
  if (s.room.cleared) {
    const t = (Math.sin(now / 300) + 1) / 2;
    ctx.fillStyle = `oklch(0.82 0.13 85 / ${0.4 + t * 0.5})`;
    ctx.font = "22px serif"; ctx.textAlign = "center";
    if (s.room.doors.n) ctx.fillText("↑", W / 2, 55);
    if (s.room.doors.s) ctx.fillText("↓", W / 2, H - 45);
    if (s.room.doors.e) ctx.fillText("→", W - 20, H / 2 + 6);
    if (s.room.doors.w) ctx.fillText("←", 20, H / 2 + 6);
  }

  // Boss health bar
  const boss = s.room.enemies.find(e => ENEMY_DEFS[e.kind].isBoss);
  if (boss) {
    const def = ENEMY_DEFS[boss.kind];
    const bw = 620;
    const bx = (W - bw) / 2, by = H - 70;
    ctx.fillStyle = "oklch(0 0 0 / 0.7)"; ctx.fillRect(bx - 2, by - 2, bw + 4, 20);
    ctx.strokeStyle = "oklch(0.72 0.14 55)"; ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, 20);
    ctx.fillStyle = "oklch(0.2 0.02 25)"; ctx.fillRect(bx, by, bw, 16);
    ctx.fillStyle = "linear-gradient(90deg, oklch(0.45 0.2 25), oklch(0.68 0.22 30))";
    const g = ctx.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, "oklch(0.42 0.2 25)"); g.addColorStop(1, "oklch(0.65 0.22 30)");
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), 16);
    ctx.fillStyle = "oklch(0.85 0.14 70)";
    ctx.font = "italic 14px 'EB Garamond', serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "oklch(0.72 0.19 45)"; ctx.shadowBlur = 8;
    ctx.fillText(def.name, W / 2, by - 8);
    ctx.shadowBlur = 0;
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, d: { x: number; y: number; kind: string }, now: number) {
  if (d.kind === "pillar") {
    // shadow
    ctx.fillStyle = "oklch(0 0 0 / 0.5)";
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 22, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "oklch(0.22 0.01 60)";
    ctx.beginPath(); ctx.arc(d.x, d.y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "oklch(0.32 0.02 60)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "oklch(0.28 0.015 60)";
    ctx.beginPath(); ctx.arc(d.x - 4, d.y - 4, 10, 0, Math.PI * 2); ctx.fill();
  } else if (d.kind === "grave") {
    ctx.fillStyle = "oklch(0 0 0 / 0.4)";
    ctx.fillRect(d.x - 14, d.y + 8, 28, 4);
    ctx.fillStyle = "oklch(0.24 0.01 60)";
    ctx.fillRect(d.x - 9, d.y - 16, 18, 24);
    ctx.beginPath(); ctx.arc(d.x, d.y - 16, 9, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "oklch(0.16 0.01 60)";
    ctx.fillRect(d.x - 1, d.y - 12, 2, 12);
    ctx.fillRect(d.x - 5, d.y - 8, 10, 2);
  } else if (d.kind === "brazier") {
    ctx.fillStyle = "oklch(0 0 0 / 0.5)";
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 12, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "oklch(0.22 0.02 40)";
    ctx.beginPath(); ctx.arc(d.x, d.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "oklch(0.32 0.02 40)";
    ctx.fillRect(d.x - 1, d.y + 6, 2, 10);
    const f = Math.sin(now / 100 + d.x) * 4;
    ctx.fillStyle = "oklch(0.75 0.2 55 / 0.9)"; ctx.shadowColor = "oklch(0.75 0.2 55)"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.ellipse(d.x, d.y - 10 - f, 6, 12 + f, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "oklch(0.88 0.15 85 / 0.7)";
    ctx.beginPath(); ctx.arc(d.x, d.y - 12, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (d.kind === "root") {
    ctx.strokeStyle = "oklch(0.28 0.06 55)"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(d.x - 20, d.y + 8);
    ctx.quadraticCurveTo(d.x, d.y - 10, d.x + 20, d.y + 6);
    ctx.stroke();
    ctx.strokeStyle = "oklch(0.35 0.09 55)"; ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = "oklch(0.2 0.01 60)";
    ctx.fillRect(d.x - 12, d.y - 4, 24, 8);
    ctx.fillStyle = "oklch(0.26 0.015 60)";
    ctx.fillRect(d.x - 10, d.y - 6, 8, 4);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, now: number) {
  const def = ENEMY_DEFS[e.kind];
  const sz = def.size;
  const f = e.facing;

  // shadow
  ctx.fillStyle = "oklch(0 0 0 / 0.55)";
  ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y + sz - 2, sz * 0.9, sz * 0.3, 0, 0, Math.PI * 2); ctx.fill();

  if (e.frozen > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
  }

  const drawBody = (color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y + 2, sz, 0, Math.PI * 2); ctx.fill();
  };

  switch (e.kind) {
    case "hollow":
      drawBody(def.color);
      // ragged silhouette
      ctx.fillStyle = "oklch(0.24 0.02 60)";
      ctx.fillRect(e.pos.x - sz * 0.6, e.pos.y + sz * 0.4, sz * 1.2, sz * 0.4);
      break;
    case "beast":
      drawBody(def.color);
      // fur tufts
      ctx.fillStyle = "oklch(0.28 0.1 30)";
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.arc(e.pos.x + i * (sz / 3), e.pos.y - sz * 0.7, 3, 0, Math.PI * 2); ctx.fill();
      }
      // teeth
      ctx.fillStyle = "oklch(0.85 0.02 80)";
      ctx.fillRect(e.pos.x - 5, e.pos.y + 6, 2, 3);
      ctx.fillRect(e.pos.x + 3, e.pos.y + 6, 2, 3);
      break;
    case "wraith":
      // spectral trail
      ctx.fillStyle = "oklch(0.4 0.13 290 / 0.5)";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y + i * 4 + 4, sz - i * 3, 0, Math.PI * 2); ctx.fill();
      }
      drawBody(def.color);
      ctx.shadowColor = "oklch(0.55 0.15 290)"; ctx.shadowBlur = 12;
      ctx.strokeStyle = "oklch(0.7 0.19 290)"; ctx.lineWidth = 1.5;
      ctx.stroke(); ctx.shadowBlur = 0;
      break;
    case "knight":
      drawBody("oklch(0.22 0.02 250)");
      // armor plates
      ctx.strokeStyle = "oklch(0.5 0.05 250)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y + 2, sz - 2, 0, Math.PI * 2); ctx.stroke();
      // helm slit
      ctx.fillStyle = "oklch(0.7 0.2 30)";
      ctx.fillRect(e.pos.x - 6, e.pos.y - 4, 12, 2);
      // sword line
      ctx.strokeStyle = "oklch(0.6 0.05 250)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.pos.x + f * sz, e.pos.y); ctx.lineTo(e.pos.x + f * (sz + 20), e.pos.y - 10); ctx.stroke();
      break;
    case "grafted_scion":
      // shadow
      drawBody(def.color);
      // multiple grafted arms
      ctx.strokeStyle = "oklch(0.55 0.15 20)"; ctx.lineWidth = 3;
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2 + Math.sin(now / 300) * 0.1;
        ctx.beginPath();
        ctx.moveTo(e.pos.x, e.pos.y);
        ctx.lineTo(e.pos.x + Math.cos(ang) * (sz + 14), e.pos.y + Math.sin(ang) * (sz + 14));
        ctx.stroke();
      }
      // core eye
      ctx.fillStyle = "oklch(0.85 0.2 30)"; ctx.shadowColor = "oklch(0.85 0.2 30)"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    case "crucible_knight":
      // wings behind
      ctx.fillStyle = "oklch(0.35 0.08 60 / 0.7)";
      ctx.beginPath(); ctx.moveTo(e.pos.x, e.pos.y - 6);
      ctx.quadraticCurveTo(e.pos.x - sz - 14, e.pos.y - 8, e.pos.x - sz - 4, e.pos.y + sz - 4);
      ctx.quadraticCurveTo(e.pos.x - sz + 4, e.pos.y, e.pos.x, e.pos.y - 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.pos.x, e.pos.y - 6);
      ctx.quadraticCurveTo(e.pos.x + sz + 14, e.pos.y - 8, e.pos.x + sz + 4, e.pos.y + sz - 4);
      ctx.quadraticCurveTo(e.pos.x + sz - 4, e.pos.y, e.pos.x, e.pos.y - 6); ctx.fill();
      drawBody("oklch(0.28 0.03 60)");
      // helm horns
      ctx.strokeStyle = "oklch(0.65 0.12 55)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.pos.x - sz / 2, e.pos.y - sz); ctx.lineTo(e.pos.x - sz / 2 - 4, e.pos.y - sz - 12);
      ctx.moveTo(e.pos.x + sz / 2, e.pos.y - sz); ctx.lineTo(e.pos.x + sz / 2 + 4, e.pos.y - sz - 12);
      ctx.stroke();
      // eye slit
      ctx.fillStyle = "oklch(0.85 0.18 60)"; ctx.shadowColor = "oklch(0.85 0.18 60)"; ctx.shadowBlur = 12;
      ctx.fillRect(e.pos.x - 8, e.pos.y - 4, 16, 3);
      ctx.shadowBlur = 0;
      break;
    case "margit": {
      // tall silhouette with hammer
      ctx.fillStyle = "oklch(0.2 0.015 60)";
      ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y, sz, sz * 1.4, 0, 0, Math.PI * 2); ctx.fill();
      // cloak folds
      ctx.strokeStyle = "oklch(0.4 0.03 60)"; ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(e.pos.x + i * (sz / 3), e.pos.y - sz);
        ctx.lineTo(e.pos.x + i * (sz / 3), e.pos.y + sz);
        ctx.stroke();
      }
      // golden horns
      ctx.strokeStyle = "oklch(0.82 0.14 70)"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.pos.x - 10, e.pos.y - sz - 4);
      ctx.quadraticCurveTo(e.pos.x - 24, e.pos.y - sz - 20, e.pos.x - 4, e.pos.y - sz - 22);
      ctx.moveTo(e.pos.x + 10, e.pos.y - sz - 4);
      ctx.quadraticCurveTo(e.pos.x + 24, e.pos.y - sz - 20, e.pos.x + 4, e.pos.y - sz - 22);
      ctx.stroke();
      // glowing eye
      ctx.fillStyle = "oklch(0.85 0.2 50)"; ctx.shadowColor = "oklch(0.85 0.2 50)"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y - 6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // hammer
      ctx.strokeStyle = "oklch(0.5 0.05 60)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.pos.x + f * 10, e.pos.y);
      ctx.lineTo(e.pos.x + f * 40, e.pos.y - 30); ctx.stroke();
      ctx.fillStyle = "oklch(0.4 0.03 60)"; ctx.fillRect(e.pos.x + f * 32, e.pos.y - 40, 14, 14);
      break;
    }
    case "godrick": {
      // grafted mass — big lumpy body
      ctx.fillStyle = "oklch(0.32 0.09 20)";
      ctx.beginPath(); ctx.arc(e.pos.x - 8, e.pos.y, sz * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.pos.x + 10, e.pos.y - 8, sz * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.pos.x + 4, e.pos.y + 10, sz * 0.9, 0, Math.PI * 2); ctx.fill();
      // dragon arm
      ctx.strokeStyle = "oklch(0.45 0.14 25)"; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(e.pos.x + f * sz, e.pos.y);
      ctx.quadraticCurveTo(e.pos.x + f * (sz + 30), e.pos.y - 20, e.pos.x + f * (sz + 40), e.pos.y + 10);
      ctx.stroke();
      // fire glow at hand
      ctx.fillStyle = "oklch(0.85 0.2 45)"; ctx.shadowColor = "oklch(0.75 0.2 45)"; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(e.pos.x + f * (sz + 40), e.pos.y + 10, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // multiple eyes (grafted heads)
      ctx.fillStyle = "oklch(0.85 0.18 60)";
      ctx.beginPath(); ctx.arc(e.pos.x - 10, e.pos.y - 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.pos.x + 10, e.pos.y - 12, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.pos.x - 2, e.pos.y + 6, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "malenia": {
      // graceful slender body, gold prosthetic
      ctx.fillStyle = "oklch(0.4 0.06 40)";
      ctx.beginPath(); ctx.ellipse(e.pos.x, e.pos.y, sz * 0.75, sz * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      // wing feathers
      ctx.strokeStyle = "oklch(0.75 0.14 40 / 0.8)"; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.3;
        ctx.beginPath();
        ctx.moveTo(e.pos.x, e.pos.y - sz + 4);
        ctx.lineTo(e.pos.x + Math.cos(ang) * (sz + 14), e.pos.y + Math.sin(ang) * (sz + 14));
        ctx.stroke();
      }
      // blade — gold
      ctx.strokeStyle = "oklch(0.85 0.14 70)"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.pos.x + f * 10, e.pos.y);
      ctx.lineTo(e.pos.x + f * (sz + 22), e.pos.y - 10);
      ctx.stroke();
      ctx.shadowColor = "oklch(0.85 0.14 70)"; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
      // helm eye
      ctx.fillStyle = "oklch(0.75 0.15 40)";
      ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y - sz + 6, 4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "radahn": {
      // massive body
      ctx.fillStyle = "oklch(0.42 0.14 50)";
      ctx.beginPath(); ctx.arc(e.pos.x, e.pos.y, sz, 0, Math.PI * 2); ctx.fill();
      // red mane
      ctx.strokeStyle = "oklch(0.55 0.2 30)"; ctx.lineWidth = 3;
      for (let a = -6; a <= 6; a++) {
        const ang = (a / 6) * 0.8 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(e.pos.x + Math.cos(ang) * sz, e.pos.y + Math.sin(ang) * sz);
        ctx.lineTo(e.pos.x + Math.cos(ang) * (sz + 16), e.pos.y + Math.sin(ang) * (sz + 16));
        ctx.stroke();
      }
      // two greatswords
      ctx.strokeStyle = "oklch(0.75 0.05 40)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(e.pos.x - sz + 6, e.pos.y); ctx.lineTo(e.pos.x - sz - 30, e.pos.y + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.pos.x + sz - 6, e.pos.y); ctx.lineTo(e.pos.x + sz + 30, e.pos.y + 20); ctx.stroke();
      // eyes
      ctx.fillStyle = "oklch(0.85 0.2 30)"; ctx.shadowColor = "oklch(0.85 0.2 30)"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(e.pos.x - 8, e.pos.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.pos.x + 8, e.pos.y - 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
  }

  // eyes on generic enemies
  if (["hollow", "beast"].includes(e.kind)) {
    ctx.fillStyle = "oklch(0.8 0.19 55)"; ctx.shadowColor = "oklch(0.8 0.19 55)"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(e.pos.x - sz / 3, e.pos.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(e.pos.x + sz / 3, e.pos.y - 2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (e.frozen > 0) ctx.restore();

  // HP bar for non-bosses
  if (!def.isBoss) {
    const w = sz * 2;
    ctx.fillStyle = "oklch(0.2 0.01 60)";
    ctx.fillRect(e.pos.x - w / 2, e.pos.y - sz - 10, w, 3);
    ctx.fillStyle = "oklch(0.55 0.2 25)";
    ctx.fillRect(e.pos.x - w / 2, e.pos.y - sz - 10, w * (e.hp / e.maxHp), 3);
  }
  // bleed indicator
  if (e.bleed.stacks > 0) {
    ctx.fillStyle = "oklch(0.5 0.2 25)";
    ctx.font = "10px serif"; ctx.textAlign = "center";
    ctx.fillText(`❥${e.bleed.stacks}`, e.pos.x, e.pos.y - sz - 14);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: any, now: number) {
  const p = s.player;
  const cls = s.cls as ClassDef;
  const flash = p.invuln > 0 && Math.floor(p.invuln / 3) % 2 === 0;
  if (flash) return;
  // shadow
  ctx.fillStyle = "oklch(0 0 0 / 0.55)";
  ctx.beginPath(); ctx.ellipse(p.pos.x, p.pos.y + 14, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  // cloak
  ctx.fillStyle = "oklch(0.16 0.02 40)";
  ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y + 4, 16, 0, Math.PI * 2); ctx.fill();
  // body — class colored
  ctx.fillStyle = "oklch(0.28 0.03 60)";
  ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 12, 0, Math.PI * 2); ctx.fill();
  // trim
  ctx.strokeStyle = cls.accent; ctx.lineWidth = 1.5;
  ctx.shadowColor = cls.accent; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
  // helmet plume for warrior/vagabond, hood for astro/prophet
  if (cls.id === "vagabond" || cls.id === "warrior" || cls.id === "samurai") {
    ctx.fillStyle = cls.accent;
    ctx.fillRect(p.pos.x - 2, p.pos.y - 14, 4, 6);
  } else {
    ctx.fillStyle = "oklch(0.18 0.02 40)";
    ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y - 6, 10, Math.PI, 0); ctx.fill();
    // sigil glow
    ctx.fillStyle = cls.accent; ctx.shadowColor = cls.accent; ctx.shadowBlur = 8;
    ctx.font = "10px serif"; ctx.textAlign = "center";
    ctx.fillText(cls.sigil, p.pos.x, p.pos.y - 4); ctx.shadowBlur = 0;
  }
  // weapon
  const weaponId = s.equipped.weapon as string | null;
  const swingAng = p.swing > 0 ? (12 - p.swing) * 0.28 : 0;
  const ang = Math.atan2(p.facing.y, p.facing.x) + swingAng - 0.4;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);
  ctx.rotate(ang);
  if (weaponId && ITEMS[weaponId]) {
    const w = ITEMS[weaponId];
    if (w.id.includes("staff") || w.id.includes("seal")) {
      // staff
      ctx.fillStyle = "oklch(0.35 0.03 30)";
      ctx.fillRect(4, -1.5, 28, 3);
      ctx.fillStyle = cls.accent; ctx.shadowColor = cls.accent; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(32, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else if (w.id === "twin_scimitars") {
      ctx.fillStyle = "oklch(0.8 0.02 80)";
      ctx.fillRect(6, -4, 22, 2);
      ctx.fillRect(6, 2, 22, 2);
    } else if (w.id === "uchigatana" || w.id === "moonveil") {
      ctx.fillStyle = w.id === "moonveil" ? "oklch(0.8 0.15 260)" : "oklch(0.85 0.03 80)";
      ctx.shadowColor = w.id === "moonveil" ? "oklch(0.7 0.2 260)" : "transparent";
      ctx.shadowBlur = w.id === "moonveil" ? 14 : 0;
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.quadraticCurveTo(20, -4, 34, -1); ctx.lineTo(34, 2); ctx.quadraticCurveTo(20, -1, 6, 3); ctx.closePath();
      ctx.fill(); ctx.shadowBlur = 0;
    } else if (w.id === "claymore" || w.id === "flamberge" || w.id === "dark_moon_greatsword" || w.id === "blasphemous_blade") {
      const color = w.id === "dark_moon_greatsword" ? "oklch(0.8 0.15 260)" : w.id === "blasphemous_blade" ? "oklch(0.55 0.19 25)" : "oklch(0.82 0.02 80)";
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.fillRect(8, -3, 32, 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "oklch(0.5 0.06 60)"; ctx.fillRect(4, -4, 4, 8);
    } else {
      // default sword
      ctx.fillStyle = "oklch(0.85 0.02 80)";
      ctx.fillRect(10, -2, 26, 4);
      ctx.fillStyle = "oklch(0.6 0.1 60)";
      ctx.fillRect(6, -3, 4, 6);
    }
  }
  ctx.restore();
  // swing arc
  if (p.swing > 0) {
    ctx.strokeStyle = `oklch(0.85 0.15 85 / ${p.swing / 12})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const a0 = Math.atan2(p.facing.y, p.facing.x);
    ctx.arc(p.pos.x, p.pos.y, 56, a0 - 0.9, a0 + 0.4);
    ctx.stroke();
  }
  // ability aura (warcry / backstab)
  if (p.ability > 0) {
    ctx.strokeStyle = `oklch(0.8 0.18 60 / ${p.ability / 30})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 30 + (30 - p.ability), 0, Math.PI * 2); ctx.stroke();
  }
  // buff timer
  if (p.buffTimer > 0) {
    ctx.strokeStyle = "oklch(0.82 0.15 60 / 0.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, 22 + Math.sin(now / 100) * 2, 0, Math.PI * 2); ctx.stroke();
  }
}

// Small helper — this is just for TS to type `s` in renderFrame
function useDummy() { return null as any; }

// ============================================================================
// UI subcomponents
// ============================================================================
function ClassPortrait({ cls }: { cls: ClassDef }) {
  return (
    <div className="relative w-14 h-14 border border-[color:var(--gold)]/50 bg-black/60 flex items-center justify-center" style={{ boxShadow: `0 0 12px ${cls.accent}66` }}>
      <div className="font-display text-2xl" style={{ color: cls.accent, textShadow: `0 0 10px ${cls.accent}` }}>
        {cls.sigil}
      </div>
      <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-[color:var(--gold)]/80 tracking-widest">
        {cls.name.toUpperCase()}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color, thin }: { label: string; value: number; max: number; color: string; thin?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] text-[color:var(--gold)]/70 mb-0.5">
        <span>{label}</span><span>{Math.max(0, Math.round(value))} / {max}</span>
      </div>
      <div className={`bg-black/70 border border-[color:var(--gold)]/40 ${thin ? "h-1.5" : "h-2.5"}`}>
        <div className="h-full transition-[width] duration-100" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </div>
    </div>
  );
}

function AbilitySlot({ label, hint, cd, icon, cost, fp, accent }: { label: string; hint: string; cd: number; icon: string; cost?: number; fp?: number; accent?: string }) {
  const disabled = cost !== undefined && fp !== undefined && fp < cost;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`relative w-11 h-11 border ${disabled ? "border-[color:var(--gold)]/20 opacity-40" : "border-[color:var(--gold)]/60"} bg-black/70 flex items-center justify-center`} style={{ boxShadow: accent ? `0 0 10px ${accent}55` : undefined }}>
        <div className="text-xl" style={{ color: accent ?? "oklch(0.82 0.13 85)", textShadow: `0 0 8px ${accent ?? "oklch(0.72 0.19 45)"}` }}>{icon}</div>
        {cd > 0 && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px]">{Math.ceil(cd / 6)}</div>}
      </div>
      <div className="text-[8px] text-[color:var(--gold)]/80">{hint}</div>
    </div>
  );
}

function ClassSelect({ selected, onSelect, onStart, onBack }: {
  selected: ClassId; onSelect: (c: ClassId) => void; onStart: () => void; onBack: () => void;
}) {
  const cls = CLASSES.find(c => c.id === selected)!;
  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col p-6">
      <div className="text-center mb-3">
        <h2 className="font-display text-2xl md:text-3xl text-gold-glow tracking-[0.3em]">CHOOSE A KEEPSAKE</h2>
        <p className="italic text-xs text-muted-foreground">Six pilgrimages await, Tarnished.</p>
      </div>
      <div className="grid grid-cols-6 gap-2 mb-4">
        {CLASSES.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`border transition-all p-3 flex flex-col items-center gap-1 ${selected === c.id ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "border-[color:var(--gold)]/25 hover:border-[color:var(--gold)]/60"}`}
            style={{ boxShadow: selected === c.id ? `0 0 20px ${c.accent}88` : undefined }}
          >
            <div className="text-3xl font-display" style={{ color: c.accent, textShadow: `0 0 12px ${c.accent}` }}>{c.sigil}</div>
            <div className="font-display text-[11px] tracking-widest text-[color:var(--gold)]/90">{c.name.toUpperCase()}</div>
            <div className="text-[9px] italic text-muted-foreground">{c.title}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-6 flex-1">
        <div>
          <div className="font-display text-xl mb-2" style={{ color: cls.accent }}>{cls.name}</div>
          <p className="italic text-sm mb-4">{cls.tagline}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-display tracking-wider mb-4">
            {(Object.keys(cls.stats) as StatKey[]).map(k => (
              <div key={k} className="flex justify-between border-b border-[color:var(--border)] py-1">
                <span className="text-[color:var(--gold)]/70">{STAT_LABEL[k]}</span>
                <span className={cls.scaling === k ? "text-gold-glow" : ""}>{cls.stats[k]}</span>
              </div>
            ))}
          </div>
          <div className="text-xs">
            <div className="text-[color:var(--gold)]/70 tracking-widest mb-1">STARTING GEAR</div>
            <div className="mb-2">
              <span className="text-gold-glow">⚔</span> {ITEMS[cls.startingWeapon].name} <span className="text-muted-foreground italic">— {ITEMS[cls.startingWeapon].desc}</span>
            </div>
            <div>
              <span className="text-gold-glow">◊</span> {ITEMS[cls.startingArmor].name} <span className="text-muted-foreground italic">— {ITEMS[cls.startingArmor].desc}</span>
            </div>
          </div>
        </div>
        <div className="border-l border-[color:var(--gold)]/25 pl-6">
          <div className="text-[color:var(--gold)]/70 tracking-widest text-xs mb-2 font-display">CLASS ABILITY</div>
          <div className="font-display text-lg mb-1" style={{ color: cls.accent }}>{cls.ability.name}</div>
          <div className="text-xs italic mb-4">{cls.ability.desc}</div>
          <div className="text-xs text-muted-foreground">Cost: {cls.ability.fpCost} FP · Cast with Right Click or Q</div>
        </div>
      </div>
      <div className="flex justify-center gap-3 mt-4">
        <button onClick={onBack} className="font-display tracking-[0.3em] text-xs px-6 py-2 border border-[color:var(--gold)]/40 hover:border-[color:var(--gold)]">◄ BACK</button>
        <button onClick={onStart} className="font-display tracking-[0.3em] text-xs px-10 py-2 border border-[color:var(--gold)]/80 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10">◆ EMBARK ◆</button>
      </div>
    </div>
  );
}

function InventoryPanel({ inventory, equipped, stats, baseStats, level, p, cls, onEquip, onUnequip, onClose }: {
  inventory: string[]; equipped: { weapon: string | null; armor: string | null; talisman: string | null };
  stats: Stats; baseStats: Stats; level: number; p: any; cls: ClassDef;
  onEquip: (idx: number) => void; onUnequip: (slot: "weapon" | "armor" | "talisman") => void; onClose: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hoverItem = hover ? ITEMS[hover] : null;
  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm p-5 grid grid-cols-[220px_1fr_260px] gap-4">
      <div>
        <div className="font-display text-xs tracking-widest text-[color:var(--gold)]/70 mb-2">EQUIPMENT</div>
        {(["weapon", "armor", "talisman"] as const).map(slot => {
          const id = equipped[slot];
          const it = id ? ITEMS[id] : null;
          return (
            <div key={slot} onClick={() => onUnequip(slot)}
              className="mb-2 border border-[color:var(--gold)]/30 hover:border-[color:var(--gold)]/70 p-2 cursor-pointer transition-colors"
              onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
            >
              <div className="text-[10px] uppercase text-[color:var(--gold)]/60 tracking-widest">{slot}</div>
              {it ? (
                <div>
                  <div className="text-sm font-display" style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</div>
                  <div className="text-[10px] text-muted-foreground italic">click to unequip</div>
                </div>
              ) : <div className="text-xs italic text-muted-foreground">— empty —</div>}
            </div>
          );
        })}
        <div className="font-display text-xs tracking-widest text-[color:var(--gold)]/70 mt-4 mb-1">ATTRIBUTES</div>
        <div className="space-y-0.5 text-xs">
          {(Object.keys(stats) as StatKey[]).map(k => {
            const diff = stats[k] - baseStats[k];
            return (
              <div key={k} className="flex justify-between border-b border-[color:var(--border)] py-0.5">
                <span className="text-[color:var(--gold)]/70">{STAT_LABEL[k]}</span>
                <span>
                  <span className={cls.scaling === k ? "text-gold-glow" : ""}>{stats[k]}</span>
                  {diff > 0 && <span className="text-[color:var(--gold)] ml-1">+{diff}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-between items-baseline mb-3">
          <div className="font-display text-2xl tracking-[0.25em] text-gold-glow">INVENTORY</div>
          <button onClick={onClose} className="text-xs tracking-widest text-[color:var(--gold)]/70 hover:text-[color:var(--gold)]">[ESC / I] CLOSE</button>
        </div>
        <div className="grid grid-cols-6 gap-2 flex-1 content-start">
          {Array.from({ length: 36 }).map((_, i) => {
            const id = inventory[i];
            const it = id ? ITEMS[id] : null;
            return (
              <button key={i} disabled={!it} onClick={() => it && onEquip(i)}
                onMouseEnter={() => setHover(id ?? null)} onMouseLeave={() => setHover(null)}
                className={`aspect-square border relative flex items-center justify-center ${it ? "border-[color:var(--gold)]/40 hover:border-[color:var(--gold)] bg-black/50" : "border-[color:var(--gold)]/10 bg-black/30"}`}
                style={it ? { boxShadow: `inset 0 0 12px ${RARITY_COLOR[it.rarity]}44` } : undefined}
              >
                {it && (
                  <div className="text-center">
                    <div className="text-2xl" style={{ color: RARITY_COLOR[it.rarity] }}>
                      {it.kind === "weapon" ? "⚔" : it.kind === "armor" ? "◊" : "◈"}
                    </div>
                    <div className="text-[8px] text-[color:var(--gold)]/80 truncate w-full px-0.5">{it.name.split(" ")[0]}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="font-display text-xs tracking-widest text-[color:var(--gold)]/70 mb-2">DETAILS</div>
        {hoverItem ? (
          <div className="border border-[color:var(--gold)]/40 p-3" style={{ boxShadow: `0 0 20px ${RARITY_COLOR[hoverItem.rarity]}33` }}>
            <div className="font-display text-lg" style={{ color: RARITY_COLOR[hoverItem.rarity] }}>{hoverItem.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-[color:var(--gold)]/60 mb-2">{hoverItem.rarity} · {hoverItem.kind}</div>
            <p className="italic text-xs mb-3">{hoverItem.desc}</p>
            {hoverItem.dmg !== undefined && <div className="text-xs">Damage: <span className="text-gold-glow">{hoverItem.dmg}</span> {hoverItem.scaling && <span className="text-muted-foreground">· scales with {STAT_LABEL[hoverItem.scaling]}</span>}</div>}
            <div className="text-xs mt-2">
              {(Object.keys(hoverItem.bonus) as StatKey[]).map(k => (
                <div key={k} className="flex justify-between">
                  <span className="text-[color:var(--gold)]/70">{STAT_LABEL[k]}</span>
                  <span className="text-[color:var(--gold)]">+{hoverItem.bonus[k]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs italic text-muted-foreground">Hover an item to inspect.</div>
        )}
      </div>
    </div>
  );
}

function SkillTreePanel({ learned, sp, hover, setHover, onLearn, onClose }: {
  learned: Set<string>; sp: number; hover: string | null; setHover: (id: string | null) => void;
  onLearn: (id: string) => void; onClose: () => void;
}) {
  const branches: { id: SkillBranch; label: string; color: string; x: number }[] = [
    { id: "warrior", label: "STEEL", color: "oklch(0.7 0.15 30)", x: 0.2 },
    { id: "core", label: "GRACE", color: "oklch(0.8 0.13 70)", x: 0.5 },
    { id: "sorcery", label: "GLINTSTONE", color: "oklch(0.65 0.18 250)", x: 0.8 },
  ];
  const faithBranch = { id: "faith" as SkillBranch, label: "FLAME OF FAITH", color: "oklch(0.7 0.15 40)" };
  const bx = (b: SkillBranch) => branches.find(x => x.id === b)?.x ?? 0.5;
  const hoverSkill = hover ? SKILLS.find(x => x.id === hover) : null;

  const canLearn = (sk: Skill) => sp >= sk.cost && (!sk.requires || sk.requires.every(r => learned.has(r))) && !learned.has(sk.id);

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm p-5 grid grid-cols-[1fr_260px] gap-4">
      <div className="flex flex-col">
        <div className="flex justify-between items-baseline mb-3">
          <div className="font-display text-2xl tracking-[0.25em] text-gold-glow">ROADS OF POWER</div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gold-glow font-display tracking-widest">◆ {sp} skill points</div>
            <button onClick={onClose} className="text-xs tracking-widest text-[color:var(--gold)]/70 hover:text-[color:var(--gold)]">[ESC / K] CLOSE</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 flex-1 border border-[color:var(--gold)]/20 p-3 relative overflow-hidden">
          {/* SVG connectors */}
          <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" viewBox="0 0 1000 600" preserveAspectRatio="none">
            {SKILLS.filter(s => s.requires).flatMap(s => (s.requires ?? []).map(r => {
              const from = SKILLS.find(x => x.id === r)!;
              const branchesLocal: Record<SkillBranch, number> = { warrior: 1 / 6, core: 3 / 6, sorcery: 5 / 6, faith: 1 / 2 };
              const y = (t: number) => 60 + t * 110;
              const x = (b: SkillBranch, col: number) => (branchesLocal[b] * 1000) + col * 100;
              return <line key={s.id + r} x1={x(from.branch, from.col)} y1={y(from.tier)} x2={x(s.branch, s.col)} y2={y(s.tier)}
                stroke={learned.has(s.id) ? "oklch(0.82 0.14 70)" : "oklch(0.4 0.03 60 / 0.5)"} strokeWidth={learned.has(s.id) ? 2 : 1} />;
            }))}
          </svg>
          {branches.map(b => (
            <div key={b.id} className="relative">
              <div className="font-display text-xs tracking-[0.3em] text-center mb-3" style={{ color: b.color, textShadow: `0 0 12px ${b.color}` }}>
                {b.label}
              </div>
              <div className="relative h-[520px]">
                {SKILLS.filter(s => s.branch === b.id).map(sk => {
                  const owned = learned.has(sk.id);
                  const learnable = canLearn(sk);
                  const y = 20 + sk.tier * 110;
                  const x = 50 + sk.col * 80;
                  return (
                    <button key={sk.id}
                      onMouseEnter={() => setHover(sk.id)} onMouseLeave={() => setHover(null)}
                      onClick={() => onLearn(sk.id)}
                      disabled={!learnable && !owned}
                      className={`absolute w-14 h-14 border-2 rounded-full flex items-center justify-center transition-all -translate-x-1/2 ${owned ? "bg-[color:var(--gold)]/20" : "bg-black/70"}`}
                      style={{
                        left: `${(x / 260) * 100}%`, top: y,
                        borderColor: owned ? b.color : learnable ? "oklch(0.82 0.13 85)" : "oklch(0.3 0.02 60)",
                        boxShadow: owned ? `0 0 18px ${b.color}` : learnable ? "0 0 10px oklch(0.72 0.19 45 / 0.5)" : undefined,
                        opacity: owned ? 1 : learnable ? 1 : 0.55,
                      }}
                    >
                      <span className="font-display text-lg" style={{ color: owned ? b.color : "oklch(0.7 0.05 70)" }}>
                        {b.id === "warrior" ? "⚔" : b.id === "sorcery" ? "✦" : "◆"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Faith branch below */}
        <div className="mt-3 border border-[color:var(--gold)]/20 p-3 relative">
          <div className="font-display text-xs tracking-[0.3em] text-center mb-3" style={{ color: faithBranch.color, textShadow: `0 0 12px ${faithBranch.color}` }}>
            {faithBranch.label}
          </div>
          <div className="relative h-[120px]">
            {SKILLS.filter(s => s.branch === "faith").map((sk, i, arr) => {
              const owned = learned.has(sk.id);
              const learnable = canLearn(sk);
              const x = 50 + (i / (arr.length - 1)) * 900;
              return (
                <button key={sk.id}
                  onMouseEnter={() => setHover(sk.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => onLearn(sk.id)}
                  disabled={!learnable && !owned}
                  className="absolute w-12 h-12 border-2 rounded-full flex items-center justify-center transition-all -translate-x-1/2 top-4"
                  style={{
                    left: x,
                    background: owned ? "oklch(0.7 0.15 40 / 0.2)" : "oklch(0 0 0 / 0.7)",
                    borderColor: owned ? faithBranch.color : learnable ? "oklch(0.82 0.13 85)" : "oklch(0.3 0.02 60)",
                    boxShadow: owned ? `0 0 18px ${faithBranch.color}` : undefined,
                    opacity: owned ? 1 : learnable ? 1 : 0.55,
                  }}
                >
                  <span className="font-display text-lg" style={{ color: owned ? faithBranch.color : "oklch(0.7 0.05 70)" }}>✧</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <div className="font-display text-xs tracking-widest text-[color:var(--gold)]/70 mb-2">SKILL DETAILS</div>
        {hoverSkill ? (
          <div className="border border-[color:var(--gold)]/40 p-3">
            <div className="font-display text-lg text-gold-glow">{hoverSkill.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-[color:var(--gold)]/60 mb-2">
              {hoverSkill.branch} · tier {hoverSkill.tier + 1}
            </div>
            <p className="italic text-xs mb-3">{hoverSkill.desc}</p>
            <div className="text-xs">Cost: <span className="text-gold-glow">{hoverSkill.cost} SP</span></div>
            {hoverSkill.requires && (
              <div className="text-xs mt-1">
                Requires: {hoverSkill.requires.map(r => {
                  const q = SKILLS.find(x => x.id === r);
                  return <span key={r} className={learned.has(r) ? "text-[color:var(--gold)]" : "text-destructive"}> {q?.name}</span>;
                })}
              </div>
            )}
            {learned.has(hoverSkill.id) && <div className="text-xs mt-2 text-[color:var(--gold)]">✓ LEARNED</div>}
          </div>
        ) : (
          <div className="text-xs italic text-muted-foreground">Hover a node to inspect. Click a node to spend SP.</div>
        )}
        <div className="mt-6 text-[10px] italic text-muted-foreground leading-relaxed">
          Skill points are gifted upon felling Great Enemies. Each Lord grants +2 SP. Every road bends towards Elden Lord.
        </div>
      </div>
    </div>
  );
}
