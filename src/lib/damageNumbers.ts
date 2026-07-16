// Floating combat text (damage numbers). Simple pool.

export type DmgKind = "phys" | "fire" | "magic" | "holy" | "heal" | "crit" | "rot" | "bleed";

export type DmgNumber = { x: number; y: number; vx: number; vy: number; life: number; text: string; kind: DmgKind };

const COLOR: Record<DmgKind, string> = {
  phys: "oklch(0.92 0.02 80)",
  fire: "oklch(0.80 0.19 45)",
  magic: "oklch(0.75 0.18 250)",
  holy: "oklch(0.90 0.13 85)",
  heal: "oklch(0.80 0.18 140)",
  crit: "oklch(0.88 0.20 60)",
  rot: "oklch(0.72 0.19 130)",
  bleed: "oklch(0.55 0.22 25)",
};

const pool: DmgNumber[] = [];

export function spawnDamage(list: DmgNumber[], x: number, y: number, amount: number, kind: DmgKind = "phys") {
  const n: DmgNumber = pool.pop() ?? { x: 0, y: 0, vx: 0, vy: 0, life: 0, text: "", kind: "phys" };
  n.x = x + (Math.random() - 0.5) * 12;
  n.y = y - 12;
  n.vx = (Math.random() - 0.5) * 1.2;
  n.vy = -1.4 - Math.random() * 0.6;
  n.life = 45;
  n.text = kind === "heal" ? `+${Math.max(1, Math.round(amount))}` : `${Math.max(1, Math.round(amount))}`;
  n.kind = kind;
  list.push(n);
}

export function stepDamage(list: DmgNumber[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    n.x += n.vx * dt; n.y += n.vy * dt;
    n.vy += 0.05 * dt;
    n.life -= dt;
    if (n.life <= 0) {
      pool.push(n);
      list.splice(i, 1);
    }
  }
}

export function renderDamage(ctx: CanvasRenderingContext2D, list: DmgNumber[]) {
  for (const n of list) {
    const alpha = Math.max(0, Math.min(1, n.life / 30));
    const big = n.kind === "crit";
    ctx.font = big ? "bold 20px 'Cinzel', serif" : "600 13px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillText(n.text, n.x + 1, n.y + 1);
    ctx.fillStyle = COLOR[n.kind];
    if (big) { ctx.shadowColor = COLOR[n.kind]; ctx.shadowBlur = 14; }
    ctx.fillText(n.text, n.x, n.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}
