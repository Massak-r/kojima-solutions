import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Sun, CalendarCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks, useUpdateSubtask } from "@/hooks/useSubtasks";
import { GlobalWeekSummary } from "@/components/objective/GlobalWeekSummary";
import { DailyCommitDialog } from "@/components/objective/DailyCommitDialog";
import { WeeklyReviewDialog } from "@/components/objective/WeeklyReviewDialog";
import { WeekPlanner } from "@/components/sprint/WeekPlanner";
import type { ObjectiveSource, UnifiedObjective } from "@/api/objectiveSource";
import {
  todayKey, isoWeekKey, findActiveSessionKey,
  WEEKLY_REVIEW_KEY_PREFIX, VIEW_MODE_KEY,
  type SprintViewMode,
} from "@/components/sprintPage/helpers";
import { EmptyFocusHint } from "@/components/sprintPage/EmptyFocusHint";
import { SprintBacklog } from "@/components/sprintPage/SprintBacklog";
import { RunningSessionBanner } from "@/components/sprintPage/RunningSessionBanner";
import { ObjectiveCard } from "@/components/sprintPage/ObjectiveCard";
import { RadicalFocusView } from "@/components/sprintPage/RadicalFocusView";

export default function SprintPage() {
  const navigate = useNavigate();
  const { data: allObjectives = [], isLoading: objLoading } = useObjectives();
  const { data: allSubtasks = [], isLoading: subLoading } = useAllSubtasks();
  const updateSubtaskMut = useUpdateSubtask();
  const loading = objLoading || subLoading;

  const objectives = useMemo<UnifiedObjective[]>(
    () => allObjectives.filter(o => o.isObjective && !o.completed),
    [allObjectives],
  );

  const subtasksMap = useMemo(() => {
    const map: Record<string, SubtaskItem[]> = {};
    for (const s of allSubtasks) (map[s.parentId] ??= []).push(s);
    return map;
  }, [allSubtasks]);

  const [activeKey, setActiveKey] = useState<{ source: ObjectiveSource; objectiveId: string } | null>(() => findActiveSessionKey());
  const [showCommit, setShowCommit] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showFullDashboard, setShowFullDashboard] = useState(false);
  const [viewMode, setViewMode] = useState<SprintViewMode>(() => {
    try {
      const v = localStorage.getItem(VIEW_MODE_KEY);
      return v === "week" ? "week" : "today";
    } catch { return "today"; }
  });

  function changeViewMode(m: SprintViewMode) {
    setViewMode(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch {}
  }

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

  // Auto-open the daily commit ritual once per day if there are pending flagged items
  const hasCheckedCommitRef = useRef(false);
  useEffect(() => {
    if (loading || hasCheckedCommitRef.current) return;
    hasCheckedCommitRef.current = true;
    try {
      if (!localStorage.getItem(todayKey())) {
        const pendingFlagged = allSubtasks.some(
          s => s.flaggedToday && !s.completed && objectives.some(o => o.id === s.parentId),
        );
        if (pendingFlagged) setShowCommit(true);
      }
    } catch {}
  }, [loading, allSubtasks, objectives]);

  function handleCommit(kept: Set<string>, deferred: Set<string>) {
    try { localStorage.setItem(todayKey(), "done"); } catch {}
    for (const id of deferred) {
      updateSubtaskMut.mutate({ id, patch: { flaggedToday: false } });
    }
    void kept;
  }

  function handleSkipCommit() {
    try { localStorage.setItem(todayKey(), "skipped"); } catch {}
  }

  function completeSubtask(subId: string) {
    updateSubtaskMut.mutate({ id: subId, patch: { completed: true } });
  }

  function postponeSubtask(subId: string) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    updateSubtaskMut.mutate({ id: subId, patch: { flaggedToday: false, scheduledFor: tomorrow } });
  }

  function updateSubtaskOptimistic(subId: string, patch: Partial<SubtaskItem>) {
    updateSubtaskMut.mutate({ id: subId, patch });
  }

  useEffect(() => {
    function refresh() {
      const curr = findActiveSessionKey();
      setActiveKey(prev => {
        if (!prev && !curr) return prev;
        if (prev && curr && prev.source === curr.source && prev.objectiveId === curr.objectiveId) return prev;
        return curr;
      });
    }
    function onStorage(e: StorageEvent) {
      if (e.key && !/^focus_session_(admin|personal)_/.test(e.key)) return;
      refresh();
    }
    // Same-tab: useFocusSession dispatches this when it writes/clears localStorage.
    // Cross-tab: storage event. Also re-check when the tab regains focus.
    window.addEventListener("focus-session-change", refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("focus-session-change", refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const activeObjective = activeKey
    ? objectives.find(o => o.id === activeKey.objectiveId && o.source === activeKey.source)
    : null;

  const objectivesById = useMemo(() => {
    const map: Record<string, UnifiedObjective> = {};
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
    <div className={cn(
      "mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 transition-[max-width]",
      viewMode === "week" && !inRadicalFocus ? "max-w-7xl" : "max-w-5xl",
    )}>
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

          <div className="flex gap-1 p-0.5 bg-muted/40 rounded-full w-fit">
            <button
              onClick={() => changeViewMode("today")}
              className={cn(
                "px-3 py-1 text-[11px] font-body font-semibold rounded-full transition-colors",
                viewMode === "today"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => changeViewMode("week")}
              className={cn(
                "px-3 py-1 text-[11px] font-body font-semibold rounded-full transition-colors",
                viewMode === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Semaine
            </button>
          </div>

          {viewMode === "week" ? (
            loading ? (
              <Skeleton className="h-96 rounded-2xl" />
            ) : (
              <WeekPlanner
                objectives={objectives}
                allSubtasks={allSubtasks}
                objectivesById={objectivesById}
                onUpdateSubtask={updateSubtaskOptimistic}
                onJump={(source, objectiveId) => navigate(`/objective/${source}/${objectiveId}`, { state: { from: "/sprint" } })}
              />
            )
          ) : (
            <>
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
        </>
      )}
    </div>
  );
}
