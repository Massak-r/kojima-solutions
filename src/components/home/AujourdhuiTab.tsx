import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Compass, CalendarRange, CheckCircle2, Star, Target, FolderKanban,
  ArrowRight, Plus, Repeat, CalendarClock, Flame, Sparkles, ListChecks, Sunrise,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { OPEN_NEXT_ACTION_EVENT } from "@/components/now/NextActionDialog";
import { useUpdateSubtask } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";
import { useFlagSubtask } from "@/hooks/useFlagSubtask";
import {
  useTodaysSprint, type TodayItem, type TodaySuggestion, type SuggestionReason,
} from "@/hooks/useTodaysSprint";
import { DayBlocks } from "@/components/home/DayBlocks";
import { InboxPanel } from "@/components/home/InboxPanel";
import { TomorrowPlanDialog } from "@/components/home/TomorrowPlanDialog";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptic } from "@/lib/haptics";
import { toISODate } from "@/lib/weekDates";
import { Celebration } from "@/components/ui/celebration";
import { StreakBadge } from "@/components/todos/StreakBadge";

function itemTitle(item: TodayItem): string {
  return item.kind === "subtask" ? item.subtask.text : item.task.title;
}
function itemSource(item: TodayItem): { label: string; Icon: typeof Target } {
  if (item.kind === "subtask") return { label: item.objective?.text ?? "Objectif", Icon: Target };
  return { label: item.project.title || "Projet", Icon: FolderKanban };
}
function itemIsMust(item: TodayItem): boolean {
  const t = item.kind === "subtask" ? item.subtask.sprintTier : item.task.sprintTier;
  return t === "must";
}

