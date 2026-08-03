import { useState } from "react";
import { BESTIARY } from "@/lib/bestiary";
import { ENEMY_DEFS, EnemyKind, RARITY_COLOR } from "@/lib/gameData";
import { sfx } from "@/lib/audio";

const FILTERS = ["all", "common", "boss", "discovered"] as const;

export default function CodexPanel({
  bestiary,
  killedBosses,
  onClose,
}: {
  bestiary: Record<string, number>;
  killedBosses: string[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("all");
  const [selected, setSelected] = useState<EnemyKind | null>(null);

  const kinds = Object.keys(BESTIARY) as EnemyKind[];
  const filtered = kinds.filter(k => {
    const def = ENEMY_DEFS[k];
    const discovered = (bestiary[k] ?? 0) > 0 || killedBosses.includes(k);
    if (filter === "discovered") return discovered;
    if (filter === "boss") return def.isBoss;
    if (filter === "common") return !def.isBoss;
    return true;
  });

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm p-6 z-20 grid grid-cols-[1fr_300px] gap-5">
      <div className="flex flex-col">
        <div className="flex justify-between items-baseline mb-4">
          <div>
            <div className="font-display text-2xl tracking-[0.25em] text-gold-glow">CODEX OF THE TARNISHED</div>
            <div className="text-[10px] text-muted-foreground italic">Entries unlock as you fell the creatures of the Lands Between.</div>
          </div>
          <button onClick={onClose} className="text-xs tracking-widest text-[color:var(--gold)]/70 hover:text-[color:var(--gold)]">[ESC / J] CLOSE</button>
        </div>

        <div className="flex gap-2 mb-4">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); sfx("menu"); }}
              className={`text-[10px] uppercase tracking-widest px-3 py-1 border transition-all ${filter === f ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-gold-glow" : "border-[color:var(--gold)]/25 text-muted-foreground hover:border-[color:var(--gold)]/60"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 flex-1 content-start">
          {filtered.map(k => {
            const def = ENEMY_DEFS[k];
            const entry = BESTIARY[k];
            const discovered = (bestiary[k] ?? 0) > 0 || killedBosses.includes(k);
            return (
              <button
                key={k}
                onClick={() => { setSelected(k); sfx("menu"); }}
                className={`border p-3 flex flex-col items-center gap-2 transition-all ${selected === k ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "border-[color:var(--gold)]/20 hover:border-[color:var(--gold)]/50"}`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: discovered ? `${def.color}33` : "oklch(0.2 0.01 60)",
                    border: `2px solid ${discovered ? def.color : "oklch(0.3 0.02 60)"}`,
                    boxShadow: discovered ? `0 0 14px ${def.color}55` : "none",
                    filter: discovered ? "none" : "grayscale(100%) brightness(0.5)",
                  }}
                >
                  <span className="text-xl">{def.isBoss ? "☠" : "◆"}</span>
                </div>
                <div className={`text-[10px] font-display tracking-widest text-center ${discovered ? "text-gold-glow" : "text-muted-foreground"}`}>
                  {discovered ? entry.name : "???"}
                </div>
                <div className="text-[9px] text-muted-foreground">Kills: {discovered ? (bestiary[k] ?? 0) : "—"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-l border-[color:var(--gold)]/20 pl-5">
        <div className="font-display text-xs tracking-widest text-[color:var(--gold)]/70 mb-2">ENTRY</div>
        {selected ? (
          (() => {
            const def = ENEMY_DEFS[selected];
            const entry = BESTIARY[selected];
            const discovered = (bestiary[selected] ?? 0) > 0 || killedBosses.includes(selected);
            return (
              <div>
                <div className="font-display text-xl text-gold-glow mb-1">{discovered ? entry.name : "???"}</div>
                <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: def.color }}>{discovered ? entry.epithet : "Unknown"}</div>
                <div className="text-xs text-muted-foreground italic mb-4 leading-relaxed">{discovered ? entry.lore : "Defeat this creature to reveal its lore."}</div>
                {discovered && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-[color:var(--border)] py-1"><span className="text-[color:var(--gold)]/70">HP</span><span>{def.hp}</span></div>
                    <div className="flex justify-between border-b border-[color:var(--border)] py-1"><span className="text-[color:var(--gold)]/70">Damage</span><span>{def.dmg}</span></div>
                    <div className="flex justify-between border-b border-[color:var(--border)] py-1"><span className="text-[color:var(--gold)]/70">Runes</span><span>{def.runes.toLocaleString()}</span></div>
                    <div className="flex justify-between border-b border-[color:var(--border)] py-1"><span className="text-[color:var(--gold)]/70">Type</span><span>{def.isBoss ? "Great Enemy" : "Common"}</span></div>
                    {def.isBoss && (
                      <div className="mt-3 text-[10px] uppercase tracking-widest" style={{ color: RARITY_COLOR.unique }}>Great Rune Bearer</div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="text-xs italic text-muted-foreground">Select an entry to inspect.</div>
        )}
      </div>
    </div>
  );
}
