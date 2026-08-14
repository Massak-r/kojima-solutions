import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2, Plus, Repeat, CalendarClock, Flame, Sparkles, Sunrise,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateSubtask } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";
import { useFlagSubtask } from "@/hooks/useFlagSubtask";
import {
  useTodaysSprint, type TodayItem, type TodaySuggestion, type SuggestionReason,
} from "@/hooks/useTodaysSprint";
import { useTimeBlocks, useUpdateTimeBlock } from "@/hooks/useTimeBlocks";
import { formatTime } from "@/lib/dateFormat";
import { DayPlan, itemTitle, itemSource } from "@/components/home/DayPlan";
import { TomorrowPlanDialog } from "@/components/home/TomorrowPlanDialog";
import { MonthStrip } from "@/components/home/MonthStrip";
import { BriefDuJour } from "@/components/home/BriefDuJour";
import { haptic } from "@/lib/haptics";
import { toISODate } from "@/lib/weekDates";
import { Celebration } from "@/components/ui/celebration";
import { StreakBadge } from "@/components/todos/StreakBadge";

const REASON_META: Record<SuggestionReason, { label: string; Icon: typeof Repeat; cls: string }> = {
  recurring: { label: "Récurrent", Icon: Repeat,        cls: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15" },
  scheduled: { label: "Planifié",  Icon: CalendarClock, cls: "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-500/15" },
  urgent:    { label: "Urgent",    Icon: Flame,         cls: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15" },
};

interface AujourdhuiTabProps {
  /** False quand un DayHero au-dessus porte déjà le compte du jour (page /jour). */
  showPlanHeadline?: boolean;
}

export function AujourdhuiTab({ showPlanHeadline = true }: AujourdhuiTabProps = {}) {
  const navigate = useNavigate();
  const { flagged, done, suggestions, plannedTomorrow, counts } = useTodaysSprint();
  const updateSubtask = useUpdateSubtask();
  const { updateProjectTask } = useProjects();
  const { flag: flagSubtask } = useFlagSubtask();
  const day = toISODate(new Date());
  // Même cache que le DayPlan — sert au bilan d'estimation du soir.
  const { data: blocks = [] } = useTimeBlocks(day);
  const updateBlock = useUpdateTimeBlock(day);

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

  function uncompleteItem(item: TodayItem) {
    haptic("tap");
    if (item.kind === "subtask") {
      updateSubtask.mutate({ id: item.subtask.id, patch: { completed: false } });
    } else {
      updateProjectTask(item.project.id, item.task.id, {
        status: "open", completed: false, completedAt: undefined,
      });
    }
    // Le bloc horaire lié redevient « à faire » lui aussi, sinon le bilan
    // d'estimation compterait une tâche rouverte comme tenue.
    blocks
      .filter((b) => b.refKind === item.kind && b.refId === item.id && b.doneMin != null)
      .forEach((b) => updateBlock.mutate({ id: b.id, patch: { doneMin: null } }));
  }

  /** Close-the-day ritual: clear today's flag off everything already done so
   *  tomorrow starts clean (mirrors the daily sprint-cleanup), then flow straight
   *  into lining up tomorrow's 1-3 — the evening shutdown that kills the morning
   *  blank page. Le bilan d'estimation (planifié vs fait) part avec le toast. */
  function closeDay() {
    if (done.length === 0) return;
    haptic("success");
    done.forEach((item) => {
      if (item.kind === "subtask") updateSubtask.mutate({ id: item.subtask.id, patch: { flaggedToday: false } });
      else updateProjectTask(item.project.id, item.task.id, { flaggedToday: false });
    });
    const estimated = blocks.filter((b) => b.doneMin != null && b.endMin != null);
    const onTime = estimated.filter((b) => (b.doneMin as number) <= (b.endMin as number)).length;
    toast.success("Journée close", {
      description:
        `${done.length} tâche${done.length > 1 ? "s" : ""} bouclée${done.length > 1 ? "s" : ""} aujourd'hui — bravo.` +
        (estimated.length > 0 ? ` Estimations tenues : ${onTime}/${estimated.length}.` : ""),
    });
    setPlanOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* L'essentiel — daily brief: start-here, money to collect, next deadline */}
      <BriefDuJour />

      {/* Le mois, en une ligne — la ligne d'arrivée, pas une liste de plus */}
      <MonthStrip />

      {/* Le plan du jour — sprint + programme horaire + inbox, fusionnés */}
      <DayPlan
        flagged={flagged}
        done={done}
        counts={counts}
        onComplete={completeItem}
        onUncomplete={uncompleteItem}
        onOpen={openItem}
        showHeadline={showPlanHeadline}
      />

      {/* Fait aujourd'hui + close ritual */}
      {done.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-eyebrow">Fait aujourd'hui</h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">· {done.length}</span>
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
              const doneAt = item.kind === "subtask" ? item.subtask.completedAt : item.task.completedAt;
              return (
                <li key={`${item.kind}:${item.id}`} className="flex items-center gap-3 px-5 py-2.5">
                  <Checkbox
                    checked
                    onCheckedChange={() => uncompleteItem(item)}
                    aria-label="Remettre à faire"
                    title="Remettre à faire"
                    className="shrink-0 h-[18px] w-[18px] rounded-md data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                  <span className="flex-1 min-w-0 text-sm font-body text-muted-foreground line-through truncate">
                    {itemTitle(item)}
                  </span>
                  {doneAt && (
                    <span className="text-[11px] tabular-nums text-muted-foreground/60 shrink-0">
                      {formatTime(doneAt)}
                    </span>
                  )}
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
            <span className="text-[11px] tabular-nums text-muted-foreground">· {suggestions.length}</span>
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
              <span className="text-[11px] tabular-nums text-muted-foreground">· {plannedTomorrow.length}</span>
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
        title={disabled ? "Plan du jour plein — termine ou retire une tâche d'abord" : "Ajouter au plan du jour"}
        className="inline-flex items-center gap-1 text-[11px] font-body font-medium rounded-full px-2 py-0.5 text-primary hover:bg-primary/10 transition-colors shrink-0"
      >
        <Plus size={12} /> Ajouter
      </button>
    </li>
  );
}
