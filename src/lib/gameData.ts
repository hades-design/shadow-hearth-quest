// ==========================================================================
// Game Data — classes, items, skills, enemies
// ==========================================================================

export type StatKey = "vig" | "end" | "str" | "dex" | "int" | "fth";

export type Stats = Record<StatKey, number>;

export const STAT_LABEL: Record<StatKey, string> = {
  vig: "Vigor",
  end: "Endurance",
  str: "Strength",
  dex: "Dexterity",
  int: "Intelligence",
  fth: "Faith",
};

export type ClassId = "warrior" | "astrologer" | "prophet" | "samurai" | "bandit" | "vagabond";

export type ClassDef = {
  id: ClassId;
  name: string;
  title: string;
  tagline: string;
  scaling: StatKey;
  stats: Stats;
  startingWeapon: string;
  startingArmor: string;
  ability: {
    key: "flame" | "glintstone" | "heal" | "throw" | "backstab" | "warcry";
    name: string;
    desc: string;
    fpCost: number;
  };
  accent: string; // oklch
  sigil: string; // small svg-like glyph
};

export const CLASSES: ClassDef[] = [
  {
    id: "vagabond",
    name: "Vagabond",
    title: "Fallen Knight",
    tagline: "A knight from a foreign land. Balanced strength and steel.",
    scaling: "str",
    stats: { vig: 15, end: 11, str: 14, dex: 13, int: 9, fth: 9 },
    startingWeapon: "longsword",
    startingArmor: "knight_mail",
    ability: {
      key: "warcry",
      name: "War Cry",
      desc: "Bellow to stagger nearby foes and boost damage briefly.",
      fpCost: 20,
    },
    accent: "oklch(0.75 0.05 80)",
    sigil: "◈",
  },
  {
    id: "warrior",
    name: "Warrior",
    title: "Blade of the Storm",
    tagline: "A wanderer who lives by the twin blades. Fast, ruthless.",
    scaling: "dex",
    stats: { vig: 11, end: 16, str: 10, dex: 16, int: 8, fth: 8 },
    startingWeapon: "twin_scimitars",
    startingArmor: "leather_wraps",
    ability: {
      key: "warcry",
      name: "Storm Assault",
      desc: "A blistering double strike that ignores armor.",
      fpCost: 15,
    },
    accent: "oklch(0.7 0.15 30)",
    sigil: "⚔",
  },
  {
    id: "astrologer",
    name: "Astrologer",
    title: "Reader of the Stars",
    tagline: "A scholar of the primeval current. Wields glintstone sorcery.",
    scaling: "int",
    stats: { vig: 9, end: 9, str: 8, dex: 12, int: 16, fth: 7 },
    startingWeapon: "glintstone_staff",
    startingArmor: "starlight_robe",
    ability: {
      key: "glintstone",
      name: "Glintstone Pebble",
      desc: "Launches a shard of glintstone that pierces air and armor.",
      fpCost: 12,
    },
    accent: "oklch(0.65 0.18 250)",
    sigil: "✦",
  },
  {
    id: "prophet",
    name: "Prophet",
    title: "Seer of a Ruinous Future",
    tagline: "Blind to the world, sighted in flame. Wields incantations.",
    scaling: "fth",
    stats: { vig: 10, end: 8, str: 11, dex: 10, int: 7, fth: 16 },
    startingWeapon: "prophet_staff",
    startingArmor: "veil_robe",
    ability: {
      key: "heal",
      name: "Urgent Heal",
      desc: "A whispered prayer restores a portion of your vigor.",
      fpCost: 30,
    },
    accent: "oklch(0.75 0.14 55)",
    sigil: "✧",
  },
  {
    id: "samurai",
    name: "Samurai",
    title: "Land of Reeds Wanderer",
    tagline: "An unfamiliar warrior. Bleed strikes and thrown steel.",
    scaling: "dex",
    stats: { vig: 12, end: 13, str: 12, dex: 15, int: 9, fth: 8 },
    startingWeapon: "uchigatana",
    startingArmor: "ronin_plate",
    ability: {
      key: "throw",
      name: "Throwing Knife",
      desc: "Hurls a light blade. Inflicts bleed on repeated hits.",
      fpCost: 8,
    },
    accent: "oklch(0.7 0.12 15)",
    sigil: "◆",
  },
  {
    id: "bandit",
    name: "Bandit",
    title: "Cutpurse of the Weeping",
    tagline: "A stalker of the weeping peninsula. Strikes from shadow.",
    scaling: "dex",
    stats: { vig: 10, end: 13, str: 9, dex: 16, int: 9, fth: 8 },
    startingWeapon: "great_knife",
    startingArmor: "bandit_garb",
    ability: {
      key: "backstab",
      name: "Shadow Step",
      desc: "Dash through foes; the next strike critically wounds.",
      fpCost: 15,
    },
    accent: "oklch(0.55 0.05 30)",
    sigil: "☾",
  },
];

