// Biomes — 5 palettes and weather styles selected by depth.

export type WeatherKind = "rain" | "petal" | "snow" | "mist" | "ash" | "none";

export type Biome = {
  id: string;
  name: string;
  epithet: string;
  floor: string;       // main floor color
  floorAlt: string;    // secondary tile pattern
  wall: string;
  wallHi: string;
  fog: string;         // radial vignette outer color
  accent: string;      // door / accent glow
  weather: WeatherKind;
  weatherColor: string;
  music: "calm" | "rot" | "arcane" | "cold" | "storm";
};

export const BIOMES: Biome[] = [
  {
    id: "limgrave",
    name: "Limgrave",
    epithet: "Fields Beneath the Erdtree",
    floor: "oklch(0.18 0.03 130)",
    floorAlt: "oklch(0.24 0.05 130)",
    wall: "oklch(0.22 0.03 120)",
    wallHi: "oklch(0.32 0.05 120)",
    fog: "oklch(0.08 0.02 140)",
    accent: "oklch(0.75 0.15 120)",
    weather: "rain",
    weatherColor: "oklch(0.7 0.05 220 / 0.55)",
    music: "calm",
  },
  {
    id: "caelid",
    name: "Caelid",
    epithet: "Land of Scarlet Rot",
    floor: "oklch(0.18 0.06 25)",
    floorAlt: "oklch(0.28 0.10 25)",
    wall: "oklch(0.24 0.07 25)",
    wallHi: "oklch(0.38 0.12 25)",
    fog: "oklch(0.10 0.04 25)",
    accent: "oklch(0.72 0.19 30)",
    weather: "ash",
    weatherColor: "oklch(0.65 0.18 30 / 0.55)",
    music: "rot",
  },
  {
    id: "liurnia",
    name: "Liurnia of the Lakes",
    epithet: "Academy Under the Moon",
    floor: "oklch(0.16 0.03 250)",
    floorAlt: "oklch(0.22 0.06 250)",
    wall: "oklch(0.22 0.04 250)",
    wallHi: "oklch(0.34 0.07 250)",
    fog: "oklch(0.08 0.03 250)",
    accent: "oklch(0.75 0.15 250)",
    weather: "mist",
    weatherColor: "oklch(0.75 0.08 260 / 0.35)",
    music: "arcane",
  },
  {
    id: "mountaintops",
    name: "Mountaintops of the Giants",
    epithet: "Where the Flame Sleeps",
    floor: "oklch(0.22 0.015 220)",
    floorAlt: "oklch(0.32 0.02 220)",
    wall: "oklch(0.30 0.02 220)",
    wallHi: "oklch(0.45 0.03 220)",
    fog: "oklch(0.12 0.02 220)",
    accent: "oklch(0.85 0.05 220)",
    weather: "snow",
    weatherColor: "oklch(0.95 0.01 220 / 0.75)",
    music: "cold",
  },
  {
    id: "farum_azula",
    name: "Crumbling Farum Azula",
    epithet: "City Beyond Time",
    floor: "oklch(0.16 0.03 70)",
    floorAlt: "oklch(0.22 0.06 70)",
    wall: "oklch(0.24 0.05 70)",
    wallHi: "oklch(0.42 0.10 70)",
    fog: "oklch(0.08 0.02 70)",
    accent: "oklch(0.85 0.15 70)",
    weather: "petal",
    weatherColor: "oklch(0.82 0.15 75 / 0.65)",
    music: "storm",
  },
];

// Progression: 3 rooms per depth level → biome cycles across depth.
export function biomeForDepth(depth: number): Biome {
  const idx = Math.min(BIOMES.length - 1, Math.floor((depth - 1) / 3));
  return BIOMES[idx];
}

export type WeatherParticle = { x: number; y: number; vx: number; vy: number; life: number; kind: WeatherKind };

export function spawnWeather(list: WeatherParticle[], b: Biome, W: number, H: number) {
  if (b.weather === "none") return;
  if (list.length > 240) return;
  const kind = b.weather;
  const spawns = kind === "mist" ? 1 : kind === "rain" ? 3 : 2;
  for (let i = 0; i < spawns; i++) {
    if (kind === "rain") list.push({ x: Math.random() * W, y: -10, vx: -1.5, vy: 12, life: 60, kind });
    else if (kind === "snow") list.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 1.2, vy: 1.4 + Math.random(), life: 200, kind });
    else if (kind === "ash") list.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 0.8, vy: 0.6 + Math.random() * 0.8, life: 260, kind });
    else if (kind === "petal") list.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 2.2, vy: 1.2 + Math.random() * 0.8, life: 220, kind });
    else if (kind === "mist") list.push({ x: Math.random() * W, y: H - 40 - Math.random() * 100, vx: 0.4 + Math.random() * 0.6, vy: 0, life: 300, kind });
  }
}

export function stepWeather(list: WeatherParticle[], dt: number, W: number, H: number) {
  for (const w of list) {
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    w.life -= dt;
    if (w.x > W + 20) w.x = -20;
    if (w.x < -30) w.x = W + 20;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].life <= 0 || list[i].y > H + 20) list.splice(i, 1);
  }
}

export function renderWeather(ctx: CanvasRenderingContext2D, list: WeatherParticle[], color: string) {
  for (const w of list) {
    ctx.fillStyle = color;
    if (w.kind === "rain") {
      ctx.fillRect(w.x, w.y, 1.4, 8);
    } else if (w.kind === "snow") {
      ctx.beginPath(); ctx.arc(w.x, w.y, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (w.kind === "ash") {
      ctx.beginPath(); ctx.arc(w.x, w.y, 1.2 + Math.sin(w.life / 6) * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (w.kind === "petal") {
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.life * 0.05);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (w.kind === "mist") {
      ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(w.x, w.y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
