import { useEffect, useMemo, useState } from "react";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { Sunrise, Star, Flame, CalendarClock, Search, Check, ListChecks } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { toISODate } from "@/lib/weekDates";
import { useAllSubtasks, useUpdateSubtask } from "@/hooks/useSubtasks";
import { useObjectives } from "@/hooks/useObjectives";
import type { SubtaskItem } from "@/api/todoSubtasks";

/** A small, achievable morning is the whole point — nudge toward 1-3, don't block. */
const SOFT_CAP = 3;
const TOP_N = 12;

/** Best-guess minutes for a subtask: explicit estimate, else effort tier. */
function estMin(s: SubtaskItem): number {
  if (s.estimatedMinutes && s.estimatedMinutes > 0) return s.estimatedMinutes;
  switch (s.effortSize) {
    case "rapide": return 15;
    case "complexe": return 90;
    case "moyen": return 45;
    default: return 30;
  }
}

function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

type Reason = { label: string; Icon: typeof Star; cls: string };

function reasonFor(s: SubtaskItem, today: string): Reason | null {
  if (s.dueDate) {
    if (s.dueDate < today)
      return { label: "En retard", Icon: CalendarClock, cls: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15" };
    const in3 = toISODate(addDays(new Date(today), 3));
    if (s.dueDate <= in3)
      return { label: "Échéance proche", Icon: CalendarClock, cls: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" };
  }
  if (s.priority === "high")
    return { label: "Priorité", Icon: Flame, cls: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15" };
  if (s.sprintTier === "must")
    return { label: "Must", Icon: Star, cls: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" };
  return null;
}

/** Relevance for tomorrow: already-scheduled pins to top, then must/priority/due-soon. */
function scoreFor(s: SubtaskItem, tomorrow: string, today: string): number {
  let score = 0;
  if (s.scheduledFor === tomorrow) score += 1000;
  if (s.sprintTier === "must") score += 40;
  score += s.priority === "high" ? 30 : s.priority === "low" ? -6 : 8;
  if (s.dueDate) {
    if (s.dueDate < today) score += 60;
    else {
      const in3 = toISODate(addDays(new Date(today), 3));
      const in7 = toISODate(addDays(new Date(today), 7));
      if (s.dueDate <= in3) score += 30;
      else if (s.dueDate <= in7) score += 12;
    }
  }
  return score;
}

/**
 * Evening shutdown ritual — pick 1-3 things for tomorrow. Selected subtasks get
 * `scheduledFor = tomorrow`; the server's daily refresh auto-flags them into the
 * sprint at next-morning's first load, so the day opens with a ready plan instead
 * of a blank page. Reversible (regular buttons, no slide-to-confirm).
 */
export function TomorrowPlanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { data: objectives = [] } = useObjectives();
  const updateSubtask = useUpdateSubtask();

  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));

  const objById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of objectives) m.set(o.id, o.text);
    return m;
  }, [objectives]);

  // Candidates: open, not already in today's sprint, not recurring (those manage
  // their own cadence), parent objective still present.
  const pool = useMemo(
    () =>
      allSubtasks
        .filter((s) => !s.completed && !s.flaggedToday && !s.recurrence && objById.has(s.parentId))
        .map((s) => ({ s, score: scoreFor(s, tomorrow, today) }))
        .sort((a, b) => b.score - a.score),
    [allSubtasks, objById, tomorrow, today],
  );

  const initialSelected = useMemo(
    () => new Set(pool.filter((p) => p.s.scheduledFor === tomorrow).map((p) => p.s.id)),
    [pool, tomorrow],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // Re-seed from what's already scheduled each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setQuery("");
    }
    // Only react to the open transition — not to pool churn while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: string) {
    haptic("tap");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const q = query.trim().toLowerCase();
  const displayed = useMemo(() => {
    const ranked = [...pool].sort((a, b) => {
      const sa = selected.has(a.s.id) ? 0 : 1;
      const sb = selected.has(b.s.id) ? 0 : 1;
      if (sa !== sb) return sa - sb; // keep checked rows visible at the top
      return b.score - a.score;
    });
    const filtered = q ? ranked.filter((p) => p.s.text.toLowerCase().includes(q)) : ranked;
    return q ? filtered : filtered.slice(0, TOP_N);
  }, [pool, selected, q]);

  const totalMin = useMemo(
    () => pool.filter((p) => selected.has(p.s.id)).reduce((sum, p) => sum + estMin(p.s), 0),
    [pool, selected],
  );

  const dirty = useMemo(() => {
    if (selected.size !== initialSelected.size) return true;
    for (const id of selected) if (!initialSelected.has(id)) return true;
    return false;
  }, [selected, initialSelected]);

  function confirm() {
    const toSchedule = [...selected].filter((id) => !initialSelected.has(id));
    const toClear = [...initialSelected].filter((id) => !selected.has(id));
    toSchedule.forEach((id) =>
      updateSubtask.mutate({ id, patch: { scheduledFor: tomorrow, flaggedToday: false } }),
    );
    toClear.forEach((id) => updateSubtask.mutate({ id, patch: { scheduledFor: null } }));
    haptic("success");
    const n = selected.size;
    onOpenChange(false);
    if (n > 0) {
      toast.success("Demain est prêt", {
        description: `${n} tâche${n > 1 ? "s" : ""} t'attendr${n > 1 ? "ont" : "a"} dans ton sprint demain matin.`,
      });
    } else {
      toast.success("Demain remis à zéro", { description: "Plus aucune tâche planifiée pour demain." });
    }
  }

  const hiddenCount = !q && pool.length > TOP_N ? pool.length - TOP_N : 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Sunrise className="w-4 h-4 text-primary" /> Préparer demain
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choisis 1 à 3 tâches pour demain. Elles seront prêtes dans ton sprint au réveil — zéro page blanche.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-1">
          {pool.length > 6 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer mes tâches…"
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm font-body outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
          )}

          <div className="max-h-[44vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
            {pool.length === 0 ? (
              <EmptyPool />
            ) : displayed.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground font-body">
                Aucune tâche ne correspond à « {query} ».
              </p>
            ) : (
              displayed.map(({ s }) => {
                const isSel = selected.has(s.id);
                const reason = reasonFor(s, today);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-pressed={isSel}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                      isSel ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-secondary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-colors",
                        isSel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {isSel && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-body font-medium text-foreground truncate">{s.text}</span>
                        {reason && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[9px] font-body font-semibold rounded-full px-1.5 py-0.5 shrink-0",
                              reason.cls,
                            )}
                          >
                            <reason.Icon size={9} /> {reason.label}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                        <span className="truncate">{objById.get(s.parentId)}</span>
                        <span className="opacity-40">·</span>
                        <span className="shrink-0 tabular-nums">~{estMin(s)} min</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {hiddenCount > 0 && (
            <p className="px-1 text-[11px] font-body text-muted-foreground/70">
              + {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} — filtre pour les retrouver.
            </p>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] font-body text-muted-foreground">
            {selected.size === 0 ? (
              "Rien de sélectionné"
            ) : (
              <>
                {selected.size} sélectionnée{selected.size > 1 ? "s" : ""} · ≈ {fmtDuration(totalMin)}
                {selected.size > SOFT_CAP && (
                  <span className="text-amber-600 dark:text-amber-400"> — 3 suffit pour une journée nette</span>
                )}
              </>
            )}
          </p>
          <Button onClick={confirm} disabled={!dirty} className="w-full sm:w-auto gap-1.5">
            <Sunrise size={14} /> Planifier demain{selected.size > 0 ? ` · ${selected.size}` : ""}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function EmptyPool() {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <ListChecks size={20} className="mx-auto mb-2 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground font-body">
        Toutes tes tâches ouvertes sont déjà dans un sprint ou récurrentes.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/60 font-body">
        Crée des étapes dans tes objectifs pour pouvoir en planifier.
      </p>
    </div>
  );
}
