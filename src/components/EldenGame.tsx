import { useEffect, useRef, useState, useCallback } from "react";

type Vec = { x: number; y: number };
type Enemy = {
  pos: Vec;
  hp: number;
  maxHp: number;
  kind: "hollow" | "knight" | "beast" | "wraith";
  cooldown: number;
  speed: number;
  dmg: number;
  size: number;
  stagger: number;
};
type Projectile = { pos: Vec; vel: Vec; life: number; from: "player" | "enemy"; dmg: number };
type Particle = { pos: Vec; vel: Vec; life: number; max: number; color: string; size: number };
type Room = {
  seed: number;
  enemies: Enemy[];
  cleared: boolean;
  doors: { n: boolean; s: boolean; e: boolean; w: boolean };
  isBoss: boolean;
  hasRelic: boolean;
  decor: { x: number; y: number; kind: "pillar" | "grave" | "brazier" | "rubble" }[];
};

const W = 960;
const H = 600;
const TILE = 40;

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRoom(seed: number, depth: number, isBoss: boolean): Room {
  const rand = mulberry32(seed);
  const enemies: Enemy[] = [];
  if (isBoss) {
    enemies.push({
      pos: { x: W / 2, y: 180 },
      hp: 220 + depth * 40,
      maxHp: 220 + depth * 40,
      kind: "knight",
      cooldown: 0,
      speed: 1.6,
      dmg: 22,
      size: 26,
      stagger: 0,
    });
  } else {
    const count = 2 + Math.floor(rand() * 3) + Math.floor(depth / 2);
    for (let i = 0; i < count; i++) {
      const r = rand();
      const kind: Enemy["kind"] =
        r < 0.5 ? "hollow" : r < 0.78 ? "beast" : r < 0.94 ? "wraith" : "knight";
      const base = {
        hollow: { hp: 30, speed: 1.1, dmg: 8, size: 14 },
        beast: { hp: 45, speed: 1.7, dmg: 12, size: 16 },
        wraith: { hp: 25, speed: 0.9, dmg: 14, size: 15 },
        knight: { hp: 80, speed: 1.3, dmg: 18, size: 20 },
      }[kind];
      enemies.push({
        pos: {
          x: 120 + rand() * (W - 240),
          y: 120 + rand() * (H - 240),
        },
        hp: base.hp + depth * 6,
        maxHp: base.hp + depth * 6,
        kind,
        cooldown: rand() * 60,
        speed: base.speed,
        dmg: base.dmg,
        size: base.size,
        stagger: 0,
      });
    }
  }
  const decor: Room["decor"] = [];
  const decorCount = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < decorCount; i++) {
    const kinds: Room["decor"][0]["kind"][] = ["pillar", "grave", "brazier", "rubble"];
    decor.push({
      x: 80 + rand() * (W - 160),
      y: 80 + rand() * (H - 160),
      kind: kinds[Math.floor(rand() * kinds.length)],
    });
  }
  return {
    seed,
    enemies,
    cleared: false,
    doors: {
      n: rand() > 0.35,
      s: rand() > 0.35,
      e: rand() > 0.35,
      w: rand() > 0.35,
    },
    isBoss,
    hasRelic: !isBoss && rand() > 0.7,
    decor,
  };
}