// ==========================================================================
// Items — weapons, armor, talismans
// ==========================================================================

export type ItemKind = "weapon" | "armor" | "talisman";
export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "unique";

export type Item = {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  bonus: Partial<Stats>;
  dmg?: number;
  weight?: number;
  desc: string;
  scaling?: StatKey;
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "oklch(0.7 0.02 70)",
  uncommon: "oklch(0.7 0.14 140)",
  rare: "oklch(0.7 0.15 240)",
  legendary: "oklch(0.78 0.16 60)",
  unique: "oklch(0.7 0.2 320)",
};

export const ITEMS: Record<string, Item> = {
  // starter weapons
  longsword: { id: "longsword", name: "Longsword", kind: "weapon", rarity: "common", bonus: { str: 2 }, dmg: 22, desc: "A knight's straight blade. Balanced and reliable.", scaling: "str" },
  twin_scimitars: { id: "twin_scimitars", name: "Twin Scimitars", kind: "weapon", rarity: "common", bonus: { dex: 2 }, dmg: 18, desc: "Paired curved blades of the wanderer.", scaling: "dex" },
  glintstone_staff: { id: "glintstone_staff", name: "Glintstone Staff", kind: "weapon", rarity: "common", bonus: { int: 3 }, dmg: 10, desc: "Focus for glintstone sorceries.", scaling: "int" },
  prophet_staff: { id: "prophet_staff", name: "Finger Seal", kind: "weapon", rarity: "common", bonus: { fth: 3 }, dmg: 10, desc: "The seal by which incantations are cast.", scaling: "fth" },
  uchigatana: { id: "uchigatana", name: "Uchigatana", kind: "weapon", rarity: "uncommon", bonus: { dex: 3 }, dmg: 24, desc: "Curved blade from a distant land. Inflicts bleed.", scaling: "dex" },
  great_knife: { id: "great_knife", name: "Great Knife", kind: "weapon", rarity: "common", bonus: { dex: 2 }, dmg: 20, desc: "A cruel dagger, cold to the touch.", scaling: "dex" },
  // dungeon drops
  claymore: { id: "claymore", name: "Claymore", kind: "weapon", rarity: "uncommon", bonus: { str: 4 }, dmg: 32, desc: "Heavy two-hander of the Erdtree wardens.", scaling: "str" },
  flamberge: { id: "flamberge", name: "Flamberge", kind: "weapon", rarity: "rare", bonus: { str: 5, dex: 2 }, dmg: 38, desc: "Rippled blade — every strike scores flesh.", scaling: "str" },
  moonveil: { id: "moonveil", name: "Moonveil", kind: "weapon", rarity: "legendary", bonus: { int: 6, dex: 3 }, dmg: 34, desc: "Katana wreathed in cold moonlight.", scaling: "int" },
  blasphemous_blade: { id: "blasphemous_blade", name: "Blasphemous Blade", kind: "weapon", rarity: "legendary", bonus: { str: 4, fth: 5 }, dmg: 40, desc: "Forged from the corpse of a Fell God.", scaling: "fth" },
  dark_moon_greatsword: { id: "dark_moon_greatsword", name: "Dark Moon Greatsword", kind: "weapon", rarity: "unique", bonus: { int: 8, str: 3 }, dmg: 44, desc: "Waning moon distilled into steel.", scaling: "int" },
  // armors
  knight_mail: { id: "knight_mail", name: "Knight Mail", kind: "armor", rarity: "common", bonus: { vig: 3, end: 1 }, desc: "Well-worn mail of a lost order.", weight: 6 },
  leather_wraps: { id: "leather_wraps", name: "Warrior Wraps", kind: "armor", rarity: "common", bonus: { end: 3, dex: 1 }, desc: "Cloth bindings, easy to move in.", weight: 2 },
  starlight_robe: { id: "starlight_robe", name: "Starlight Robe", kind: "armor", rarity: "common", bonus: { int: 2, end: 1 }, desc: "Robes stitched with a pattern of stars.", weight: 3 },
  veil_robe: { id: "veil_robe", name: "Veil of the Prophet", kind: "armor", rarity: "common", bonus: { fth: 2, vig: 1 }, desc: "Ragged mantle of an unheard prophet.", weight: 3 },
  ronin_plate: { id: "ronin_plate", name: "Ronin Plate", kind: "armor", rarity: "uncommon", bonus: { vig: 2, dex: 2 }, desc: "Lacquered plate from the Land of Reeds.", weight: 4 },
  bandit_garb: { id: "bandit_garb", name: "Bandit Garb", kind: "armor", rarity: "common", bonus: { dex: 3 }, desc: "Torn cloth reeking of pine.", weight: 2 },
  crucible_plate: { id: "crucible_plate", name: "Crucible Tree Plate", kind: "armor", rarity: "rare", bonus: { vig: 5, str: 2, fth: 2 }, desc: "Plate blessed by primordial life.", weight: 8 },
  radahn_pauldrons: { id: "radahn_pauldrons", name: "Starscourge Pauldrons", kind: "armor", rarity: "legendary", bonus: { vig: 4, str: 4, end: 3 }, desc: "Shoulders that once held aloft two moons.", weight: 7 },
  malenia_veil: { id: "malenia_veil", name: "Blade's Veil", kind: "armor", rarity: "legendary", bonus: { dex: 6, vig: 3 }, desc: "Veil once soaked in rot, now stilled.", weight: 3 },
  // talismans
  radagon_seal: { id: "radagon_seal", name: "Radagon's Scarseal", kind: "talisman", rarity: "rare", bonus: { vig: 3, end: 3, str: 3, dex: 3 }, desc: "Raises all attributes, but you take more damage." },
  crimson_amber: { id: "crimson_amber", name: "Crimson Amber Medallion", kind: "talisman", rarity: "uncommon", bonus: { vig: 5 }, desc: "Raises maximum HP." },
  green_turtle: { id: "green_turtle", name: "Green Turtle Talisman", kind: "talisman", rarity: "uncommon", bonus: { end: 5 }, desc: "Hastens stamina recovery." },
  graven_school: { id: "graven_school", name: "Graven-School Talisman", kind: "talisman", rarity: "rare", bonus: { int: 6 }, desc: "Raises sorcery might." },
  godfrey_icon: { id: "godfrey_icon", name: "Godfrey Icon", kind: "talisman", rarity: "legendary", bonus: { str: 4, dex: 4, fth: 2 }, desc: "Enhances charged skills. Worn by the first Lord." },
};

