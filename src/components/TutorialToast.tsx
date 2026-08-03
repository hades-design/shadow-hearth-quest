import { sfx } from "@/lib/audio";

export default function TutorialToast({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md">
      <div className="border border-[color:var(--gold)]/40 bg-black/85 backdrop-blur-sm p-4 text-center animate-fade-in">
        <div className="font-display text-sm text-gold-glow tracking-widest mb-1">{title}</div>
        <p className="text-xs text-muted-foreground italic mb-3">{body}</p>
        <button
          onClick={() => { sfx("menu"); onClose(); }}
          className="text-[10px] uppercase tracking-widest px-4 py-1 border border-[color:var(--gold)]/50 hover:border-[color:var(--gold)] text-[color:var(--gold)]"
        >
          Understood
        </button>
      </div>
    </div>
  );
}
