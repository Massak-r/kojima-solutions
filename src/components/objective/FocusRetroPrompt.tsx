import { useEffect, useState } from "react";
import { Zap, Target, Snail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { patchSession, type SessionAccuracy } from "@/api/objectiveSessions";

interface PendingRetro {
  sessionId: string;
}

const OPTIONS: Array<{ key: SessionAccuracy; label: string; icon: typeof Zap; cls: string }> = [
  { key: "faster",    label: "Plus rapide",  icon: Zap,    cls: "text-emerald-600 hover:bg-emerald-500/10" },
  { key: "on_target", label: "Pile poil",    icon: Target, cls: "text-primary hover:bg-primary/10" },
  { key: "slower",    label: "Plus long",    icon: Snail,  cls: "text-amber-600 hover:bg-amber-500/10" },
];

/**
 * Global toast-like prompt that appears for ~12 s after a focus session stops,
 * asking how the actual time compared to the user's expectation.
 * Dismissible. One picker click → patch + dismiss.
 * Mounted once at the app level (App.tsx) so any session stop surfaces it.
 */
export function FocusRetroPrompt() {
  const [pending, setPending] = useState<PendingRetro | null>(null);

  useEffect(() => {
    function onStopped(e: Event) {
      const detail = (e as CustomEvent).detail as { sessionId?: string } | undefined;
      if (detail?.sessionId) setPending({ sessionId: detail.sessionId });
    }
    window.addEventListener("focus-session-stopped", onStopped);
    return () => window.removeEventListener("focus-session-stopped", onStopped);
  }, []);

  // Auto-dismiss after 12 s
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(null), 12000);
    return () => window.clearTimeout(t);
  }, [pending]);

  if (!pending) return null;

  function pick(accuracy: SessionAccuracy) {
    if (!pending) return;
    const id = pending.sessionId;
    setPending(null);
    patchSession(id, { accuracy }).catch(() => {});
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-xs animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur shadow-lg p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-display font-bold text-foreground/80 uppercase tracking-wider">
            Cette session
          </span>
          <button
            onClick={() => setPending(null)}
            className="text-muted-foreground/50 hover:text-foreground p-0.5 transition-colors"
            aria-label="Ignorer"
          >
            <X size={12} />
          </button>
        </div>
        <div className="text-[11px] font-body text-muted-foreground mb-2.5">
          Comparé à votre intuition&nbsp;:
        </div>
        <div className="flex items-center gap-1">
          {OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                onClick={() => pick(opt.key)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 rounded-lg p-2 transition-colors",
                  opt.cls,
                )}
                title={opt.label}
              >
                <Icon size={14} />
                <span className="text-[10px] font-body font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