export const LOOT_TABLES = {
  common: ["longsword", "leather_wraps", "great_knife", "knight_mail", "crimson_amber"],
  uncommon: ["claymore", "uchigatana", "ronin_plate", "green_turtle"],
  rare: ["flamberge", "crucible_plate", "graven_school", "radagon_seal"],
  legendary: ["moonveil", "blasphemous_blade", "radahn_pauldrons", "malenia_veil", "godfrey_icon"],
  unique: ["dark_moon_greatsword"],
};

// ==========================================================================
// Skill Tree
// ==========================================================================

export type SkillBranch = "warrior" | "sorcery" | "faith" | "core";
export type Skill = {
  id: string;
  name: string;
  branch: SkillBranch;
  tier: number; // 0..4
  col: number; // -2..2 relative to branch center
  desc: string;
  cost: number;
  requires?: string[];
  apply: (m: SkillMods) => void;
};

export type SkillMods = {
  hpMul: number;
  staminaMul: number;
  fpMul: number;
  dmgMul: number;
  spellDmgMul: number;
  moveSpeed: number;
  dodgeCost: number;
  bleedChance: number;
  lifesteal: number;
  fpRegen: number;
  critChance: number;
  spellCostMul: number;
  passiveHeal: number;
};

export const defaultMods = (): SkillMods => ({
  hpMul: 1, staminaMul: 1, fpMul: 1, dmgMul: 1, spellDmgMul: 1,
  moveSpeed: 1, dodgeCost: 1, bleedChance: 0, lifesteal: 0,
  fpRegen: 0, critChance: 0.05, spellCostMul: 1, passiveHeal: 0,
});

