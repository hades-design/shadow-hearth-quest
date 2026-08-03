import { useState } from "react";
import {
  type Profile,
  type HubUpgradeId,
  HUB_UPGRADES,
  hubCost,
  purchaseHub,
} from "@/lib/save";
import { CLASSES, ClassId, ITEMS } from "@/lib/gameData";
import { sfx } from "@/lib/audio";

const NPCS = [
  {
    id: "smith" as const,
    name: "Smith Hewg",
    title: "Roundtable Smith",
    icon: "⚒",
    color: "oklch(0.75 0.12 55)",
    desc: "Reinforce the body with runes forged from fallen lords.",
  },
  {
    id: "witch" as const,
    name: "Finger Witch",
    title: "Reader of the Outer Gods",
    icon: "✦",
    color: "oklch(0.7 0.16 290)",
    desc: "Expand the pool of boons and bend rarity toward your favor.",
  },
  {
    id: "maiden" as const,
    name: "Finger Maiden",
    title: "Guide of the Tarnished",
    icon: "☽",
    color: "oklch(0.85 0.12 85)",
    desc: "Unlock forgotten keepsakes for future pilgrimages.",
  },
];

const CLASS_UNLOCK_COST: Record<ClassId, number> = {
  vagabond: 0,
  warrior: 0,
  astrologer: 0,
  prophet: 0,
  samurai: 600,
  bandit: 800,
};

export default function HubPanel({
  profile,
  onPurchase,
  onClose,
  onStartRun,
}: {
  profile: Profile;
  onPurchase: (id: HubUpgradeId) => void;
  onClose: () => void;
  onStartRun: () => void;
}) {
  const [tab, setTab] = useState<"smith" | "witch" | "maiden">("smith");
  const [unlockSet, setUnlockSet] = useState(() => new Set(profile.unlockedClasses ?? []));

  const buyUpgrade = (id: HubUpgradeId) => {
    if (purchaseHub(profile, id)) {
      sfx("upgrade");
      onPurchase(id);
    } else {
      sfx("menu");
    }
  };

  const unlockClass = (clsId: ClassId) => {
    const cost = CLASS_UNLOCK_COST[clsId];
    if (unlockSet.has(clsId) || profile.lostRunes < cost) {
      sfx("menu");
      return;
    }
    profile.lostRunes -= cost;
    const next = new Set(unlockSet);
    next.add(clsId);
    setUnlockSet(next);
    profile.unlockedClasses = [...next];
    sfx("level_up");
    onPurchase("hp"); // trigger save via parent
  };

  return (
    <div className="absolute inset-0 bg-black/92 backdrop-blur-md p-6 z-20 flex flex-col">
      <div className="text-center mb-4">
        <h2 className="font-display text-3xl md:text-4xl text-gold-glow tracking-[0.3em]">ROUND TABLE HOLD</h2>
        <p className="italic text-muted-foreground text-sm">A refuge between deaths. Spend Runas Perdidas to grow stronger.</p>
        <div className="mt-2 text-gold-glow font-display tracking-widest">◆ {profile.lostRunes.toLocaleString()} lost runes</div>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {NPCS.map(npc => (
          <button
            key={npc.id}
            onClick={() => { setTab(npc.id); sfx("menu"); }}
            className={`border px-5 py-3 flex items-center gap-3 transition-all ${tab === npc.id ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "border-[color:var(--gold)]/25 hover:border-[color:var(--gold)]/60"}`}
          >
            <span className="text-2xl" style={{ color: npc.color, textShadow: `0 0 10px ${npc.color}` }}>{npc.icon}</span>
            <div className="text-left">
              <div className="font-display text-xs tracking-widest" style={{ color: npc.color }}>{npc.name.toUpperCase()}</div>
              <div className="text-[10px] text-muted-foreground">{npc.title}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 border border-[color:var(--gold)]/20 p-5 relative overflow-hidden">
        {tab === "smith" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {HUB_UPGRADES.map(u => {
              const cost = hubCost(profile, u.id);
              const level = Math.floor((profile.hub[u.stat as keyof Profile["hub"]] ?? 0) / u.inc);
              return (
                <button
                  key={u.id}
                  onClick={() => buyUpgrade(u.id)}
                  disabled={profile.lostRunes < cost}
                  className="border border-[color:var(--gold)]/30 hover:border-[color:var(--gold)]/70 bg-black/50 p-4 text-left transition-all disabled:opacity-40"
                >
                  <div className="font-display text-sm text-gold-glow mb-1">{u.label}</div>
                  <div className="text-[10px] text-muted-foreground mb-3">Level {level}</div>
                  <div className="text-xs">Cost: <span className={profile.lostRunes >= cost ? "text-gold-glow" : "text-destructive"}>{cost.toLocaleString()} runes</span></div>
                </button>
              );
            })}
          </div>
        )}

        {tab === "witch" && (
          <div className="text-center max-w-xl mx-auto">
            <div className="text-6xl mb-4" style={{ color: NPCS[1].color, textShadow: `0 0 30px ${NPCS[1].color}` }}>✦</div>
            <h3 className="font-display text-xl text-gold-glow mb-2">Boon Expansion</h3>
            <p className="text-sm text-muted-foreground mb-6">The Outer Gods offer more blessings to those who pay tribute.</p>
            <button
              onClick={() => {
                if (profile.lostRunes >= 400) {
                  profile.lostRunes -= 400;
                  profile.boonRarityBoost = (profile.boonRarityBoost ?? 0) + 0.05;
                  sfx("upgrade");
                  onPurchase("hp");
                } else sfx("menu");
              }}
              disabled={profile.lostRunes < 400}
              className="font-display tracking-[0.25em] text-xs px-8 py-3 border border-[color:var(--gold)]/70 text-[color:var(--gold)] disabled:opacity-40 hover:bg-[color:var(--gold)]/10"
            >
              +5% BOON RARITY — 400 RUNES
            </button>
            <div className="mt-4 text-xs text-muted-foreground">Current boost: +{Math.round((profile.boonRarityBoost ?? 0) * 100)}%</div>
          </div>
        )}

        {tab === "maiden" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {CLASSES.filter(c => c.id !== "vagabond").map(cls => {
              const unlocked = unlockSet.has(cls.id);
              const cost = CLASS_UNLOCK_COST[cls.id];
              return (
                <button
                  key={cls.id}
                  onClick={() => unlockClass(cls.id)}
                  disabled={unlocked}
                  className={`border p-4 flex flex-col items-center gap-2 transition-all ${unlocked ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "border-[color:var(--gold)]/30 hover:border-[color:var(--gold)]/60"}`}
                >
                  <div className="text-3xl font-display" style={{ color: cls.accent, textShadow: `0 0 12px ${cls.accent}` }}>{cls.sigil}</div>
                  <div className="font-display text-xs tracking-widest text-[color:var(--gold)]/90">{cls.name.toUpperCase()}</div>
                  <div className="text-[10px] text-muted-foreground italic text-center">{ITEMS[cls.startingWeapon].name}</div>
                  <div className="text-xs mt-1">{unlocked ? "UNLOCKED" : `${cost} runes`}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-4 mt-6">
        <button onClick={onClose} className="font-display tracking-[0.3em] text-xs px-6 py-3 border border-[color:var(--gold)]/40 hover:border-[color:var(--gold)]">◄ BACK</button>
        <button onClick={() => { sfx("menu"); onStartRun(); }} className="font-display tracking-[0.3em] text-xs px-10 py-3 border border-[color:var(--gold)]/80 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10">◆ EMBARK ◆</button>
      </div>
    </div>
  );
}
