import { useState } from "react";
import { type Settings } from "@/lib/save";
import { sfx } from "@/lib/audio";

const BIND_ORDER: { key: keyof Settings["binds"]; label: string }[] = [
  { key: "up", label: "Move Up" },
  { key: "down", label: "Move Down" },
  { key: "left", label: "Move Left" },
  { key: "right", label: "Move Right" },
  { key: "dodge", label: "Dodge" },
  { key: "spell", label: "Sorcery" },
  { key: "ability", label: "Class Ability" },
  { key: "interact", label: "Interact" },
  { key: "inventory", label: "Inventory" },
  { key: "skills", label: "Skills" },
  { key: "smith", label: "Smith" },
  { key: "codex", label: "Codex" },
  { key: "pause", label: "Pause" },
];

export default function PausePanel({
  settings,
  onSettingsChange,
  onResume,
  onQuit,
}: {
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  onResume: () => void;
  onQuit: () => void;
}) {
  const [tab, setTab] = useState<"audio" | "controls">("audio");
  const [local, setLocal] = useState<Settings>({ ...settings, binds: { ...settings.binds } });
  const [listening, setListening] = useState<keyof Settings["binds"] | null>(null);

  const commit = (next: Settings) => {
    setLocal(next);
    onSettingsChange(next);
  };

  const listenFor = (k: keyof Settings["binds"]) => {
    setListening(k);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      const key = e.key.toLowerCase();
      const next = { ...local, binds: { ...local.binds, [k]: key } };
      commit(next);
      setListening(null);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("keydown", handler, { once: true });
  };

  return (
    <div className="absolute inset-0 bg-black/88 backdrop-blur-md p-6 z-30 flex items-center justify-center">
      <div className="w-full max-w-2xl border border-[color:var(--gold)]/30 bg-black/70 p-6">
        <div className="text-center mb-6">
          <h2 className="font-display text-3xl text-gold-glow tracking-[0.3em]">PAUSED</h2>
          <p className="text-xs text-muted-foreground italic mt-1">The Lands Between wait.</p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {(["audio", "controls"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); sfx("menu"); }}
              className={`text-[10px] uppercase tracking-widest px-4 py-2 border transition-all ${tab === t ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10 text-gold-glow" : "border-[color:var(--gold)]/25 text-muted-foreground hover:border-[color:var(--gold)]/60"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "audio" && (
          <div className="space-y-6 max-w-md mx-auto mb-8">
            <div>
              <div className="flex justify-between text-xs text-[color:var(--gold)]/70 mb-2"><span>Music Volume</span><span>{Math.round(local.musicVol * 100)}%</span></div>
              <input
                type="range" min="0" max="100" value={Math.round(local.musicVol * 100)}
                onChange={e => commit({ ...local, musicVol: parseInt(e.target.value) / 100 })}
                className="w-full accent-[color:var(--gold)]"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-[color:var(--gold)]/70 mb-2"><span>SFX Volume</span><span>{Math.round(local.sfxVol * 100)}%</span></div>
              <input
                type="range" min="0" max="100" value={Math.round(local.sfxVol * 100)}
                onChange={e => commit({ ...local, sfxVol: parseInt(e.target.value) / 100 })}
                className="w-full accent-[color:var(--gold)]"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-[color:var(--gold)]/70 mb-2"><span>Brightness</span><span>{Math.round(local.brightness * 100)}%</span></div>
              <input
                type="range" min="60" max="140" value={Math.round(local.brightness * 100)}
                onChange={e => commit({ ...local, brightness: parseInt(e.target.value) / 100 })}
                className="w-full accent-[color:var(--gold)]"
              />
            </div>
          </div>
        )}

        {tab === "controls" && (
          <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto mb-8">
            {BIND_ORDER.map(b => (
              <button
                key={b.key}
                onClick={() => listenFor(b.key)}
                className={`flex justify-between items-center border px-3 py-2 text-xs transition-all ${listening === b.key ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10" : "border-[color:var(--gold)]/20 hover:border-[color:var(--gold)]/50"}`}
              >
                <span className="text-[color:var(--gold)]/70">{b.label}</span>
                <span className="font-display text-gold-glow">{listening === b.key ? "..." : local.binds[b.key]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button onClick={() => { sfx("menu"); onResume(); }} className="font-display tracking-[0.3em] text-xs px-8 py-3 border border-[color:var(--gold)]/80 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10">RESUME</button>
          <button onClick={() => { sfx("menu"); onQuit(); }} className="font-display tracking-[0.3em] text-xs px-6 py-3 border border-[color:var(--gold)]/40 hover:border-[color:var(--gold)]">QUIT TO MENU</button>
        </div>
      </div>
    </div>
  );
}