export const SKILLS: Skill[] = [
  // CORE
  { id: "grace_1", name: "Touch of Grace", branch: "core", tier: 0, col: 0, desc: "+10% max HP.", cost: 1, apply: m => { m.hpMul *= 1.1; } },
  { id: "endurance_1", name: "Ironclad Vigor", branch: "core", tier: 1, col: -1, desc: "+15% stamina.", cost: 1, requires: ["grace_1"], apply: m => { m.staminaMul *= 1.15; } },
  { id: "swiftness", name: "Wind of Sotn", branch: "core", tier: 1, col: 1, desc: "+8% move speed.", cost: 1, requires: ["grace_1"], apply: m => { m.moveSpeed *= 1.08; } },
  { id: "regen", name: "Blessing of Dew", branch: "core", tier: 2, col: 0, desc: "Slowly recover HP.", cost: 2, requires: ["endurance_1", "swiftness"], apply: m => { m.passiveHeal += 0.02; } },
  { id: "grace_2", name: "Great Rune Sealed", branch: "core", tier: 3, col: 0, desc: "+15% HP, +15% FP.", cost: 3, requires: ["regen"], apply: m => { m.hpMul *= 1.15; m.fpMul *= 1.15; } },

  // WARRIOR
  { id: "w1", name: "Whetstone", branch: "warrior", tier: 0, col: 0, desc: "+10% weapon damage.", cost: 1, apply: m => { m.dmgMul *= 1.1; } },
  { id: "w2a", name: "Bloodletting", branch: "warrior", tier: 1, col: -1, desc: "Attacks apply Bleed.", cost: 1, requires: ["w1"], apply: m => { m.bleedChance += 0.25; } },
  { id: "w2b", name: "Roar of the Beast", branch: "warrior", tier: 1, col: 1, desc: "+15% damage, -10% dodge stamina.", cost: 1, requires: ["w1"], apply: m => { m.dmgMul *= 1.15; m.dodgeCost *= 0.9; } },
  { id: "w3a", name: "Crimson Feast", branch: "warrior", tier: 2, col: -1, desc: "6% lifesteal on hit.", cost: 2, requires: ["w2a"], apply: m => { m.lifesteal += 0.06; } },
  { id: "w3b", name: "Champion's Grip", branch: "warrior", tier: 2, col: 1, desc: "+10% crit chance.", cost: 2, requires: ["w2b"], apply: m => { m.critChance += 0.1; } },
  { id: "w4", name: "Lion's Claw", branch: "warrior", tier: 3, col: 0, desc: "+25% weapon damage.", cost: 3, requires: ["w3a", "w3b"], apply: m => { m.dmgMul *= 1.25; } },
  { id: "w5", name: "Godfrey's Ember", branch: "warrior", tier: 4, col: 0, desc: "Every kill restores 5 HP.", cost: 3, requires: ["w4"], apply: m => { m.lifesteal += 0.05; m.dmgMul *= 1.1; } },

  // SORCERY
  { id: "s1", name: "Glintstone Whetblade", branch: "sorcery", tier: 0, col: 0, desc: "+15% spell damage.", cost: 1, apply: m => { m.spellDmgMul *= 1.15; } },
  { id: "s2a", name: "Cerulean Well", branch: "sorcery", tier: 1, col: -1, desc: "FP slowly regenerates.", cost: 1, requires: ["s1"], apply: m => { m.fpRegen += 0.15; } },
  { id: "s2b", name: "Meteoric Focus", branch: "sorcery", tier: 1, col: 1, desc: "-15% spell cost.", cost: 1, requires: ["s1"], apply: m => { m.spellCostMul *= 0.85; } },
  { id: "s3a", name: "Full Moon", branch: "sorcery", tier: 2, col: -1, desc: "+25% spell damage.", cost: 2, requires: ["s2a"], apply: m => { m.spellDmgMul *= 1.25; } },
  { id: "s3b", name: "Terra Magica", branch: "sorcery", tier: 2, col: 1, desc: "+20% FP pool.", cost: 2, requires: ["s2b"], apply: m => { m.fpMul *= 1.2; } },
  { id: "s4", name: "Comet Azur", branch: "sorcery", tier: 3, col: 0, desc: "Massive spell power.", cost: 3, requires: ["s3a", "s3b"], apply: m => { m.spellDmgMul *= 1.4; } },
  { id: "s5", name: "Ranni's Dark Moon", branch: "sorcery", tier: 4, col: 0, desc: "Spells freeze foes briefly.", cost: 3, requires: ["s4"], apply: m => { m.spellDmgMul *= 1.15; m.critChance += 0.05; } },

  // FAITH
  { id: "f1", name: "Sacred Oath", branch: "faith", tier: 0, col: 0, desc: "+10% HP, +10% damage.", cost: 1, apply: m => { m.hpMul *= 1.1; m.dmgMul *= 1.1; } },
  { id: "f2a", name: "Flame, Cleanse Me", branch: "faith", tier: 1, col: -1, desc: "Slowly recover HP.", cost: 1, requires: ["f1"], apply: m => { m.passiveHeal += 0.04; } },
  { id: "f2b", name: "Golden Vow", branch: "faith", tier: 1, col: 1, desc: "+15% damage.", cost: 1, requires: ["f1"], apply: m => { m.dmgMul *= 1.15; } },
  { id: "f3a", name: "Blessing's Boon", branch: "faith", tier: 2, col: -1, desc: "8% lifesteal.", cost: 2, requires: ["f2a"], apply: m => { m.lifesteal += 0.08; } },
  { id: "f3b", name: "Erdtree Heal", branch: "faith", tier: 2, col: 1, desc: "+20% HP.", cost: 2, requires: ["f2b"], apply: m => { m.hpMul *= 1.2; } },
  { id: "f4", name: "Elden Stars", branch: "faith", tier: 3, col: 0, desc: "+30% spell damage.", cost: 3, requires: ["f3a", "f3b"], apply: m => { m.spellDmgMul *= 1.3; } },
  { id: "f5", name: "Radagon's Rings", branch: "faith", tier: 4, col: 0, desc: "+20% HP, +20% FP, +10% damage.", cost: 3, requires: ["f4"], apply: m => { m.hpMul *= 1.2; m.fpMul *= 1.2; m.dmgMul *= 1.1; } },
];