const REASON_META: Record<SuggestionReason, { label: string; Icon: typeof Repeat; cls: string }> = {
  recurring: { label: "Récurrent", Icon: Repeat,        cls: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15" },
  scheduled: { label: "Planifié",  Icon: CalendarClock, cls: "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/15" },
  urgent:    { label: "Urgent",    Icon: Flame,         cls: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15" },
};

export function AujourdhuiTab() {
  const navigate = useNavigate();
  const { flagged, done, suggestions, plannedTomorrow, counts } = useTodaysSprint();
  const updateSubtask = useUpdateSubtask();
  const { updateProjectTask } = useProjects();
  const { flag: flagSubtask } = useFlagSubtask();
  const isMobile = useIsMobile();

  // Celebrate clearing the day's sprint — fires once per day the moment the
  // last pending item is completed (not on a fresh load that's already empty).
  const [celebrate, setCelebrate] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const prevPendingRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prev = prevPendingRef.current;
    if (prev !== undefined && prev > 0 && counts.pending === 0 && counts.done > 0) {
      const key = `koji-day-celebrated-${toISODate(new Date())}`;
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, "1");
          setCelebrate(true);
          haptic("success");
        }
      } catch { /* ignore */ }
    }
    prevPendingRef.current = counts.pending;
  }, [counts.pending, counts.done]);

  const total = counts.pending + counts.done;
  const progress = total === 0 ? 0 : Math.round((counts.done / total) * 100);

  function openItem(item: TodayItem) {
    if (item.kind === "subtask") {
      const o = item.objective;
      if (o) navigate(`/objective/${o.source}/${o.id}`);
    } else {
      navigate(`/project/${item.project.id}/etapes`);
    }
  }

  function completeItem(item: TodayItem) {
    haptic("success");
    if (item.kind === "subtask") {
      updateSubtask.mutate({ id: item.subtask.id, patch: { completed: true } });
    } else {
      updateProjectTask(item.project.id, item.task.id, {
        status: "completed", completed: true, completedAt: new Date().toISOString(),
      });
    }
  }

  /** Close-the-day ritual: clear today's flag off everything already done so
   *  tomorrow starts clean (mirrors the daily sprint-cleanup), then flow straight
   *  into lining up tomorrow's 1-3 — the evening shutdown that kills the morning
   *  blank page. */
  function closeDay() {
    if (done.length === 0) return;
    haptic("success");
    done.forEach((item) => {
      if (item.kind === "subtask") updateSubtask.mutate({ id: item.subtask.id, patch: { flaggedToday: false } });
      else updateProjectTask(item.project.id, item.task.id, { flaggedToday: false });
    });
    toast.success("Journée close", {
      description: `${done.length} tâche${done.length > 1 ? "s" : ""} bouclée${done.length > 1 ? "s" : ""} aujourd'hui — bravo.`,
    });
    setPlanOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Heartbeat hero */}
      <section className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-eyebrow">Le plan du jour</p>
            <p className="mt-1.5 font-display text-3xl font-bold text-foreground leading-none">
              {counts.pending}
              <span className="ml-2 text-base font-body font-medium text-muted-foreground">
                à faire
              </span>
            </p>
            <p className="mt-1.5 text-sm font-body text-muted-foreground tabular-nums">
              {counts.must} must · {counts.nice} nice · {counts.done} fait
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_NEXT_ACTION_EVENT))}
              className="inline-flex items-center gap-1.5 text-xs font-body font-semibold rounded-full px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Compass size={14} />
              Et maintenant ?
            </button>
            <button
              onClick={() => navigate("/sprint")}
              className="inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-full px-3.5 py-2 border border-border hover:bg-secondary transition-colors"
            >
              <CalendarRange size={14} />
              Planifier
            </button>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary/70")}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70">{progress}%</span>
          </div>
        )}
      </section>

      {/* Inbox à trier — captures non triées ; se masque seule si rien en attente */}
      <InboxPanel />

      {/* Programme du jour — manual time-blocks */}
      <DayBlocks />

      {/* Sprint du jour */}
      {flagged.length === 0 ? (
        <EmptyDay done={counts.done} onPlan={() => navigate("/sprint")} />
      ) : (
        <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-primary" />
              <h2 className="text-eyebrow">Sprint du jour</h2>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {flagged.length}</span>
            </div>
            <span className={cn(
              "text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full",
              counts.capReached ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "text-muted-foreground/60",
            )}>
              {counts.pending}/{counts.cap}
            </span>
          </header>
          {isMobile && (
            <p className="px-5 pt-2 text-[11px] font-body text-muted-foreground/55 italic">
              Astuce : glisse une tâche vers la gauche pour la terminer.
            </p>
          )}
          <ul className="divide-y divide-border/50">
            {flagged.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <SwipeableRow
                  enabled={isMobile}
                  onSwipe={() => completeItem(item)}
                  actionLabel="Terminé"
                  actionIcon={<CheckCircle2 size={16} />}
                  contentClassName="bg-card"
                >
                  <PlanRow item={item} onComplete={() => completeItem(item)} onOpen={() => openItem(item)} />
                </SwipeableRow>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Fait aujourd'hui + close ritual */}
      {done.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-eyebrow">Fait aujourd'hui</h2>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {done.length}</span>
            </div>
            <button
              onClick={closeDay}
              className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium rounded-full px-2.5 py-1 border border-border hover:bg-secondary transition-colors"
            >
              <Sparkles size={12} />
              Clore la journée
            </button>
          </header>
          <ul className="divide-y divide-border/40">
            {done.map((item) => {
              const { label, Icon } = itemSource(item);
              return (
                <li key={`${item.kind}:${item.id}`} className="flex items-center gap-3 px-5 py-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="flex-1 min-w-0 text-sm font-body text-muted-foreground line-through truncate">
                    {itemTitle(item)}
                  </span>
                  <span className="hidden sm:flex items-center gap-1 text-[11px] font-body text-muted-foreground/60 truncate max-w-[160px]">
                    <Icon size={11} /> {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Aussi aujourd'hui — unflagged but due today */}
      {suggestions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2 px-1">
            <h2 className="text-eyebrow">Aussi aujourd'hui</h2>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {suggestions.length}</span>
          </div>
          <ul className="space-y-1.5">
            {suggestions.slice(0, 8).map((s) => (
              <SuggestionRow key={s.id} suggestion={s} disabled={counts.capReached} onAdd={() => { haptic("tap"); flagSubtask(s.subtask); }} />
            ))}
          </ul>
          {suggestions.length > 8 && (
            <p className="mt-2 px-1 text-[11px] font-body text-muted-foreground/70">
              + {suggestions.length - 8} autre{suggestions.length - 8 > 1 ? "s" : ""}
            </p>
          )}
        </section>
      )}

      {/* Demain — evening shutdown: line up tomorrow's 1-3 so the morning isn't blank */}
      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Sunrise size={15} className="text-primary" />
            <h2 className="text-eyebrow">Demain</h2>
            {plannedTomorrow.length > 0 && (
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {plannedTomorrow.length}</span>
            )}
          </div>
          <button
            onClick={() => setPlanOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-body font-medium rounded-full px-2.5 py-1 border border-border hover:bg-secondary transition-colors"
          >
            {plannedTomorrow.length > 0 ? <><Sparkles size={12} /> Modifier</> : <><Plus size={12} /> Préparer</>}
          </button>
        </header>
        {plannedTomorrow.length > 0 ? (
          <ul className="divide-y divide-border/40">
            {plannedTomorrow.map((item) => {
              const { label, Icon } = itemSource(item);
              return (
                <li key={`tomorrow:${item.id}`} className="flex items-center gap-3 px-5 py-2.5">
                  <Sunrise size={15} className="text-primary/60 shrink-0" />
                  <span className="flex-1 min-w-0 text-sm font-body text-foreground/90 truncate">{itemTitle(item)}</span>
                  <span className="hidden sm:flex items-center gap-1 text-[11px] font-body text-muted-foreground/60 truncate max-w-[160px]">
                    <Icon size={11} /> {label}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm font-body text-muted-foreground">
            Termine en douceur : choisis 1 à 3 tâches pour démarrer demain sans hésiter.
          </p>
        )}
      </section>

      <Celebration
        show={celebrate}
        title="Journée bouclée"
        subtitle={`${counts.done} tâche${counts.done > 1 ? "s" : ""} terminée${counts.done > 1 ? "s" : ""} aujourd'hui — bravo.`}
        onDone={() => setCelebrate(false)}
      />

      <TomorrowPlanDialog open={planOpen} onOpenChange={setPlanOpen} />
    </div>
  );
}

function PlanRow({ item, onComplete, onOpen }: { item: TodayItem; onComplete: () => void; onOpen: () => void }) {
  const { label, Icon } = itemSource(item);
  const must = itemIsMust(item);
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors group">
      <Checkbox
        checked={false}
        onCheckedChange={onComplete}
        aria-label="Marquer comme terminé"
        className="shrink-0 h-[18px] w-[18px] rounded-md border-muted-foreground/40 transition-colors data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
      />
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          {must && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 rounded-full px-1.5 py-0.5 shrink-0">
              <Star size={8} className="fill-current" /> Must
            </span>
          )}
          <span className="text-sm font-body font-medium text-foreground truncate">{itemTitle(item)}</span>
          {item.kind === "subtask" && item.subtask.recurrence && <StreakBadge subtask={item.subtask} />}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-body text-muted-foreground/70 truncate">
          <Icon size={11} className="shrink-0" /> <span className="truncate">{label}</span>
        </div>
      </button>
      <ArrowRight size={14} className="shrink-0 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
    </div>
  );
}

function SuggestionRow({ suggestion, disabled, onAdd }: { suggestion: TodaySuggestion; disabled: boolean; onAdd: () => void }) {
  const meta = REASON_META[suggestion.reason];
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/70 px-3 py-2 group">
      <span className={cn("inline-flex items-center gap-1 text-[9px] font-body font-semibold rounded-full px-1.5 py-0.5 shrink-0", meta.cls)}>
        <meta.Icon size={9} /> {meta.label}
      </span>
      <span className="flex-1 min-w-0 text-[13px] font-body text-foreground/90 truncate">{suggestion.subtask.text}</span>
      <StreakBadge subtask={suggestion.subtask} />
      <button
        onClick={onAdd}
        title={disabled ? "Sprint plein — termine ou retire une tâche d'abord" : "Ajouter au sprint du jour"}
        className="inline-flex items-center gap-1 text-[11px] font-body font-medium rounded-full px-2 py-0.5 text-primary hover:bg-primary/10 transition-colors shrink-0"
      >
        <Plus size={12} /> Ajouter
      </button>
    </li>
  );
}

function EmptyDay({ done, onPlan }: { done: number; onPlan: () => void }) {
  // Finished everything that was flagged today → celebrate, don't nag.
  if (done > 0) {
    return (
      <section className="rounded-2xl border border-emerald-200/60 dark:border-emerald-500/25 bg-emerald-50/50 dark:bg-emerald-500/8 shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="font-display text-base font-bold text-foreground mb-1">Sprint bouclé 🎉</p>
        <p className="text-sm font-body text-muted-foreground mb-4 max-w-sm mx-auto">
          Tu as terminé toutes tes tâches du jour. Profite — ou prends un peu d'avance.
        </p>
        <button
          onClick={onPlan}
          className="inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-full px-4 py-2 border border-border hover:bg-secondary transition-colors"
        >
          <CalendarRange size={14} />
          Planifier la suite
        </button>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
        <CalendarRange size={20} className="text-primary" />
      </div>
      <p className="font-display text-base font-bold text-foreground mb-1">Journée vierge</p>
      <p className="text-sm font-body text-muted-foreground mb-4 max-w-sm mx-auto">
        Rien dans le sprint du jour. Choisis quelques tâches pour t'engager sur la journée.
      </p>
      <button
        onClick={onPlan}
        className="inline-flex items-center gap-1.5 text-xs font-body font-semibold rounded-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <CalendarRange size={14} />
        Planifier ma journée
      </button>
    </section>
  );
}
