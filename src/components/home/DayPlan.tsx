import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays } from "date-fns";
import {
  ArrowRight, CalendarRange, CheckCircle2, Clock, FolderKanban,
  History, Plus, Star, Target, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { InboxPanel } from "@/components/home/InboxPanel";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { StreakBadge } from "@/components/todos/StreakBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTimeBlocks, useTimeBlocksRange, useCreateTimeBlock, useUpdateTimeBlock, useDeleteTimeBlock } from "@/hooks/useTimeBlocks";
import { formatDateShort } from "@/lib/dateFormat";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";
import type { TimeBlock } from "@/api/timeBlocks";
import type { TodayItem, TodaysSprint } from "@/hooks/useTodaysSprint";
import { toISODate } from "@/lib/weekDates";
import { haptic } from "@/lib/haptics";

/* ── Shared today-item helpers (also used by the Fait/Demain sections) ───── */

export function itemTitle(item: TodayItem): string {
  return item.kind === "subtask" ? item.subtask.text : item.task.title;
}
export function itemSource(item: TodayItem): { label: string; Icon: typeof Target } {
  if (item.kind === "subtask") return { label: item.objective?.text ?? "Objectif", Icon: Target };
  return { label: item.project.title || "Projet", Icon: FolderKanban };
}
export function itemIsMust(item: TodayItem): boolean {
  const t = item.kind === "subtask" ? item.subtask.sprintTier : item.task.sprintTier;
  return t === "must";
}

/* ── Time helpers ────────────────────────────────────────────────────────── */

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function hhmmToMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h${String(m).padStart(2, "0")}` : h ? `${h}h` : `${m}min`;
}
/** Local minutes-from-midnight of an ISO-ish timestamp, or null if unparseable
 *  or not from `day`. Fallback source for the estimation feedback when the
 *  item was completed outside the plan (no doneMin stamped on the block). */
function minutesFromTimestamp(ts: string | null | undefined, day: string): number | null {
  if (!ts) return null;
  const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
  if (Number.isNaN(d.getTime()) || toISODate(d) !== day) return null;
  return d.getHours() * 60 + d.getMinutes();
}
/** Next quarter-hour from now — friendly default when giving a task an hour. */
function nextQuarter(): string {
  const d = new Date();
  const min = d.getHours() * 60 + d.getMinutes();
  return minToHHMM(Math.min(1425, Math.ceil(min / 15) * 15));
}

const itemKey = (item: TodayItem) => `${item.kind}:${item.id}`;

type TimedRow =
  | { type: "task"; block: TimeBlock; item: TodayItem; done: boolean }
  /** Free block, or "ghost" (orphan=true) : bloc dont la tâche a quitté le
   *  sprint (déflaguée, close-day, supprimée). done/doneMin gardent la trace
   *  du jour ; le titre est le snapshot pris à la planification. */
  | { type: "free"; block: TimeBlock; orphan: boolean; done: boolean; doneMin: number | null };

/* ── The unified day-plan card ───────────────────────────────────────────── */

interface DayPlanProps {
  flagged: TodayItem[];
  done: TodayItem[];
  counts: TodaysSprint["counts"];
  onComplete: (item: TodayItem) => void;
  /** Décoche : rouvre la tâche ET remet son bloc horaire à « à faire ». */
  onUncomplete: (item: TodayItem) => void;
  onOpen: (item: TodayItem) => void;
  /** False quand un en-tête de journée (DayHero) porte déjà le compte et la
   *  progression juste au-dessus : les répéter ici fabriquait le fouillis. */
  showHeadline?: boolean;
}

/** « Le plan du jour » — sprint, programme horaire et inbox fusionnés :
 *  une seule carte où chaque tâche peut recevoir une heure, où les blocs
 *  libres structurent la journée, et où trier l'inbox est une tâche comme
 *  une autre. doneMin ⇄ endMin nourrit le feedback d'estimation. */
export function DayPlan({ flagged, done, counts, onComplete, onUncomplete, onOpen, showHeadline = true }: DayPlanProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const day = toISODate(new Date());
  const { data: blocks = [] } = useTimeBlocks(day);
  // Caches déjà chauds (mêmes queries que useTodaysSprint) — servent à
  // résoudre l'état "fait" des ghosts après le rituel « Clore la journée ».
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { projects } = useProjects();
  const createBlock = useCreateTimeBlock(day);
  const updateBlock = useUpdateTimeBlock(day);
  const deleteBlock = useDeleteTimeBlock(day);

  // Keep the "maintenant" marker honest without waiting for a data refetch.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const [schedTarget, setSchedTarget] = useState<{ item: TodayItem; block?: TimeBlock } | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  // Reprise du matin : les blocs libres non terminés du dernier jour planifié
  // (jusqu'à 3 jours en arrière) sont proposés en un tap — un bloc meurt avec
  // sa journée, pas ce qu'il restait à faire. Les blocs liés à une tâche ne
  // sont pas repris ici : la tâche, elle, reste engagée toute seule.
  const { data: pastBlocks = [] } = useTimeBlocksRange(
    toISODate(addDays(new Date(), -3)), toISODate(addDays(new Date(), -1)),
  );
  const [carryDismissed, setCarryDismissed] = useState(() => {
    try { return localStorage.getItem(`koji-carryover-${toISODate(new Date())}`) === "1"; } catch { return false; }
  });
  const carryOver = useMemo(() => {
    if (carryDismissed) return [];
    const lastDay = [...new Set(pastBlocks.map((b) => b.day))].sort().pop();
    if (!lastDay) return [];
    const todayTitles = new Set(blocks.map((b) => b.title.trim().toLowerCase()));
    return pastBlocks.filter((b) =>
      b.day === lastDay && b.refKind == null && b.doneMin == null
      && b.title.trim() !== "" && !todayTitles.has(b.title.trim().toLowerCase()),
    );
  }, [pastBlocks, blocks, carryDismissed]);

  function dismissCarryOver() {
    haptic("tap");
    setCarryDismissed(true);
    try { localStorage.setItem(`koji-carryover-${day}`, "1"); } catch { /* ignore */ }
  }
  function carryBlock(b: TimeBlock) {
    haptic("tap");
    createBlock.mutate({ day, startMin: b.startMin, endMin: b.endMin, title: b.title });
  }

  const { timedRows, untimed } = useMemo(() => {
    const byKey = new Map<string, { item: TodayItem; done: boolean }>();
    flagged.forEach((i) => byKey.set(itemKey(i), { item: i, done: false }));
    done.forEach((i) => byKey.set(itemKey(i), { item: i, done: true }));

    // État "fait" d'un ghost : le doneMin stampé au moment de cocher, sinon
    // l'entité vive (une tâche déflaguée par « Clore la journée » reste cochée
    // dans le programme — c'est le récit de la journée, pas un bug d'affichage).
    function ghostState(block: TimeBlock): { done: boolean; doneMin: number | null } {
      if (block.doneMin != null) return { done: true, doneMin: block.doneMin };
      if (block.refKind === "subtask") {
        const s = allSubtasks.find((x) => x.id === block.refId);
        if (s?.completed) return { done: true, doneMin: minutesFromTimestamp(s.completedAt, day) };
      } else if (block.refKind === "task") {
        for (const p of projects) {
          const t = (p.tasks ?? []).find((x) => x.id === block.refId);
          if (t) return t.status === "completed"
            ? { done: true, doneMin: minutesFromTimestamp(t.completedAt, day) }
            : { done: false, doneMin: null };
        }
      }
      return { done: false, doneMin: null };
    }

    const rows: TimedRow[] = [...blocks]
      .sort((a, b) => a.startMin - b.startMin || (a.endMin ?? a.startMin) - (b.endMin ?? b.startMin))
      .map((block) => {
        if (block.refKind && block.refId) {
          const hit = byKey.get(`${block.refKind}:${block.refId}`);
          if (hit) return { type: "task" as const, block, item: hit.item, done: hit.done };
          return { type: "free" as const, block, orphan: true, ...ghostState(block) };
        }
        return { type: "free" as const, block, orphan: false, done: block.doneMin != null, doneMin: block.doneMin };
      });

    const scheduled = new Set(
      blocks.filter((b) => b.refKind && b.refId).map((b) => `${b.refKind}:${b.refId}`),
    );
    return { timedRows: rows, untimed: flagged.filter((i) => !scheduled.has(itemKey(i))) };
  }, [blocks, flagged, done, allSubtasks, projects, day]);

  // Where the "maintenant" line sits in the chronological lane.
  const nowIndex = timedRows.findIndex((r) => r.block.startMin > nowMin);

  function completeTimed(row: Extract<TimedRow, { type: "task" }>) {
    onComplete(row.item);
    updateBlock.mutate({ id: row.block.id, patch: { doneMin: nowMin } });
  }

  /** Coche / décoche un bloc libre : doneMin porte à lui seul l'état « fait ». */
  function toggleFreeBlock(block: TimeBlock, done: boolean) {
    haptic(done ? "tap" : "success");
    updateBlock.mutate({ id: block.id, patch: { doneMin: done ? null : nowMin } });
  }

  const total = counts.pending + counts.done;
  const progress = total === 0 ? 0 : Math.round((counts.done / total) * 100);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* En-tête — le heartbeat du jour. Réduit à une barre de titre quand un
          DayHero porte déjà le compte et la progression juste au-dessus. */}
      <div className={cn(showHeadline ? "p-5 sm:p-6" : "px-5 sm:px-6 py-3.5 border-b border-border/60")}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-eyebrow">Le plan du jour</p>
            {showHeadline && (
              <>
                <p className="mt-1.5 font-display text-3xl font-bold text-foreground leading-none">
                  {counts.pending}
                  <span className="ml-2 text-base font-body font-medium text-muted-foreground">à faire</span>
                </p>
                {/* Une journée vide affichait « 0 must · 0 nice · 0 fait · 0/5 » :
                    quatre zéros qui n'apprennent rien et accueillent mal. */}
                {total > 0 && (
                  <p className="mt-1.5 text-sm font-body text-muted-foreground tabular-nums">
                    {counts.must} must · {counts.nice} nice · {counts.done} fait ·{" "}
                    <span className={cn(counts.capReached && "text-amber-600 dark:text-amber-400 font-medium")}>
                      {counts.pending}/{counts.cap} engagées
                    </span>
                  </p>
                )}
              </>
            )}
          </div>
          <button
            onClick={() => navigate("/sprint")}
            className="inline-flex items-center gap-1.5 text-xs font-body font-semibold rounded-full px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <CalendarRange size={14} />
            Planifier
          </button>
        </div>
        {showHeadline && total > 0 && (
          <div className="mt-4 h-1.5 rounded-full bg-muted/50 overflow-hidden">
            {/* Le pourcentage chiffré doublait l'anneau du DayHero. La barre
                seule suffit : on la lit d'un coup d'œil. */}
            <div
              className={cn("h-full rounded-full transition-all duration-500", progress === 100 ? "bg-emerald-500" : "bg-primary/70")}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Pas terminé la veille — reprise en un tap, ignorable pour la journée */}
      {carryOver.length > 0 && (
        <div className="border-t border-border/60 bg-secondary/20 px-5 py-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <History size={13} className="text-muted-foreground/70" />
              <h3 className="text-eyebrow">
                Pas terminé {carryOver[0].day === toISODate(addDays(new Date(), -1)) ? "hier" : `le ${formatDateShort(carryOver[0].day)}`}
              </h3>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {carryOver.length}</span>
            </div>
            <button
              onClick={dismissCarryOver}
              aria-label="Ignorer pour aujourd'hui"
              title="Ignorer pour aujourd'hui"
              className="p-1 -mr-1 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <ul className="space-y-1">
            {carryOver.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5">
                <span className="w-12 shrink-0 text-right text-[11px] font-mono tabular-nums text-muted-foreground/60">
                  {minToHHMM(b.startMin)}
                </span>
                <span className="flex-1 min-w-0 text-[13px] font-body text-foreground/90 truncate">{b.title}</span>
                <button
                  onClick={() => carryBlock(b)}
                  disabled={createBlock.isPending}
                  className="inline-flex items-center gap-1 text-[11px] font-body font-medium rounded-full px-2 py-0.5 text-primary hover:bg-primary/10 transition-colors shrink-0"
                >
                  <Plus size={12} /> Reprendre
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lane horaire — blocs libres + tâches planifiées, chronologique */}
      {timedRows.length > 0 && (
        <div className="border-t border-border/60 px-4 sm:px-5 py-3">
          <ul className="space-y-1.5">
            {timedRows.map((row, i) => (
              <li key={row.block.id}>
                {i === nowIndex && <NowLine nowMin={nowMin} />}
                {row.type === "task" ? (
                  <SwipeableRow
                    enabled={isMobile && !row.done}
                    onSwipe={() => completeTimed(row)}
                    actionLabel="Terminé"
                    actionIcon={<CheckCircle2 size={16} />}
                    contentClassName="bg-card"
                  >
                    <TimedTaskRow
                      row={row}
                      day={day}
                      past={(row.block.endMin ?? row.block.startMin) < nowMin}
                      onComplete={() => completeTimed(row)}
                      onUncomplete={() => onUncomplete(row.item)}
                      onOpen={() => onOpen(row.item)}
                      onEditTime={() => setSchedTarget({ item: row.item, block: row.block })}
                    />
                  </SwipeableRow>
                ) : (
                  <SwipeableRow
                    enabled={isMobile && !row.orphan && !row.done}
                    onSwipe={() => toggleFreeBlock(row.block, row.done)}
                    actionLabel="Terminé"
                    actionIcon={<CheckCircle2 size={16} />}
                    contentClassName="bg-card"
                  >
                    <FreeBlockRow
                      block={row.block}
                      orphan={row.orphan}
                      done={row.done}
                      doneMin={row.doneMin}
                      past={(row.block.endMin ?? row.block.startMin) < nowMin}
                      onToggle={row.orphan ? undefined : () => toggleFreeBlock(row.block, row.done)}
                      onDelete={() => { haptic("tap"); deleteBlock.mutate(row.block.id); }}
                    />
                  </SwipeableRow>
                )}
              </li>
            ))}
            {nowIndex === -1 && <li><NowLine nowMin={nowMin} /></li>}
          </ul>
        </div>
      )}

      {/* Sans heure — les tâches engagées pas encore posées sur la timeline.
          Le compteur d'engagement (X/5) vit dans l'en-tête, pas ici : il
          compte TOUTES les tâches du jour, planifiées comprises. */}
      {untimed.length > 0 && (
        <div className="border-t border-border/60">
          {timedRows.length > 0 && (
            <div className="flex items-center gap-2 px-5 pt-3 pb-1">
              <h3 className="text-eyebrow">Sans heure</h3>
              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">· {untimed.length}</span>
            </div>
          )}
          {isMobile && (
            <p className={cn("px-5 pb-1 text-[11px] font-body text-muted-foreground/55 italic", timedRows.length === 0 && "pt-2.5")}>
              Astuce : glisse une tâche vers la gauche pour la terminer.
            </p>
          )}
          <ul className="divide-y divide-border/50">
            {untimed.map((item) => (
              <li key={itemKey(item)}>
                <SwipeableRow
                  enabled={isMobile}
                  onSwipe={() => onComplete(item)}
                  actionLabel="Terminé"
                  actionIcon={<CheckCircle2 size={16} />}
                  contentClassName="bg-card"
                >
                  <PlanRow
                    item={item}
                    onComplete={() => onComplete(item)}
                    onOpen={() => onOpen(item)}
                    onSchedule={() => setSchedTarget({ item })}
                  />
                </SwipeableRow>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Journée sans tâches engagées — état vide slim (blocs et inbox restent) */}
      {flagged.length === 0 && (
        <div className="border-t border-border/60 px-5 py-6 text-center">
          {counts.done > 0 ? (
            <>
              <p className="font-display text-base font-bold text-foreground mb-1">Tout est fait 🎉</p>
              <p className="text-sm font-body text-muted-foreground mb-3 max-w-sm mx-auto">
                Tu as terminé toutes tes tâches du jour. Profite — ou prends un peu d'avance.
              </p>
              <button
                onClick={() => navigate("/sprint")}
                className="inline-flex items-center gap-1.5 text-xs font-body font-medium rounded-full px-4 py-2 border border-border hover:bg-secondary transition-colors"
              >
                <CalendarRange size={14} /> Planifier la suite
              </button>
            </>
          ) : (
            <>
              <p className="font-display text-base font-bold text-foreground mb-1">Journée vierge</p>
              <p className="text-sm font-body text-muted-foreground mb-3 max-w-sm mx-auto">
                Rien d'engagé pour aujourd'hui. Choisis quelques tâches pour lancer ta journée.
              </p>
              <button
                onClick={() => navigate("/sprint")}
                className="inline-flex items-center gap-1.5 text-xs font-body font-semibold rounded-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <CalendarRange size={14} /> Planifier ma journée
              </button>
            </>
          )}
        </div>
      )}

      {/* Trier l'inbox — une tâche comme une autre ; se masque si vide */}
      <InboxPanel embedded />

      {/* Pied — ajouter un bloc libre au programme */}
      <div className="border-t border-border/50">
        <button
          onClick={() => setBlockDialogOpen(true)}
          className="w-full flex items-center gap-2 px-5 py-2.5 text-left text-xs font-body text-muted-foreground/70 hover:text-foreground hover:bg-secondary/40 transition-colors"
        >
          <Plus size={13} /> Ajouter un bloc
        </button>
      </div>

      <ScheduleDialog
        target={schedTarget}
        day={day}
        onClose={() => setSchedTarget(null)}
        onCreate={(data, onDone) => createBlock.mutate(data, { onSuccess: onDone })}
        onUpdate={(id, patch, onDone) => updateBlock.mutate({ id, patch }, { onSuccess: onDone })}
        onRemove={(id) => { haptic("tap"); deleteBlock.mutate(id); }}
        pending={createBlock.isPending || updateBlock.isPending}
      />
      <AddBlockDialog
        open={blockDialogOpen}
        day={day}
        onClose={() => setBlockDialogOpen(false)}
        onCreate={(data, onDone) => createBlock.mutate(data, { onSuccess: onDone })}
        pending={createBlock.isPending}
      />
    </section>
  );
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

function TimeRail({ startMin, endMin }: { startMin: number; endMin: number | null }) {
  return (
    <div className="flex flex-col items-end pt-2 w-12 shrink-0">
      <span className="text-[11px] font-mono tabular-nums text-foreground/80">{minToHHMM(startMin)}</span>
      {endMin != null && (
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/50">{minToHHMM(endMin)}</span>
      )}
    </div>
  );
}

function NowLine({ nowMin }: { nowMin: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5" aria-hidden>
      <span className="w-12 shrink-0 text-right text-[10px] font-mono tabular-nums font-semibold text-primary">
        {minToHHMM(nowMin)}
      </span>
      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      <span className="flex-1 h-px bg-primary/40" />
    </div>
  );
}

/** Chip « estimation » d'une tâche planifiée terminée : à l'heure / +écart /
 *  simple heure de fait quand il n'y avait pas de fin prévue. */
function EstimateChip({ block, doneMin }: { block: TimeBlock; doneMin: number | null }) {
  if (doneMin == null) return null;
  const planned = `${minToHHMM(block.startMin)}${block.endMin != null ? `–${minToHHMM(block.endMin)}` : ""}`;
  const title = `Prévu ${planned} · fait à ${minToHHMM(doneMin)}`;
  if (block.endMin == null) {
    return (
      <span title={title} className="text-[10px] font-body px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
        fait à {minToHHMM(doneMin)}
      </span>
    );
  }
  const delta = doneMin - block.endMin;
  return delta <= 0 ? (
    <span title={title} className="text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0">
      à l'heure
    </span>
  ) : (
    <span title={title} className="text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 shrink-0">
      +{durationLabel(delta)}
    </span>
  );
}

function TimedTaskRow({ row, day, past, onComplete, onUncomplete, onOpen, onEditTime }: {
  row: Extract<TimedRow, { type: "task" }>;
  day: string;
  past: boolean;
  onComplete: () => void;
  onUncomplete: () => void;
  onOpen: () => void;
  onEditTime: () => void;
}) {
  const { block, item, done } = row;
  const { label, Icon } = itemSource(item);
  const must = itemIsMust(item);
  return (
    <div className={cn("flex items-stretch gap-3 group", past && !done && "opacity-60")}>
      <TimeRail startMin={block.startMin} endMin={block.endMin} />
      <div className={cn("w-1 rounded-full shrink-0", done ? "bg-emerald-500/70" : "bg-primary/60")} />
      <div className={cn(
        "flex-1 min-w-0 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        done ? "bg-emerald-50/50 dark:bg-emerald-500/8" : "bg-secondary/30 hover:bg-secondary/50",
      )}>
        <Checkbox
          checked={done}
          onCheckedChange={(v) => (v ? onComplete() : onUncomplete())}
          aria-label={done ? "Remettre à faire" : "Marquer comme terminé"}
          className="shrink-0 h-[18px] w-[18px] rounded-md border-muted-foreground/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
        />
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            {must && !done && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 rounded-full px-1.5 py-0.5 shrink-0">
                <Star size={8} className="fill-current" /> Must
              </span>
            )}
            <span className={cn(
              "text-sm font-body font-medium truncate",
              done ? "text-muted-foreground line-through" : "text-foreground",
            )}>
              {itemTitle(item)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-body text-muted-foreground/70 truncate">
            <Icon size={11} className="shrink-0" /> <span className="truncate">{label}</span>
          </div>
        </button>
        {done ? (
          <EstimateChip
            block={block}
            doneMin={block.doneMin ?? minutesFromTimestamp(
              item.kind === "subtask" ? item.subtask.completedAt : item.task.completedAt, day,
            )}
          />
        ) : (
          <>
            {block.endMin != null && (
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 shrink-0">
                {durationLabel(block.endMin - block.startMin)}
              </span>
            )}
            <button
              onClick={onEditTime}
              aria-label="Modifier l'heure"
              className="p-1 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Clock size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FreeBlockRow({ block, orphan, done, doneMin, past, onToggle, onDelete }: {
  block: TimeBlock; orphan: boolean; done: boolean; doneMin: number | null;
  past: boolean; onToggle?: () => void; onDelete: () => void;
}) {
  return (
    <div className={cn("flex items-stretch gap-3 group", (past || orphan) && !done && "opacity-60")}>
      <TimeRail startMin={block.startMin} endMin={block.endMin} />
      <div className={cn(
        "w-1 rounded-full shrink-0",
        done ? "bg-emerald-500/70" : orphan ? "bg-muted-foreground/30" : "bg-primary/60",
      )} />
      <div
        className={cn(
          "flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors",
          done ? "bg-emerald-50/50 dark:bg-emerald-500/8" : "bg-secondary/30",
        )}
        title={orphan && !done ? "Cette tâche n'est plus dans le plan du jour" : undefined}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {onToggle ? (
            <Checkbox
              checked={done}
              onCheckedChange={onToggle}
              aria-label={done ? "Remettre à faire" : "Marquer comme terminé"}
              className="shrink-0 h-[18px] w-[18px] rounded-md border-muted-foreground/40 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
          ) : done ? (
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          ) : null}
          <span className={cn(
            "text-sm font-body truncate",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}>
            {block.title || "Bloc"}
          </span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {done ? (
            <EstimateChip block={block} doneMin={doneMin} />
          ) : block.endMin != null ? (
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
              {durationLabel(block.endMin - block.startMin)}
            </span>
          ) : null}
          <button
            onClick={onDelete}
            aria-label="Supprimer le bloc"
            className="p-1 rounded-md text-muted-foreground/40 hover:text-red-600 hover:bg-red-50 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanRow({ item, onComplete, onOpen, onSchedule }: {
  item: TodayItem; onComplete: () => void; onOpen: () => void; onSchedule: () => void;
}) {
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
      <button
        onClick={onSchedule}
        aria-label="Donner une heure"
        title="Donner une heure"
        className="p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Clock size={14} />
      </button>
      <ArrowRight size={14} className="shrink-0 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
    </div>
  );
}

/* ── Dialogs ─────────────────────────────────────────────────────────────── */

type CreateBlockInput = {
  day: string; startMin: number; endMin?: number | null; title: string;
  refKind?: "subtask" | "task"; refId?: string;
};

/** Donner / modifier / retirer l'heure d'une tâche du sprint. */
function ScheduleDialog({ target, day, onClose, onCreate, onUpdate, onRemove, pending }: {
  target: { item: TodayItem; block?: TimeBlock } | null;
  day: string;
  onClose: () => void;
  onCreate: (data: CreateBlockInput, onDone: () => void) => void;
  onUpdate: (id: string, patch: { startMin: number; endMin: number | null }, onDone: () => void) => void;
  onRemove: (id: string) => void;
  pending: boolean;
}) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("");

  // Re-seed the fields each time the dialog opens on a new target.
  const targetId = target ? `${itemKey(target.item)}:${target.block?.id ?? "new"}` : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (target && seededFor !== targetId) {
    setSeededFor(targetId);
    setStart(target.block ? minToHHMM(target.block.startMin) : nextQuarter());
    setEnd(target.block?.endMin != null ? minToHHMM(target.block.endMin) : "");
  }

  const startMin = hhmmToMin(start);
  const endMin = end ? hhmmToMin(end) : null;
  const valid = start !== "" && (endMin == null || endMin > startMin);

  function submit() {
    if (!target || !valid) return;
    const done = () => { haptic("success"); onClose(); };
    if (target.block) {
      onUpdate(target.block.id, { startMin, endMin }, done);
    } else {
      onCreate({
        day, startMin, endMin,
        title: itemTitle(target.item),
        refKind: target.item.kind, refId: target.item.id,
      }, done);
    }
  }

  return (
    <ResponsiveDialog open={target != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="truncate">
            {target ? `Planifier « ${itemTitle(target.item)} »` : "Planifier"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="sd-start" className="text-xs">Début</Label>
              <Input id="sd-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="sd-end" className="text-xs">Fin <span className="text-muted-foreground/60">(optionnel)</span></Label>
              <Input id="sd-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] font-body text-muted-foreground/70">
            Avec une fin, tu sauras après coup si l'estimation tenait la route.
          </p>
          {!valid && <p className="text-[11px] text-destructive font-body">La fin doit être après le début.</p>}
        </div>
        <ResponsiveDialogFooter>
          {target?.block && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => { onRemove(target.block!.id); onClose(); }}
            >
              Retirer l'heure
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {target?.block ? "Modifier" : "Planifier"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** Ajouter un bloc libre (réunion, deep work…) au programme. */
function AddBlockDialog({ open, day, onClose, onCreate, pending }: {
  open: boolean;
  day: string;
  onClose: () => void;
  onCreate: (data: CreateBlockInput, onDone: () => void) => void;
  pending: boolean;
}) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [title, setTitle] = useState("");

  const startMin = hhmmToMin(start);
  const endMin = end ? hhmmToMin(end) : null;
  const valid = start !== "" && (endMin == null || endMin > startMin);

  function submit() {
    if (!valid) return;
    onCreate({ day, startMin, endMin, title: title.trim() }, () => {
      haptic("success");
      onClose();
      setTitle("");
    });
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nouveau bloc</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="tb-start" className="text-xs">Début</Label>
              <Input id="tb-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="tb-end" className="text-xs">Fin <span className="text-muted-foreground/60">(optionnel)</span></Label>
              <Input id="tb-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tb-title" className="text-xs">Intitulé</Label>
            <Input
              id="tb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Acompte WD2026"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>
          {!valid && <p className="text-[11px] text-destructive font-body">La fin doit être après le début.</p>}
        </div>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!valid || pending}>Ajouter</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