// ==========================================================================
// Enemies & Bosses
// ==========================================================================

export type EnemyKind =
  | "hollow" | "beast" | "wraith" | "knight"
  | "grafted_scion" | "crucible_knight" | "margit" | "godrick" | "malenia" | "radahn";

export type EnemyDef = {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  size: number;
  color: string;
  isBoss?: boolean;
  runes: number;
  attackKind: "melee" | "projectile" | "boss_grafted" | "boss_crucible" | "boss_margit" | "boss_godrick" | "boss_malenia" | "boss_radahn";
  desc?: string;
};

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  hollow: { kind: "hollow", name: "Wretch", hp: 30, speed: 1.1, dmg: 8, size: 14, color: "oklch(0.4 0.03 70)", runes: 15, attackKind: "melee" },
  beast: { kind: "beast", name: "Runebear Cub", hp: 45, speed: 1.7, dmg: 12, size: 17, color: "oklch(0.35 0.12 30)", runes: 25, attackKind: "melee" },
  wraith: { kind: "wraith", name: "Ancestral Wraith", hp: 30, speed: 0.9, dmg: 14, size: 15, color: "oklch(0.5 0.15 290)", runes: 30, attackKind: "projectile" },
  knight: { kind: "knight", name: "Hollow Knight", hp: 80, speed: 1.3, dmg: 18, size: 20, color: "oklch(0.3 0.05 260)", runes: 60, attackKind: "melee" },
  grafted_scion: { kind: "grafted_scion", name: "Grafted Scion", hp: 260, speed: 1.5, dmg: 22, size: 30, color: "oklch(0.4 0.09 15)", isBoss: true, runes: 400, attackKind: "boss_grafted", desc: "Its arms are many — none its own." },
  crucible_knight: { kind: "crucible_knight", name: "Crucible Knight", hp: 380, speed: 1.4, dmg: 26, size: 28, color: "oklch(0.42 0.06 60)", isBoss: true, runes: 700, attackKind: "boss_crucible", desc: "Warden of the primordial current." },
  margit: { kind: "margit", name: "Margit, the Fell Omen", hp: 520, speed: 1.7, dmg: 30, size: 30, color: "oklch(0.28 0.02 60)", isBoss: true, runes: 1200, attackKind: "boss_margit", desc: "Foul Tarnished, in search of the Elden Ring..." },
  godrick: { kind: "godrick", name: "Godrick the Grafted", hp: 780, speed: 1.5, dmg: 34, size: 34, color: "oklch(0.35 0.12 20)", isBoss: true, runes: 2400, attackKind: "boss_godrick", desc: "Lord of all that is Golden." },
  malenia: { kind: "malenia", name: "Malenia, Blade of Miquella", hp: 1000, speed: 2.1, dmg: 38, size: 28, color: "oklch(0.55 0.13 40)", isBoss: true, runes: 4800, attackKind: "boss_malenia", desc: "I dreamt for so long..." },
  radahn: { kind: "radahn", name: "Starscourge Radahn", hp: 1400, speed: 1.6, dmg: 44, size: 40, color: "oklch(0.45 0.15 50)", isBoss: true, runes: 8000, attackKind: "boss_radahn", desc: "Behold, the mighty Radahn!" },
};

export const BOSS_SEQUENCE: EnemyKind[] = ["grafted_scion", "crucible_knight", "margit", "godrick", "malenia", "radahn"];
