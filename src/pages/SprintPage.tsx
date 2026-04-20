import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Target, Play, Square, ChevronRight, Clock, Star, Sparkles, CornerDownRight, Sun, CalendarCheck2, Hourglass, CalendarPlus, Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listObjectives } from "@/api/objectives";
import type { ObjectiveItem } from "@/api/objectives";
import { listPersonalTodos } from "@/api/personalTodos";
import type { PersonalTodoItem } from "@/api/personalTodos";
import { listSubtasks, updateSubtask } from "@/api/todoSubtasks";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { useFocusSession, formatElapsed } from "@/components/objective/useFocusSession";
import { GlobalWeekSummary } from "@/components/objective/GlobalWeekSummary";
import { DailyCommitDialog } from "@/components/objective/DailyCommitDialog";
import { WeeklyReviewDialog } from "@/components/objective/WeeklyReviewDialog";
import { EFFORT_CONFIG } from "@/components/todos/SubtaskCard";
import type { ObjectiveSource } from "@/api/objectiveSource";
import { STATUS_CONFIG, PRIORITY_BORDER } from "@/lib/objectiveConstants";

const DAILY_COMMIT_KEY_PREFIX = "kojima-daily-commit-";
function todayKey() {
  return DAILY_COMMIT_KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

// Flagged subtasks that have been in the backlog longer than this are
// surfaced with a visible "stale" cue — signal to either finish or unflag.
const STALE_THRESHOLD_DAYS = 7;
function daysSinceFlagged(item: Pick<SubtaskItem, "flaggedAt" | "createdAt">): number {
  // Prefer the real flag timestamp; fall back to createdAt for rows from before
  // the flagged_at column existed.
  const raw = item.flaggedAt ?? item.createdAt;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

// ISO week year + week number, e.g. "2026-W16". Used to throttle the Friday review
// dialog so it auto-shows once per week rather than every visit.
function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}
const WEEKLY_REVIEW_KEY_PREFIX = "kojima-weekly-review-";

type SprintObjective = (ObjectiveItem | PersonalTodoItem) & { source: ObjectiveSource };

function findActiveSessionKey(): { source: ObjectiveSource; objectiveId: string } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const m = key.match(/^focus_session_(admin|personal)_(.+)$/);
      if (m) return { source: m[1] as ObjectiveSource, objectiveId: m[2] };
    }
  } catch {}
  return null;
}

