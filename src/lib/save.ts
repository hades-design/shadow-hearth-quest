// Persistent profile for Elden Hollow (localStorage-backed).
// Survives across runs and browser sessions. Versioned so we can migrate later.

import type { ClassId, EnemyKind } from "@/lib/gameData";

const KEY = "elden-hollow.save.v2";

export type Settings = {
  musicVol: number;   // 0..1
  sfxVol: number;     // 0..1
  brightness: number; // 0.6..1.4
  binds: {
    up: string; down: string; left: string; right: string;
    dodge: string; spell: string; ability: string; interact: string;
    inventory: string; skills: string; smith: string; codex: string; pause: string;
  };
};

export type Profile = {
  version: 2;
  lostRunes: number;              // persistent currency (meta)
  deaths: number;
  runsCompleted: number;
  bestDepth: number;
  totalPlaytimeMs: number;
  killedBosses: string[];         // EnemyKind[]
  bestiary: Record<string, number>; // enemyKind -> kills
  seenBiomes: string[];
  unlockedClasses: ClassId[];
  boonRarityBoost: number;        // 0..1 incremental
  hub: {
    hpBonus: number;              // +HP base flat
    fpBonus: number;
    staminaBonus: number;
    startingRunes: number;
    startingStones: number;
  };
  tutorialSeen: Record<string, boolean>;
  settings: Settings;
};

const DEFAULT_SETTINGS: Settings = {
  musicVol: 0.5, sfxVol: 0.5, brightness: 1.0,
  binds: {
    up: "w", down: "s", left: "a", right: "d",
    dodge: "shift", spell: " ", ability: "q", interact: "e",
    inventory: "i", skills: "k", smith: "u", codex: "j", pause: "escape",
  },
};

export function defaultProfile(): Profile {
  return {
    version: 2,
    lostRunes: 0, deaths: 0, runsCompleted: 0, bestDepth: 0, totalPlaytimeMs: 0,
    killedBosses: [], bestiary: {}, seenBiomes: [],
    unlockedClasses: ["vagabond", "warrior", "astrologer", "prophet"],
    boonRarityBoost: 0,
    hub: { hpBonus: 0, fpBonus: 0, staminaBonus: 0, startingRunes: 0, startingStones: 0 },
    tutorialSeen: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = JSON.parse(raw) as Partial<Profile>;
    if (!p || p.version !== 2) return defaultProfile();
    // fill any missing fields
    const base = defaultProfile();
    return {
      ...base, ...p,
      hub: { ...base.hub, ...(p.hub ?? {}) },
      bestiary: { ...(p.bestiary ?? {}) },
      tutorialSeen: { ...(p.tutorialSeen ?? {}) },
      settings: {
        ...base.settings, ...(p.settings ?? {}),
        binds: { ...base.settings.binds, ...(p.settings?.binds ?? {}) },
      },
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota / private mode */ }
}

export function recordKill(p: Profile, enemyKind: string) {
  p.bestiary[enemyKind] = (p.bestiary[enemyKind] ?? 0) + 1;
}

export function recordBossKill(p: Profile, kind: string) {
  if (!p.killedBosses.includes(kind)) p.killedBosses.push(kind);
}

export function tutorialSeen(p: Profile, id: string): boolean {
  return !!p.tutorialSeen[id];
}
export function markTutorialSeen(p: Profile, id: string) {
  p.tutorialSeen[id] = true;
}

// Hub upgrade costs — simple geometric progression
export const HUB_UPGRADES = [
  { id: "hp", label: "Fervor of Marika (+20 HP base)", stat: "hpBonus", inc: 20, baseCost: 200 },
  { id: "fp", label: "Astrologer's Insight (+15 FP base)", stat: "fpBonus", inc: 15, baseCost: 200 },
  { id: "st", label: "Endurance of the Tarnished (+15 Stamina)", stat: "staminaBonus", inc: 15, baseCost: 180 },
  { id: "runes", label: "Coffer of Grace (+300 starting runes)", stat: "startingRunes", inc: 300, baseCost: 250 },
  { id: "stone", label: "Merchant's Cache (+1 starting smithing stone)", stat: "startingStones", inc: 1, baseCost: 300 },
] as const;

export type HubUpgradeId = typeof HUB_UPGRADES[number]["id"];

export function hubCost(p: Profile, id: HubUpgradeId): number {
  const def = HUB_UPGRADES.find(u => u.id === id)!;
  const level = Math.floor((p.hub[def.stat as keyof Profile["hub"]] ?? 0) / def.inc);
  return Math.round(def.baseCost * Math.pow(1.6, level));
}

export function purchaseHub(p: Profile, id: HubUpgradeId): boolean {
  const cost = hubCost(p, id);
  if (p.lostRunes < cost) return false;
  const def = HUB_UPGRADES.find(u => u.id === id)!;
  p.lostRunes -= cost;
  (p.hub as Record<string, number>)[def.stat] += def.inc;
  return true;
}
