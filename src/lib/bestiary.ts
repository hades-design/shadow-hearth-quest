// Bestiary lore — one entry per EnemyKind. Unlocked when the player kills at least one.

export type BestiaryEntry = {
  name: string;
  epithet: string;
  lore: string;
};

export const BESTIARY: Record<string, BestiaryEntry> = {
  hollow: {
    name: "Hollow Wretch",
    epithet: "Vessel Emptied of Grace",
    lore:
      "Once tarnished pilgrims who chased the Great Runes too long, these husks now shuffle the crypts, driven only by the echo of a name they no longer own.",
  },
  beast: {
    name: "Rotwing Beast",
    epithet: "Hound of the Scarlet Wood",
    lore:
      "Wolves and lesser hounds that fed on Malenia's blooming affliction. Their eyes still weep petals of rot.",
  },
  wraith: {
    name: "Glintstone Wraith",
    epithet: "Sorcerous Remnant",
    lore:
      "Sorcerers of Raya Lucaria whose flesh burned away long before their spellbooks did. They cast on instinct, unaware they are already ash.",
  },
  knight: {
    name: "Banished Knight",
    epithet: "Exile of Farum Azula",
    lore:
      "Sworn to a lord who fell to dust, these knights keep to their oaths out of stubborn habit alone.",
  },
  grafted_scion: {
    name: "Grafted Scion",
    epithet: "The First Trial",
    lore:
      "A wretched welding of limbs and swords — a warm-up served to every tarnished at the crypt's mouth. It swings blindly and dies proudly.",
  },
  crucible_knight: {
    name: "Crucible Knight",
    epithet: "Keeper of the Primeval",
    lore:
      "Bearer of the Crucible's aspects — tail, wings, horns. In their armor lingers the memory of the old order, when life still had shape.",
  },
  margit: {
    name: "Margit, the Fell Omen",
    epithet: "Shabriri's Whisper",
    lore:
      "An omen shrouded in gold, cursing every step with hammers of light. Whispers a name that is not his own.",
  },
  godrick: {
    name: "Godrick the Grafted",
    epithet: "Lord of All That Is Golden",
    lore:
      "Last scion of a dying line. He grafts limbs and dragon-arms to himself out of desperate reverence for a heritage that has already passed him by.",
  },
  malenia: {
    name: "Malenia, Blade of Miquella",
    epithet: "Goddess of Rot",
    lore:
      "Undefeated in life, yet cursed with the Scarlet Rot from birth. Every bloom of her blade drinks life to sustain her.",
  },
  radahn: {
    name: "Starscourge Radahn",
    epithet: "General of the Redmane",
    lore:
      "He wrestled the stars themselves to a halt. Now Rot has taken his mind, but his gravity magic still bends the sky.",
  },
};
