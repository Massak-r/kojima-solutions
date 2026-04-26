import { Sparkles } from "lucide-react";

export function EmptyFocusHint({ hasBacklog }: { hasBacklog: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/40 bg-card/30 p-5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
        <Sparkles size={16} className="text-muted-foreground/60" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-body font-medium text-foreground">Aucune session de focus en cours</div>
        <div className="text-xs font-body text-muted-foreground/70 mt-0.5">
          {hasBacklog
            ? <>Vous avez des étapes dans le sprint ci-dessous — ouvrez-en une et appuyez sur <span className="font-semibold">Démarrer</span>.</>
            : <>Choisissez un objectif, marquez votre prochaine action en ⭐, puis appuyez sur <span className="font-semibold">Démarrer</span>.</>
          }
        </div>
      </div>
    </div>
  );
}