export default function EldenGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uiTick, setUiTick] = useState(0);
  const [screen, setScreen] = useState<"title" | "play" | "dead" | "victory">("title");

  const state = useRef({
    player: {
      pos: { x: W / 2, y: H / 2 },
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      runes: 0,
      dmg: 20,
      dashCd: 0,
      atkCd: 0,
      invuln: 0,
      facing: { x: 1, y: 0 },
      swing: 0,
      relics: 0,
    },
    room: makeRoom(1, 1, false),
    depth: 1,
    roomsCleared: 0,
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    keys: {} as Record<string, boolean>,
    mouse: { x: W / 2, y: H / 2, down: false },
    lastAtk: 0,
    message: "",
    messageTime: 0,
  });

  const reset = useCallback(() => {
    const s = state.current;
    s.player = {
      pos: { x: W / 2, y: H / 2 },
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      runes: 0,
      dmg: 20,
      dashCd: 0,
      atkCd: 0,
      invuln: 0,
      facing: { x: 1, y: 0 },
      swing: 0,
      relics: 0,
    };
    s.depth = 1;
    s.roomsCleared = 0;
    s.room = makeRoom(Date.now() & 0xffff, 1, false);
    s.projectiles = [];
    s.particles = [];
    s.message = "Grace guides you, Tarnished...";
    s.messageTime = 180;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      state.current.keys[e.key.toLowerCase()] = down;
      if (down && e.key === " ") e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const spawnParticles = (pos: Vec, color: string, n: number, spread = 3) => {
      for (let i = 0; i < n; i++) {
        state.current.particles.push({
          pos: { ...pos },
          vel: { x: (Math.random() - 0.5) * spread, y: (Math.random() - 0.5) * spread },
          life: 30 + Math.random() * 20,
          max: 50,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    };

    const nextRoom = (dir: "n" | "s" | "e" | "w") => {
      const s = state.current;
      s.roomsCleared++;
      s.depth = Math.floor(s.roomsCleared / 3) + 1;
      const isBoss = s.roomsCleared > 0 && s.roomsCleared % 5 === 0;
      s.room = makeRoom((s.room.seed * 7919 + s.roomsCleared) & 0xffff, s.depth, isBoss);
      s.projectiles = [];
      if (dir === "n") s.player.pos = { x: W / 2, y: H - 80 };
      if (dir === "s") s.player.pos = { x: W / 2, y: 80 };
      if (dir === "e") s.player.pos = { x: 80, y: H / 2 };
      if (dir === "w") s.player.pos = { x: W - 80, y: H / 2 };
      s.message = isBoss ? "A great foe blocks the way..." : `Depth ${s.depth}`;
      s.messageTime = 120;
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      state.current.mouse.x = ((e.clientX - r.left) / r.width) * W;
      state.current.mouse.y = ((e.clientY - r.top) / r.height) * H;
    };
    const onMouseDown = () => (state.current.mouse.down = true);
    const onMouseUp = () => (state.current.mouse.down = false);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);

    const step = (now: number) => {
      const dt = Math.min(32, now - last) / 16.666;
      last = now;
      const s = state.current;
      const p = s.player;

      // input
      let mx = 0,
        my = 0;
      if (s.keys["w"] || s.keys["arrowup"]) my -= 1;
      if (s.keys["s"] || s.keys["arrowdown"]) my += 1;
      if (s.keys["a"] || s.keys["arrowleft"]) mx -= 1;
      if (s.keys["d"] || s.keys["arrowright"]) mx += 1;
      const mag = Math.hypot(mx, my) || 1;
      mx /= mag;
      my /= mag;
      const speed = 3.2 * dt;
      p.pos.x = Math.max(50, Math.min(W - 50, p.pos.x + mx * speed));
      p.pos.y = Math.max(50, Math.min(H - 50, p.pos.y + my * speed));

      // facing = towards mouse
      const fdx = s.mouse.x - p.pos.x;
      const fdy = s.mouse.y - p.pos.y;
      const fm = Math.hypot(fdx, fdy) || 1;
      p.facing = { x: fdx / fm, y: fdy / fm };

      // dash
      if (s.keys["shift"] && p.dashCd <= 0 && p.stamina >= 25) {
        p.pos.x += p.facing.x * 60;
        p.pos.y += p.facing.y * 60;
        p.pos.x = Math.max(50, Math.min(W - 50, p.pos.x));
        p.pos.y = Math.max(50, Math.min(H - 50, p.pos.y));
        p.stamina -= 25;
        p.dashCd = 30;
        p.invuln = 20;
        spawnParticles(p.pos, "oklch(0.72 0.19 45)", 12, 4);
      }
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.atkCd = Math.max(0, p.atkCd - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.swing = Math.max(0, p.swing - dt * 3);
      p.stamina = Math.min(p.maxStamina, p.stamina + 0.6 * dt);

      // attack (melee)
      if (s.mouse.down && p.atkCd <= 0 && p.stamina >= 15) {
        p.atkCd = 22;
        p.stamina -= 15;
        p.swing = 10;
        const reach = 60;
        for (const e of s.room.enemies) {
          const dx = e.pos.x - p.pos.x;
          const dy = e.pos.y - p.pos.y;
          const d = Math.hypot(dx, dy);
          if (d < reach + e.size) {
            const dot = (dx / (d || 1)) * p.facing.x + (dy / (d || 1)) * p.facing.y;
            if (dot > 0.3) {
              e.hp -= p.dmg;
              e.stagger = 15;
              e.pos.x += p.facing.x * 8;
              e.pos.y += p.facing.y * 8;
              spawnParticles(e.pos, "oklch(0.42 0.19 25)", 8);
            }
          }
        }
      }

      // ranged (space) - flame projectile
      if (s.keys[" "] && p.atkCd <= 0 && p.stamina >= 20) {
        p.atkCd = 28;
        p.stamina -= 20;
        s.projectiles.push({
          pos: { ...p.pos },
          vel: { x: p.facing.x * 6, y: p.facing.y * 6 },
          life: 80,
          from: "player",
          dmg: p.dmg * 0.8,
        });
      }

      // enemies
      for (const e of s.room.enemies) {
        if (e.hp <= 0) continue;
        e.stagger = Math.max(0, e.stagger - dt);
        if (e.stagger > 0) continue;
        const dx = p.pos.x - e.pos.x;
        const dy = p.pos.y - e.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        const desired = e.kind === "wraith" ? 180 : 0;
        if (Math.abs(d - desired) > 10) {
          const sign = d > desired ? 1 : -1;
          e.pos.x += (dx / d) * e.speed * dt * sign;
          e.pos.y += (dy / d) * e.speed * dt * sign;
        }
        e.cooldown -= dt;
        if (e.cooldown <= 0) {
          if (e.kind === "wraith") {
            s.projectiles.push({
              pos: { ...e.pos },
              vel: { x: (dx / d) * 3.5, y: (dy / d) * 3.5 },
              life: 120,
              from: "enemy",
              dmg: e.dmg,
            });
            e.cooldown = 90;
          } else if (d < e.size + 30) {
            if (p.invuln <= 0) {
              p.hp -= e.dmg;
              p.invuln = 40;
              spawnParticles(p.pos, "oklch(0.42 0.19 25)", 10);
            }
            e.cooldown = 60;
          } else {
            e.cooldown = 20;
          }
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
            if (Math.hypot(e.pos.x - pr.pos.x, e.pos.y - pr.pos.y) < e.size + 6) {
              e.hp -= pr.dmg;
              e.stagger = 10;
              pr.life = 0;
              spawnParticles(pr.pos, "oklch(0.72 0.19 45)", 6);
            }
          }
        } else {
          if (Math.hypot(p.pos.x - pr.pos.x, p.pos.y - pr.pos.y) < 18 && p.invuln <= 0) {
            p.hp -= pr.dmg;
            p.invuln = 30;
            pr.life = 0;
            spawnParticles(p.pos, "oklch(0.42 0.19 25)", 8);
          }
        }
      }
      s.projectiles = s.projectiles.filter(
        (pr) => pr.life > 0 && pr.pos.x > 0 && pr.pos.x < W && pr.pos.y > 0 && pr.pos.y < H
      );

      // dead enemies -> runes
      const before = s.room.enemies.length;
      s.room.enemies = s.room.enemies.filter((e) => {
        if (e.hp <= 0) {
          const gain = e.kind === "knight" ? 80 : e.kind === "beast" ? 25 : e.kind === "wraith" ? 30 : 15;
          p.runes += gain;
          spawnParticles(e.pos, "oklch(0.82 0.13 85)", 16, 5);
          return false;
        }
        return true;
      });
      if (before > 0 && s.room.enemies.length === 0 && !s.room.cleared) {
        s.room.cleared = true;
        if (s.room.isBoss) {
          p.maxHp += 20;
          p.hp = p.maxHp;
          p.dmg += 5;
          p.relics++;
          s.message = "Great Rune claimed. Strength grows.";
          s.messageTime = 240;
          if (p.relics >= 3) {
            setScreen("victory");
          }
        } else if (s.room.hasRelic) {
          p.maxHp += 8;
          p.hp = Math.min(p.maxHp, p.hp + 20);
          s.message = "A relic of a fallen lord... you feel stronger.";
          s.messageTime = 180;
        }
      }

      // particles
      for (const pt of s.particles) {
        pt.pos.x += pt.vel.x * dt;
        pt.pos.y += pt.vel.y * dt;
        pt.vel.x *= 0.94;
        pt.vel.y *= 0.94;
        pt.life -= dt;
      }
      s.particles = s.particles.filter((p) => p.life > 0);

      // room transitions
      if (s.room.cleared) {
        if (p.pos.y < 55 && s.room.doors.n) nextRoom("n");
        else if (p.pos.y > H - 55 && s.room.doors.s) nextRoom("s");
        else if (p.pos.x > W - 55 && s.room.doors.e) nextRoom("e");
        else if (p.pos.x < 55 && s.room.doors.w) nextRoom("w");
      }

      // death
      if (p.hp <= 0) {
        setScreen("dead");
      }

      if (s.messageTime > 0) s.messageTime -= dt;

      // === RENDER ===
      // floor
      ctx.fillStyle = "oklch(0.11 0.008 60)";
      ctx.fillRect(0, 0, W, H);
      // stone tiles
      ctx.strokeStyle = "oklch(0.17 0.01 60 / 0.6)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += TILE) {
        for (let y = 0; y < H; y += TILE) {
          ctx.strokeRect(x, y, TILE, TILE);
        }
      }
      // vignette fog
      const grad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // walls
      ctx.fillStyle = "oklch(0.19 0.015 60)";
      ctx.fillRect(0, 0, W, 40);
      ctx.fillRect(0, H - 40, W, 40);
      ctx.fillRect(0, 0, 40, H);
      ctx.fillRect(W - 40, 0, 40, H);
      // doors
      ctx.fillStyle = s.room.cleared ? "oklch(0.72 0.19 45 / 0.9)" : "oklch(0.28 0.02 60)";
      if (s.room.doors.n) ctx.fillRect(W / 2 - 40, 0, 80, 40);
      if (s.room.doors.s) ctx.fillRect(W / 2 - 40, H - 40, 80, 40);
      if (s.room.doors.e) ctx.fillRect(W - 40, H / 2 - 40, 40, 80);
      if (s.room.doors.w) ctx.fillRect(0, H / 2 - 40, 40, 80);

      // decor
      for (const d of s.room.decor) {
        if (d.kind === "pillar") {
          ctx.fillStyle = "oklch(0.22 0.01 60)";
          ctx.beginPath();
          ctx.arc(d.x, d.y, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "oklch(0.3 0.02 60)";
          ctx.stroke();
        } else if (d.kind === "grave") {
          ctx.fillStyle = "oklch(0.24 0.01 60)";
          ctx.fillRect(d.x - 8, d.y - 14, 16, 20);
          ctx.fillRect(d.x - 12, d.y + 4, 24, 4);
        } else if (d.kind === "brazier") {
          ctx.fillStyle = "oklch(0.24 0.02 40)";
          ctx.beginPath();
          ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
          ctx.fill();
          const f = Math.sin(now / 100 + d.x) * 3;
          ctx.fillStyle = "oklch(0.75 0.2 55 / 0.9)";
          ctx.beginPath();
          ctx.ellipse(d.x, d.y - 8 - f, 6, 10 + f, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "oklch(0.85 0.15 85 / 0.6)";
          ctx.beginPath();
          ctx.arc(d.x, d.y - 10, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "oklch(0.2 0.01 60)";
          ctx.fillRect(d.x - 10, d.y - 4, 20, 8);
        }
      }

      // particles
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
        ctx.fillStyle =
          pr.from === "player" ? "oklch(0.82 0.15 55)" : "oklch(0.55 0.2 300)";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(pr.pos.x, pr.pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // enemies
      for (const e of s.room.enemies) {
        const colors: Record<Enemy["kind"], string> = {
          hollow: "oklch(0.4 0.03 70)",
          beast: "oklch(0.35 0.12 30)",
          wraith: "oklch(0.5 0.15 290)",
          knight: "oklch(0.3 0.05 260)",
        };
        ctx.fillStyle = colors[e.kind];
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y + 2, e.size, 0, Math.PI * 2);
        ctx.fill();
        // glowing eyes
        ctx.fillStyle = e.kind === "wraith" ? "oklch(0.7 0.2 290)" : "oklch(0.75 0.19 55)";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(e.pos.x - e.size / 3, e.pos.y - 2, 2, 0, Math.PI * 2);
        ctx.arc(e.pos.x + e.size / 3, e.pos.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // hp bar
        const w = e.size * 2;
        ctx.fillStyle = "oklch(0.2 0.01 60)";
        ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.size - 8, w, 3);
        ctx.fillStyle = "oklch(0.55 0.2 25)";
        ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.size - 8, w * (e.hp / e.maxHp), 3);
      }

      // player
      const flash = p.invuln > 0 && Math.floor(p.invuln / 3) % 2 === 0;
      if (!flash) {
        // cloak
        ctx.fillStyle = "oklch(0.18 0.02 40)";
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y + 4, 16, 0, Math.PI * 2);
        ctx.fill();
        // body
        ctx.fillStyle = "oklch(0.28 0.03 60)";
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 12, 0, Math.PI * 2);
        ctx.fill();
        // gold trim
        ctx.strokeStyle = "oklch(0.82 0.13 85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // sword
        const swingAng = p.swing > 0 ? (10 - p.swing) * 0.3 : 0;
        const ang = Math.atan2(p.facing.y, p.facing.x) + swingAng - 0.4;
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        ctx.rotate(ang);
        ctx.fillStyle = "oklch(0.85 0.02 80)";
        ctx.fillRect(10, -2, 26, 4);
        ctx.fillStyle = "oklch(0.6 0.1 60)";
        ctx.fillRect(6, -3, 4, 6);
        ctx.restore();
        // swing arc
        if (p.swing > 0) {
          ctx.strokeStyle = `oklch(0.85 0.15 85 / ${p.swing / 10})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          const a0 = Math.atan2(p.facing.y, p.facing.x);
          ctx.arc(p.pos.x, p.pos.y, 50, a0 - 0.9, a0 + 0.4);
          ctx.stroke();
        }
      }

      // hint arrows on cleared doors
      if (s.room.cleared) {
        const t = (Math.sin(now / 300) + 1) / 2;
        ctx.fillStyle = `oklch(0.82 0.13 85 / ${0.4 + t * 0.4})`;
        ctx.font = "20px serif";
        ctx.textAlign = "center";
        if (s.room.doors.n) ctx.fillText("↑", W / 2, 55);
        if (s.room.doors.s) ctx.fillText("↓", W / 2, H - 45);
        if (s.room.doors.e) ctx.fillText("→", W - 20, H / 2 + 6);
        if (s.room.doors.w) ctx.fillText("←", 20, H / 2 + 6);
      }

      // message
      if (s.messageTime > 0) {
        ctx.fillStyle = `oklch(0.82 0.13 85 / ${Math.min(1, s.messageTime / 60)})`;
        ctx.font = "italic 24px 'EB Garamond', serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "oklch(0.72 0.19 45)";
        ctx.shadowBlur = 12;
        ctx.fillText(s.message, W / 2, 80);
        ctx.shadowBlur = 0;
      }

      setUiTick((v) => (v + 1) % 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
    };
  }, [screen]);

  const p = state.current.player;

  return (
    <div className="relative w-full max-w-[1000px] mx-auto">
      {/* Embers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full"
            style={{
              left: `${(i * 53) % 100}%`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              background: "oklch(0.75 0.2 55)",
              boxShadow: "0 0 8px oklch(0.72 0.19 45)",
              animation: `ember-float ${8 + (i % 5)}s linear ${i * 0.7}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="text-center py-6">
        <h1 className="text-4xl md:text-5xl font-display font-black tracking-widest text-gold-glow animate-flicker">
          ELDEN&nbsp;·&nbsp;HOLLOW
        </h1>
        <p className="text-muted-foreground italic mt-1">A roguelike of tarnished souls</p>
      </div>

      <div className="relative bg-parchment border border-[color:var(--gold)]/30 shadow-[0_0_60px_oklch(0.72_0.19_45/0.15)]">
        {screen === "play" && (
          <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-start gap-3 font-display text-xs tracking-widest pointer-events-none">
            <div className="flex-1 space-y-1">
              <div>
                <div className="text-[color:var(--gold)]/80 mb-0.5">VIGOR</div>
                <div className="h-2 bg-black/60 border border-[color:var(--gold)]/40 w-56">
                  <div
                    className="h-full transition-[width]"
                    style={{
                      width: `${(p.hp / p.maxHp) * 100}%`,
                      background: "linear-gradient(90deg, oklch(0.45 0.2 25), oklch(0.6 0.22 30))",
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="text-[color:var(--gold)]/80 mb-0.5">STAMINA</div>
                <div className="h-1.5 bg-black/60 border border-[color:var(--gold)]/40 w-44">
                  <div
                    className="h-full"
                    style={{
                      width: `${(p.stamina / p.maxStamina) * 100}%`,
                      background: "linear-gradient(90deg, oklch(0.5 0.1 130), oklch(0.65 0.12 130))",
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-gold-glow text-sm">◆ {p.runes} runes</div>
              <div className="text-[color:var(--rune)]/90">Depth {state.current.depth}</div>
              <div className="text-[color:var(--rune)]/90">Rooms {state.current.roomsCleared}</div>
              <div className="text-[color:var(--gold)]/90">Great Runes: {p.relics}/3</div>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block w-full h-auto cursor-crosshair"
          style={{ imageRendering: "pixelated" }}
        />

        {screen !== "play" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-center px-6">
            {screen === "title" && (
              <>
                <h2 className="font-display text-3xl md:text-4xl text-gold-glow mb-3 tracking-widest">
                  RISE, TARNISHED
                </h2>
                <p className="italic text-muted-foreground max-w-md mb-6">
                  The Lands Between crumble beneath a shattered ring. Descend the crypt, slay three
                  Lords, and reclaim your Great Runes — or become another hollow among the graves.
                </p>
                <button
                  onClick={() => {
                    reset();
                    setScreen("play");
                  }}
                  className="font-display tracking-[0.3em] text-sm px-8 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 hover:text-gold-glow transition-all"
                >
                  ◆ TOUCH GRACE ◆
                </button>
                <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-1 text-xs font-display tracking-widest text-muted-foreground">
                  <div>WASD / ARROWS</div><div>MOVE</div>
                  <div>LEFT CLICK</div><div>STRIKE</div>
                  <div>SPACE</div><div>FLAME SORCERY</div>
                  <div>SHIFT</div><div>DODGE ROLL</div>
                </div>
              </>
            )}
            {screen === "dead" && (
              <>
                <h2 className="font-display text-5xl md:text-6xl mb-4 tracking-[0.3em]" style={{ color: "oklch(0.55 0.22 25)", textShadow: "0 0 20px oklch(0.45 0.2 25)" }}>
                  YOU DIED
                </h2>
                <p className="italic text-muted-foreground mb-2">
                  Reached depth {state.current.depth} · {state.current.roomsCleared} rooms · {p.runes} runes
                </p>
                <p className="italic text-[color:var(--gold)]/70 mb-6 max-w-md">
                  "The flame of ambition ever flickers, Tarnished..."
                </p>
                <button
                  onClick={() => {
                    reset();
                    setScreen("play");
                  }}
                  className="font-display tracking-[0.3em] text-sm px-8 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 transition-all"
                >
                  ◆ RETURN TO GRACE ◆
                </button>
              </>
            )}
            {screen === "victory" && (
              <>
                <h2 className="font-display text-4xl md:text-5xl text-gold-glow mb-4 tracking-widest animate-flicker">
                  ELDEN LORD
                </h2>
                <p className="italic text-muted-foreground max-w-md mb-6">
                  Three Great Runes reclaimed. The shattered ring mends in your grasp. The age of the
                  Tarnished begins.
                </p>
                <button
                  onClick={() => {
                    reset();
                    setScreen("play");
                  }}
                  className="font-display tracking-[0.3em] text-sm px-8 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 transition-all"
                >
                  ◆ BEGIN NEW JOURNEY ◆
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground italic mt-4 tracking-wider">
        Every death forges a stronger tarnished. Every rune, a whisper of a fallen lord.
      </p>
    </div>
  );
}