export default function SprintPage() {
  const navigate = useNavigate();
  const [objectives, setObjectives] = useState<SprintObjective[]>([]);
  const [allSubtasks, setAllSubtasks] = useState<SubtaskItem[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, SubtaskItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<{ source: ObjectiveSource; objectiveId: string } | null>(() => findActiveSessionKey());
  const [showCommit, setShowCommit] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showFullDashboard, setShowFullDashboard] = useState(false);

  // Auto-trigger Friday review on Friday afternoons (>= 14h local), once per ISO week
  useEffect(() => {
    const now = new Date();
    const isFriday = now.getDay() === 5;
    if (!isFriday || now.getHours() < 14) return;
    const wk = isoWeekKey(now);
    try {
      if (!localStorage.getItem(WEEKLY_REVIEW_KEY_PREFIX + wk)) setShowReview(true);
    } catch {}
  }, []);

  function handleDismissReview() {
    try { localStorage.setItem(WEEKLY_REVIEW_KEY_PREFIX + isoWeekKey(new Date()), "seen"); } catch {}
  }

  // When a session ends, return to the normal dashboard for the next time one starts
  useEffect(() => {
    if (!activeKey) setShowFullDashboard(false);
  }, [activeKey]);

  useEffect(() => {
    Promise.all([
      listObjectives(),
      listPersonalTodos(),
      listSubtasks(undefined, "admin"),
      listSubtasks(undefined, "personal"),
    ])
      .then(([adminObjs, personalObjs, adminSubs, personalSubs]) => {
        const tagged: SprintObjective[] = [
          ...adminObjs.map(o => ({ ...o, source: "admin" as const })),
          ...personalObjs.map(o => ({ ...o, source: "personal" as const })),
        ];
        const activeObjs = tagged.filter(o => o.isObjective && !o.completed);
        setObjectives(activeObjs);

        const subs = [...adminSubs, ...personalSubs];
        setAllSubtasks(subs);
        const map: Record<string, SubtaskItem[]> = {};
        for (const s of subs) (map[s.parentId] ??= []).push(s);
        setSubtasksMap(map);

        // Auto-open the daily commit ritual once per day if there are pending flagged items
        try {
          if (!localStorage.getItem(todayKey())) {
            const pendingFlagged = subs.some(
              s => s.flaggedToday && !s.completed && activeObjs.some(o => o.id === s.parentId)
            );
            if (pendingFlagged) setShowCommit(true);
          }
        } catch {}
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCommit(kept: Set<string>, deferred: Set<string>) {
    // Persist locally first for snappy UI
    setAllSubtasks(prev => prev.map(s => deferred.has(s.id) ? { ...s, flaggedToday: false } : s));
    setSubtasksMap(prev => {
      const next: Record<string, SubtaskItem[]> = {};
      for (const [k, arr] of Object.entries(prev)) {
        next[k] = arr.map(s => deferred.has(s.id) ? { ...s, flaggedToday: false } : s);
      }
      return next;
    });
    try { localStorage.setItem(todayKey(), "done"); } catch {}
    // Fire-and-forget server updates
    await Promise.all([...deferred].map(id => updateSubtask(id, { flaggedToday: false }).catch(() => {})));
    void kept;
  }

  function handleSkipCommit() {
    try { localStorage.setItem(todayKey(), "skipped"); } catch {}
  }

  async function completeSubtask(subId: string) {
    setAllSubtasks(prev => prev.map(s => s.id === subId ? { ...s, completed: true } : s));
    setSubtasksMap(prev => {
      const next: Record<string, SubtaskItem[]> = {};
      for (const [k, arr] of Object.entries(prev)) {
        next[k] = arr.map(s => s.id === subId ? { ...s, completed: true } : s);
      }
      return next;
    });
    try { await updateSubtask(subId, { completed: true }); } catch {}
  }

  async function postponeSubtask(subId: string) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const patch = { flaggedToday: false, scheduledFor: tomorrow };
    setAllSubtasks(prev => prev.map(s => s.id === subId ? { ...s, ...patch } : s));
    setSubtasksMap(prev => {
      const next: Record<string, SubtaskItem[]> = {};
      for (const [k, arr] of Object.entries(prev)) {
        next[k] = arr.map(s => s.id === subId ? { ...s, ...patch } : s);
      }
      return next;
    });
    try { await updateSubtask(subId, patch); } catch {}
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      const curr = findActiveSessionKey();
      setActiveKey(prev => {
        if (!prev && !curr) return prev;
        if (prev && curr && prev.source === curr.source && prev.objectiveId === curr.objectiveId) return prev;
        return curr;
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const activeObjective = activeKey
    ? objectives.find(o => o.id === activeKey.objectiveId && o.source === activeKey.source)
    : null;

  const objectivesById = useMemo(() => {
    const map: Record<string, SprintObjective> = {};
    for (const o of objectives) map[o.id] = o;
    return map;
  }, [objectives]);

  const subtaskById = useMemo(() => {
    const m: Record<string, SubtaskItem> = {};
    for (const s of allSubtasks) m[s.id] = s;
    return m;
  }, [allSubtasks]);

  // Cross-objective sprint backlog: all flagged subtasks across every active objective
  const sprintBacklog = useMemo(() => {
    const flagged = allSubtasks.filter(s => s.flaggedToday && objectivesById[s.parentId]);
    // Show pending before completed; within each, by objective then order
    flagged.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const oa = objectivesById[a.parentId]?.order ?? 0;
      const ob = objectivesById[b.parentId]?.order ?? 0;
      if (oa !== ob) return oa - ob;
      return a.order - b.order;
    });
    return flagged;
  }, [allSubtasks, objectivesById]);

  const backlogPending = sprintBacklog.filter(s => !s.completed).length;
  const backlogDone    = sprintBacklog.filter(s =>  s.completed).length;

  const sorted = useMemo(() => {
    const priRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const statRank: Record<string, number> = { in_progress: 0, not_started: 1, blocked: 2, done: 3 };
    return [...objectives].sort((a, b) => {
      const aFlag = (subtasksMap[a.id] || []).some(s => s.flaggedToday && !s.completed) ? 0 : 1;
      const bFlag = (subtasksMap[b.id] || []).some(s => s.flaggedToday && !s.completed) ? 0 : 1;
      if (aFlag !== bFlag) return aFlag - bFlag;
      const pa = priRank[a.priority] ?? 3;
      const pb = priRank[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      const sa = statRank[a.status] ?? 3;
      const sb = statRank[b.status] ?? 3;
      return sa - sb;
    });
  }, [objectives, subtasksMap]);

  const objectiveTextById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of objectives) m[o.id] = o.text;
    return m;
  }, [objectives]);

  const hasPendingFlagged = sprintBacklog.some(s => !s.completed);
  const inRadicalFocus = !!(activeKey && activeObjective && !showFullDashboard);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Target size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Sprint</h1>
          <p className="text-sm text-muted-foreground font-body">Une action à la fois. Un objectif à la fois.</p>
        </div>
        {hasPendingFlagged && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCommit(true)}
            className="shrink-0 gap-1.5 rounded-full border-amber-300/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
            title="Commit du jour"
          >
            <Sun size={13} />
            <span className="hidden sm:inline">Commit du jour</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowReview(true)}
          className="shrink-0 gap-1.5 rounded-full text-muted-foreground hover:text-foreground"
          title="Bilan de la semaine"
        >
          <CalendarCheck2 size={13} />
          <span className="hidden sm:inline">Bilan semaine</span>
        </Button>
      </header>

      <DailyCommitDialog
        open={showCommit}
        onOpenChange={setShowCommit}
        items={sprintBacklog}
        objectiveTextById={objectiveTextById}
        subtaskById={subtaskById}
        onCommit={handleCommit}
        onSkip={handleSkipCommit}
      />

      <WeeklyReviewDialog
        open={showReview}
        onOpenChange={setShowReview}
        objectiveTextById={objectiveTextById}
        onDismiss={handleDismissReview}
      />

      {inRadicalFocus && activeKey && activeObjective ? (
        <RadicalFocusView
          source={activeKey.source}
          objective={activeObjective}
          subtasks={subtasksMap[activeObjective.id] || []}
          onComplete={completeSubtask}
          onShowDashboard={() => setShowFullDashboard(true)}
          onOpenWorkspace={() => navigate(`/objective/${activeKey.source}/${activeKey.objectiveId}`, { state: { from: "/sprint" } })}
        />
      ) : (
        <>
          {activeKey && activeObjective ? (
            <>
              <RunningSessionBanner
                source={activeKey.source}
                objective={activeObjective}
                subtasks={subtasksMap[activeObjective.id] || []}
                onOpen={() => navigate(`/objective/${activeKey.source}/${activeKey.objectiveId}`, { state: { from: "/sprint" } })}
              />
              <button
                onClick={() => setShowFullDashboard(false)}
                className="text-xs font-body text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                ← Mode focus radical
              </button>
            </>
          ) : (
            <EmptyFocusHint hasBacklog={backlogPending > 0} />
          )}

          {/* Cross-objective sprint backlog */}
          {loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : sprintBacklog.length > 0 ? (
            <SprintBacklog
              items={sprintBacklog}
              subtaskById={subtaskById}
              objectivesById={objectivesById}
              backlogPending={backlogPending}
              backlogDone={backlogDone}
              onJump={(source, objectiveId) => navigate(`/objective/${source}/${objectiveId}`, { state: { from: "/sprint" } })}
              onPostpone={postponeSubtask}
            />
          ) : null}

          <GlobalWeekSummary objectivesById={objectivesById} />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider">
                Objectifs actifs {!loading && `· ${objectives.length}`}
              </h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            ) : sorted.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
                <Target size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                <div className="text-sm font-body text-muted-foreground">Aucun objectif actif.</div>
                <div className="text-xs font-body text-muted-foreground/50 mt-1">
                  Créez un objectif depuis Kojima Space ou Personnel pour entrer en sprint.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sorted.map(obj => (
                  <ObjectiveCard
                    key={`${obj.source}:${obj.id}`}
                    objective={obj}
                    subtasks={subtasksMap[obj.id] || []}
                    onOpen={() => navigate(`/objective/${obj.source}/${obj.id}`, { state: { from: "/sprint" } })}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyFocusHint({ hasBacklog }: { hasBacklog: boolean }) {
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

function SprintBacklog({
  items, subtaskById, objectivesById, backlogPending, backlogDone, onJump, onPostpone,
}: {
  items: SubtaskItem[];
  subtaskById: Record<string, SubtaskItem>;
  objectivesById: Record<string, SprintObjective>;
  backlogPending: number;
  backlogDone: number;
  onJump: (source: ObjectiveSource, objectiveId: string) => void;
  onPostpone: (subId: string) => void;
}) {
  const pct = items.length === 0 ? 0 : Math.round((backlogDone / items.length) * 100);

  return (
    <section className="rounded-2xl border border-border/40 bg-gradient-to-br from-amber-50/30 via-card/40 to-card/30 dark:from-amber-500/5 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Star size={14} className="fill-amber-400 text-amber-400" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Sprint en cours
        </span>
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
          · {backlogPending} à faire {backlogDone > 0 && <>· {backlogDone} terminée{backlogDone > 1 ? "s" : ""}</>}
        </span>
        {items.length > 1 && (
          <div className="ml-auto flex items-center gap-2 min-w-[100px] max-w-[160px]">
            <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-amber-400")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">{pct}%</span>
          </div>
        )}
      </div>

      <ul className="space-y-1">
        {items.map(item => {
          const objective = objectivesById[item.parentId];
          const parentSub = item.parentSubtaskId ? subtaskById[item.parentSubtaskId] : null;
          const src: ObjectiveSource = item.source === "personal" ? "personal" : "admin";
          const effortCfg = item.effortSize ? EFFORT_CONFIG[item.effortSize] : null;
          const ageDays = daysSinceFlagged(item);
          const isStale = !item.completed && ageDays >= STALE_THRESHOLD_DAYS;
          return (
            <li key={item.id} className="relative group">
              <button
                onClick={() => onJump(src, item.parentId)}
                className={cn(
                  "w-full text-left rounded-xl border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-start gap-2.5 px-3 py-2.5 pr-16",
                  item.completed && "opacity-50",
                )}
              >
                <Star
                  size={13}
                  className={cn("shrink-0 mt-0.5 fill-current", item.completed ? "text-muted-foreground/40" : "text-amber-400")}
                />
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-body font-medium text-foreground break-words",
                    item.completed && "line-through text-muted-foreground",
                  )}>
                    {item.text}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground/70 mt-0.5 flex-wrap">
                    <span className="truncate max-w-[240px]">{objective?.text ?? "(objectif inconnu)"}</span>
                    {parentSub && (
                      <>
                        <CornerDownRight size={10} className="text-muted-foreground/40" />
                        <span className="truncate max-w-[200px]">{parentSub.text}</span>
                      </>
                    )}
                    {effortCfg && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border",
                        effortCfg.bg, effortCfg.text, effortCfg.border,
                      )}>
                        {effortCfg.short}
                      </span>
                    )}
                    {item.recurrence && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-400"
                        title={`Récurrente : ${item.recurrence}`}
                      >
                        <Repeat size={9} />
                        {item.recurrence === "daily" ? "Jour" : item.recurrence === "weekdays" ? "L-V" : item.recurrence === "weekly" ? "Hebdo" : "Mois"}
                      </span>
                    )}
                    {isStale && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
                        title={`Flaggée depuis ${ageDays} jour${ageDays > 1 ? "s" : ""} — à faire ou à retirer du sprint`}
                      >
                        <Hourglass size={9} />
                        {ageDays}j
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors mt-1 shrink-0" />
              </button>
              {!item.completed && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPostpone(item.id); }}
                  className="absolute right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-sky-600 transition-all p-1 rounded-md hover:bg-sky-50 dark:hover:bg-sky-500/10"
                  title="Repousser à demain"
                >
                  <CalendarPlus size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RunningSessionBanner({
  source, objective, subtasks, onOpen,
}: {
  source: ObjectiveSource;
  objective: SprintObjective;
  subtasks: SubtaskItem[];
  onOpen: () => void;
}) {
  const session = useFocusSession({ source, objectiveId: objective.id });
  const focused = subtasks.find(s => s.flaggedToday && !s.completed);

  return (
    <div className="rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            En cours
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-mono tabular-nums text-sm font-bold">
          <Clock size={14} />
          {formatElapsed(session.elapsedSec)}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} className="text-primary shrink-0" />
            <span className="text-sm font-body font-semibold text-foreground/70 truncate">{objective.text}</span>
          </div>
          {focused ? (
            <div className="text-base sm:text-lg font-display font-semibold text-foreground break-words flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
              {focused.text}
            </div>
          ) : (
            <div className="text-sm font-body text-muted-foreground italic">Aucune étape focalisée</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => session.stop()}
            className="h-9 px-4 rounded-full border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Square size={13} className="mr-1.5" />
            Stop
          </Button>
          <Button size="sm" onClick={onOpen} className="h-9 px-4 rounded-full">
            Ouvrir
            <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ObjectiveCard({
  objective, subtasks, onOpen,
}: {
  objective: SprintObjective;
  subtasks: SubtaskItem[];
  onOpen: () => void;
}) {
  const category = "category" in objective ? objective.category : undefined;
  const flagged   = subtasks.find(s => s.flaggedToday && !s.completed);
  const pending   = subtasks.filter(s => !s.completed);
  const completed = subtasks.filter(s => s.completed);
  const total     = subtasks.length;
  const pct       = total === 0 ? 0 : Math.round((completed.length / total) * 100);
  const statusCfg = STATUS_CONFIG[objective.status];
  const nextAction = flagged ?? pending[0] ?? null;

  return (
    <button
      onClick={onOpen}
      className={cn(
        "text-left rounded-2xl border border-l-4 bg-card/50 hover:bg-card/80 p-4 flex flex-col gap-3 transition-all group",
        PRIORITY_BORDER[objective.priority],
        flagged && "ring-1 ring-amber-300/40 bg-amber-50/10",
      )}
    >
      <div className="flex items-start gap-2">
        <Target size={14} className="text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-semibold text-foreground break-words line-clamp-2">
            {objective.text}
          </div>
          {category && (
            <div className="text-[10px] font-body text-muted-foreground/70 mt-0.5">{category}</div>
          )}
        </div>
        <ChevronRight size={15} className="text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
      </div>

      {nextAction ? (
        <div className="flex items-center gap-1.5 text-xs font-body text-foreground/70 bg-muted/30 rounded-lg px-2.5 py-1.5">
          {flagged ? (
            <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
          ) : (
            <Play size={10} className="text-muted-foreground/60 shrink-0" />
          )}
          <span className="truncate">{nextAction.text}</span>
        </div>
      ) : pending.length === 0 && completed.length > 0 ? (
        <div className="text-[11px] font-body text-emerald-600 dark:text-emerald-500">Toutes les étapes sont terminées ✓</div>
      ) : (
        <div className="text-[11px] font-body text-muted-foreground/50 italic">Aucune étape</div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        {total > 0 && (
          <>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {completed.length}/{total}
            </span>
          </>
        )}
        {objective.status !== "not_started" && (
          <span className={cn("text-[9px] font-body font-bold px-2 py-0.5 rounded-full", statusCfg.bg, statusCfg.text)}>
            {statusCfg.label}
          </span>
        )}
      </div>
    </button>
  );
}

function RadicalFocusView({
  source, objective, subtasks, onComplete, onShowDashboard, onOpenWorkspace,
}: {
  source: ObjectiveSource;
  objective: SprintObjective;
  subtasks: SubtaskItem[];
  onComplete: (subId: string) => Promise<void>;
  onShowDashboard: () => void;
  onOpenWorkspace: () => void;
}) {
  const session = useFocusSession({ source, objectiveId: objective.id });
  const focused = subtasks.find(s => s.flaggedToday && !s.completed);
  const remainingFlagged = subtasks.filter(s => s.flaggedToday && !s.completed).length;

  return (
    <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card/40 to-card/30 p-8 sm:p-12 min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          En cours
        </span>
      </div>

      <div className="font-mono tabular-nums text-5xl sm:text-6xl font-bold text-foreground mb-3">
        {formatElapsed(session.elapsedSec)}
      </div>

      <button
        onClick={onOpenWorkspace}
        className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors mb-8 flex items-center gap-1"
      >
        <Target size={11} />
        {objective.text}
        <ChevronRight size={11} />
      </button>

      {focused ? (
        <div className="max-w-xl mb-10">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-foreground/50">
              Action en cours
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-foreground break-words leading-tight">
            {focused.text}
          </h2>
        </div>
      ) : (
        <div className="text-sm font-body text-muted-foreground italic mb-10 max-w-xs">
          Aucune étape focalisée. Ouvrez l'objectif pour en marquer une, ou stoppez la session.
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-6">
        {focused && (
          <Button
            size="lg"
            onClick={() => onComplete(focused.id)}
            className="rounded-full px-6 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Star size={14} className="fill-white" />
            J'ai fini, je continue
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          onClick={() => session.stop()}
          className="rounded-full px-6 gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          <Square size={14} />
          J'ai fini, je stoppe
        </Button>
      </div>

      {remainingFlagged > 1 && (
        <div className="text-[11px] font-mono tabular-nums text-muted-foreground mb-3">
          · {remainingFlagged - (focused ? 1 : 0)} autre{(remainingFlagged - (focused ? 1 : 0)) > 1 ? "s" : ""} flaggée{(remainingFlagged - (focused ? 1 : 0)) > 1 ? "s" : ""} après celle-ci
        </div>
      )}

      <button
        onClick={onShowDashboard}
        className="text-[11px] font-body text-muted-foreground/60 hover:text-foreground underline-offset-2 hover:underline transition-colors mt-2"
      >
        Voir le tableau complet
      </button>
    </section>
  );
}
