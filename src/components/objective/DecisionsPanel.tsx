import { useEffect, useState } from "react";
import { Plus, Trash2, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listDecisions, createDecision, deleteDecision, type ObjectiveDecision } from "@/api/objectiveDecisions";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface DecisionsPanelProps {
  source: ObjectiveSource;
  objectiveId: string;
}

export function DecisionsPanel({ source, objectiveId }: DecisionsPanelProps) {
  const [decisions, setDecisions] = useState<ObjectiveDecision[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftRat,   setDraftRat]   = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listDecisions(source, objectiveId)
      .then(setDecisions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [source, objectiveId]);

  async function handleAdd() {
    const title = draftTitle.trim();
    if (!title) return;
    const rat = draftRat.trim();
    const temp: ObjectiveDecision = {
      id: crypto.randomUUID(),
      source, objectiveId,
      title,
      rationale: rat || null,
      decidedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    setDecisions(prev => [temp, ...prev]);
    setAdding(false);
    setDraftTitle(""); setDraftRat("");
    try {
      const real = await createDecision({ source, objectiveId, title, rationale: rat || undefined });
      setDecisions(prev => prev.map(d => d.id === temp.id ? real : d));
    } catch {}
  }

  async function handleDelete(id: string) {
    setDecisions(prev => prev.filter(d => d.id !== id));
    setConfirmDelete(null);
    try { await deleteDecision(id); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider">
          {decisions.length === 0 ? "Aucune décision" : `${decisions.length} décision${decisions.length > 1 ? "s" : ""}`}
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="h-8 rounded-full">
            <Plus size={14} className="mr-1" /> Consigner une décision
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <input
            type="text"
            placeholder="Ex : utiliser Tailwind plutôt que CSS modules"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            autoFocus
            className="w-full text-sm font-display font-semibold bg-card/60 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          <textarea
            placeholder="Raisonnement / contexte (facultatif)"
            value={draftRat}
            onChange={e => setDraftRat(e.target.value)}
            rows={3}
            className="w-full text-sm font-body bg-card/60 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!draftTitle.trim()} className="h-8 rounded-lg">Consigner</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraftTitle(""); setDraftRat(""); }} className="h-8 rounded-lg">Annuler</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : decisions.length === 0 && !adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-2xl border border-dashed border-border/40 hover:border-border/70 hover:bg-card/40 p-6 sm:p-8 text-center transition-all"
        >
          <div className="text-sm font-body text-muted-foreground">
            Aucune décision consignée.
          </div>
          <div className="text-xs font-body text-muted-foreground/50 mt-1">
            Gardez une trace des choix stratégiques liés à cet objectif.
          </div>
        </button>
      ) : (
        <div className="space-y-2.5">
          {decisions.map(d => (
            <div key={d.id} className={cn(
              "rounded-xl border border-border/40 bg-card/40 p-4 flex items-start gap-3",
            )}>
              <div className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <GitBranch size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-semibold text-foreground break-words">{d.title}</div>
                {d.rationale && (
                  <div className="text-xs font-body text-foreground/70 mt-1 leading-relaxed whitespace-pre-wrap">{d.rationale}</div>
                )}
                <div className="text-[10px] font-mono text-muted-foreground/60 tabular-nums mt-1.5">
                  {new Date(d.decidedAt.replace(" ", "T")).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
              {confirmDelete === d.id ? (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px] rounded-md" onClick={() => handleDelete(d.id)}>Oui</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] rounded-md" onClick={() => setConfirmDelete(null)}>Non</Button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(d.id)}
                  className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
