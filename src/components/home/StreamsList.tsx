import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban, Target, ChevronRight, Star, User, Flame,
  Activity, Pause, CheckCircle2, Repeat, Clock, AlertTriangle, Zap, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects, type StoredProject } from "@/contexts/ProjectsContext";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks, useUpdateSubtask } from "@/hooks/useSubtasks";
import { useClients } from "@/contexts/ClientsContext";
import { useFlagSubtask } from "@/hooks/useFlagSubtask";
import { useFlagProjectTask } from "@/hooks/useFlagProjectTask";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { TimelineTask } from "@/types/timeline";
import type { UnifiedObjective } from "@/api/objectiveSource";
import {
  computeProjectBucket, computeObjectiveBucket,
  pickActionableTasks, pickActionableSubtasks,
  isSubtaskUrgent, isTaskUrgent,
  type UrgencyBucket,
} from "@/lib/streamUrgency";

type StreamFilter = "urgent" | "active" | "all";

interface ProjectStream {
  kind: "project";
  id: string;
  title: string;
  clientName?: string | null;
  pendingTasks: number;
  totalTasks: number;
  flaggedCount: number;
  bucket: UrgencyBucket;
  nextActions: TimelineTask[];
  raw: StoredProject;
}

interface ObjectiveStream {
  kind: "objective";
  id: string;
  title: string;
  source: "admin" | "personal";
  category?: string;
  pendingSubtasks: number;
  totalSubtasks: number;
  flaggedCount: number;
  bucket: UrgencyBucket;
  nextActions: SubtaskItem[];
  raw: UnifiedObjective;
}

type Stream = ProjectStream | ObjectiveStream;

const BUCKET_ORDER: UrgencyBucket[] = ["urgent", "active", "idle", "done"];

const BUCKET_META: Record<UrgencyBucket, {
  label: string;
  emoji: string;
  Icon: typeof Flame;
  // Tailwind tokens
  pillBg: string;
  pillText: string;
  borderL: string;       // colored left border per row
  groupAccent: string;   // tinted group header background
  ringHover: string;     // hover ring colour
}> = {
  urgent: {
    label: "Urgent",
    emoji: "🔥",
    Icon: Flame,
    pillBg: "bg-red-100 dark:bg-red-500/15",
    pillText: "text-red-700 dark:text-red-300",
    borderL: "border-l-red-400 dark:border-l-red-500/70",
    groupAccent: "from-red-50/60 via-amber-50/40 to-transparent dark:from-red-500/5 dark:via-amber-500/5",
    ringHover: "hover:ring-red-200 dark:hover:ring-red-500/30",
  },
  active: {
    label: "En cours",
    emoji: "🎯",
    Icon: Activity,
    pillBg: "bg-indigo-100 dark:bg-indigo-500/15",
    pillText: "text-indigo-700 dark:text-indigo-300",
    borderL: "border-l-indigo-300 dark:border-l-indigo-500/60",
    groupAccent: "from-indigo-50/50 via-sky-50/30 to-transparent dark:from-indigo-500/5 dark:via-sky-500/5",
    ringHover: "hover:ring-indigo-200 dark:hover:ring-indigo-500/30",
  },
  idle: {
    label: "Au repos",
    emoji: "💤",
    Icon: Pause,
    pillBg: "bg-muted/60",
    pillText: "text-muted-foreground",
    borderL: "border-l-border",
    groupAccent: "from-muted/30 to-transparent",
    ringHover: "hover:ring-border",
  },
  done: {
    label: "Terminé",
    emoji: "✓",
    Icon: CheckCircle2,
    pillBg: "bg-emerald-100 dark:bg-emerald-500/15",
    pillText: "text-emerald-700 dark:text-emerald-300",
    borderL: "border-l-emerald-300 dark:border-l-emerald-500/40",
    groupAccent: "from-emerald-50/40 to-transparent dark:from-emerald-500/5",
    ringHover: "hover:ring-emerald-200 dark:hover:ring-emerald-500/30",
  },
};

export function StreamsList() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { data: objectives = [] } = useObjectives();
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { getClient } = useClients();

  const [filter, setFilter] = useState<StreamFilter>("active");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const streams = useMemo<Stream[]>(() => {
    const projectStreams: ProjectStream[] = projects.map((p): ProjectStream => {
      const tasks = p.tasks ?? [];
      const pending = tasks.filter(t => t.status !== "completed" && !t.completed).length;
      const total = tasks.length;
      const flagged = tasks.filter(t => t.flaggedToday && t.status !== "completed").length;
      const clientName = p.clientId ? getClient(p.clientId)?.name : null;
      return {
        kind: "project",
        id: p.id,
        title: p.title,
        clientName: clientName ?? p.client ?? null,
        pendingTasks: pending,
        totalTasks: total,
        flaggedCount: flagged,
        bucket: computeProjectBucket(p),
        nextActions: pickActionableTasks(p, 5),
        raw: p,
      };
    });

    const objectiveStreams: ObjectiveStream[] = objectives
      .filter(o => o.isObjective)
      .map((o): ObjectiveStream => {
        const subs = allSubtasks.filter(s => s.parentId === o.id);
        const pending = subs.filter(s => !s.completed).length;
        const total = subs.length;
        const flagged = subs.filter(s => s.flaggedToday && !s.completed).length;
        return {
          kind: "objective",
          id: o.id,
          title: o.text,
          source: o.source,
          category: o.category,
          pendingSubtasks: pending,
          totalSubtasks: total,
          flaggedCount: flagged,
          bucket: computeObjectiveBucket(o, subs),
          nextActions: pickActionableSubtasks(subs, 5),
          raw: o,
        };
      });

    return [...projectStreams, ...objectiveStreams];
  }, [projects, objectives, allSubtasks, getClient]);

  const filteredStreams = useMemo(() => {
    if (filter === "urgent") return streams.filter(s => s.bucket === "urgent");
    if (filter === "active") return streams.filter(s => s.bucket === "urgent" || s.bucket === "active");
    return streams;
  }, [streams, filter]);

  const grouped = useMemo(() => {
    const buckets: Record<UrgencyBucket, Stream[]> = { urgent: [], active: [], idle: [], done: [] };
    for (const s of filteredStreams) buckets[s.bucket].push(s);
    for (const k of BUCKET_ORDER) {
      buckets[k].sort((a, b) => {
        if (a.flaggedCount !== b.flaggedCount) return b.flaggedCount - a.flaggedCount;
        const pa = a.kind === "project" ? a.pendingTasks   : a.pendingSubtasks;
        const pb = b.kind === "project" ? b.pendingTasks   : b.pendingSubtasks;
        if (pa !== pb) return pb - pa;
        return a.title.localeCompare(b.title);
      });
    }
    return buckets;
  }, [filteredStreams]);

  function handleToggleExpand(s: Stream) {
    const key = streamKey(s);
    setExpandedKey(prev => (prev === key ? null : key));
  }

  function navigateToStream(s: Stream) {
    if (s.kind === "project") navigate(`/project/${s.id}/etapes`);
    else                      navigate(`/objective/${s.source}/${s.id}`);
  }

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderKanban size={14} className="text-foreground/60" />
          <h2 className="font-display text-xs font-bold text-foreground/70 uppercase tracking-wider">
            Mes streams
          </h2>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            · {filteredStreams.length}
          </span>
        </div>
        <FilterPills filter={filter} onChange={setFilter} streams={streams} />
      </div>

      {/* Top 3 cross-stream actions (C) */}
      <TopActionsRibbon streams={streams} onOpen={navigateToStream} />

      {/* Grouped streams (A) */}
      {filteredStreams.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-5">
          {BUCKET_ORDER.map(bucket => {
            const list = grouped[bucket];
            if (list.length === 0) return null;
            return (
              <UrgencyGroup
                key={bucket}
                bucket={bucket}
                streams={list}
                expandedKey={expandedKey}
                onToggleExpand={handleToggleExpand}
                onOpen={navigateToStream}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function streamKey(s: Stream): string {
  return s.kind === "project" ? `project:${s.id}` : `objective:${s.source}:${s.id}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Filter pills (F)
// ───────────────────────────────────────────────────────────────────────────

function FilterPills({
  filter, onChange, streams,
}: {
  filter: StreamFilter;
  onChange: (f: StreamFilter) => void;
  streams: Stream[];
}) {
  const counts = useMemo(() => {
    const urgent = streams.filter(s => s.bucket === "urgent").length;
    const active = streams.filter(s => s.bucket === "urgent" || s.bucket === "active").length;
    return { urgent, active, all: streams.length };
  }, [streams]);

  const opts: { value: StreamFilter; label: string; count: number; emoji?: string }[] = [
    { value: "urgent", label: "Urgents", count: counts.urgent, emoji: "🔥" },
    { value: "active", label: "Actifs",  count: counts.active },
    { value: "all",    label: "Tous",    count: counts.all },
  ];
  return (
    <div className="inline-flex rounded-full border border-border/60 bg-background/60 p-0.5 gap-0.5 shadow-sm">
      {opts.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 text-[11px] font-body font-medium rounded-full transition-all flex items-center gap-1.5",
            filter === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
          )}
        >
          {opt.emoji && <span className="text-[10px]">{opt.emoji}</span>}
          {opt.label}
          <span className={cn(
            "text-[10px] font-mono tabular-nums opacity-70",
            filter === opt.value ? "text-primary-foreground/80" : "",
          )}>
            {opt.count}
          </span>
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Top actions ribbon (C)
// ───────────────────────────────────────────────────────────────────────────

interface CrossAction {
  key: string;
  streamId: string;
  streamKind: "project" | "objective";
  streamTitle: string;
  itemTitle: string;
  flagged: boolean;
  reason: "flagged" | "high" | "due" | "recurrence";
  // For raw access
  source: "admin" | "personal" | null; // for objective
  subtask?: SubtaskItem;
  task?: TimelineTask;
  projectId?: string;
}

function TopActionsRibbon({
  streams, onOpen,
}: {
  streams: Stream[];
  onOpen: (s: Stream) => void;
}) {
  const navigate = useNavigate();
  const { flag: flagSubtask } = useFlagSubtask();
  const { flag: flagTask } = useFlagProjectTask();

  const top = useMemo<CrossAction[]>(() => {
    const items: CrossAction[] = [];
    for (const s of streams) {
      if (s.bucket !== "urgent") continue;
      if (s.kind === "project") {
        for (const t of s.nextActions) {
          if (!isTaskUrgent(t)) continue;
          items.push({
            key: `task:${t.id}`,
            streamId: s.id,
            streamKind: "project",
            streamTitle: s.title,
            itemTitle: t.title,
            flagged: !!t.flaggedToday,
            reason: t.flaggedToday ? "flagged" : "due",
            source: null,
            task: t,
            projectId: s.id,
          });
        }
      } else {
        for (const sub of s.nextActions) {
          if (!isSubtaskUrgent(sub)) continue;
          items.push({
            key: `sub:${sub.id}`,
            streamId: s.id,
            streamKind: "objective",
            streamTitle: s.title,
            itemTitle: sub.text,
            flagged: !!sub.flaggedToday,
            reason: sub.flaggedToday ? "flagged"
                  : sub.priority === "high" ? "high"
                  : sub.recurrence ? "recurrence"
                  : "due",
            source: s.source,
            subtask: sub,
          });
        }
      }
    }
    // Sort: flagged first, then high prio, then due, then recurrence
    items.sort((a, b) => {
      const af = a.flagged ? 0 : 1;
      const bf = b.flagged ? 0 : 1;
      if (af !== bf) return af - bf;
      const order: Record<CrossAction["reason"], number> = { flagged: 0, high: 1, due: 2, recurrence: 3 };
      return order[a.reason] - order[b.reason];
    });
    return items.slice(0, 3);
  }, [streams]);

  if (top.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-transparent dark:from-amber-500/8 dark:via-orange-500/4 p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <Zap size={12} className="text-amber-600 dark:text-amber-400" />
        <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          Top {top.length} action{top.length > 1 ? "s" : ""} aujourd'hui
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {top.map(a => (
          <TopActionCard
            key={a.key}
            action={a}
            onOpenStream={() => {
              const stream = streams.find(s => streamKey(s) === (
                a.streamKind === "project" ? `project:${a.streamId}` : `objective:${a.source}:${a.streamId}`
              ));
              if (stream) onOpen(stream);
            }}
            onNavigateItem={() => {
              if (a.streamKind === "project") navigate(`/project/${a.streamId}/etapes`);
              else                            navigate(`/objective/${a.source}/${a.streamId}`);
            }}
            onToggleFlag={() => {
              if (a.flagged) return;
              if (a.subtask) flagSubtask(a.subtask);
              else if (a.task && a.projectId) flagTask(a.projectId, a.task);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TopActionCard({
  action, onOpenStream, onNavigateItem, onToggleFlag,
}: {
  action: CrossAction;
  onOpenStream: () => void;
  onNavigateItem: () => void;
  onToggleFlag: () => void;
}) {
  const reasonChip = (() => {
    switch (action.reason) {
      case "flagged":    return { Icon: Star,         text: "Sprint",      cls: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15" };
      case "high":       return { Icon: AlertTriangle,text: "Prio haute",  cls: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15" };
      case "due":        return { Icon: Clock,        text: "Échéance",    cls: "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-500/15" };
      case "recurrence": return { Icon: Repeat,       text: "Récurrent",   cls: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15" };
    }
  })();

  return (
    <div className="rounded-lg bg-card/80 backdrop-blur border border-border/60 px-3 py-2.5 flex flex-col gap-1.5 group hover:border-amber-300/70 dark:hover:border-amber-500/40 transition-colors">
      <div className="flex items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-body font-semibold rounded-full px-1.5 py-0.5", reasonChip.cls)}>
          <reasonChip.Icon size={9} className={action.reason === "flagged" ? "fill-current" : ""} />
          {reasonChip.text}
        </span>
        <button
          onClick={onOpenStream}
          className="text-[10px] font-body text-muted-foreground hover:text-foreground truncate max-w-[140px] transition-colors"
          title={action.streamTitle}
        >
          {action.streamTitle}
        </button>
      </div>
      <button
        onClick={onNavigateItem}
        className="text-left text-[13px] font-body font-medium text-foreground line-clamp-2 leading-snug hover:text-primary transition-colors"
      >
        {action.itemTitle}
      </button>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <button
          onClick={onToggleFlag}
          disabled={action.flagged}
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-body font-medium rounded-full px-2 py-0.5 transition-colors",
            action.flagged
              ? "text-amber-700 dark:text-amber-400 cursor-default"
              : "text-muted-foreground hover:text-amber-700 hover:bg-amber-100 dark:hover:text-amber-400 dark:hover:bg-amber-500/15",
          )}
        >
          <Star size={10} className={action.flagged ? "fill-current" : ""} />
          {action.flagged ? "Dans le sprint" : "Ajouter au sprint"}
        </button>
        <button
          onClick={onNavigateItem}
          className="text-muted-foreground/50 group-hover:text-foreground transition-colors"
          aria-label="Ouvrir"
        >
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Urgency group (A) — header + rows
// ───────────────────────────────────────────────────────────────────────────

function UrgencyGroup({
  bucket, streams, expandedKey, onToggleExpand, onOpen,
}: {
  bucket: UrgencyBucket;
  streams: Stream[];
  expandedKey: string | null;
  onToggleExpand: (s: Stream) => void;
  onOpen: (s: Stream) => void;
}) {
  const meta = BUCKET_META[bucket];
  return (
    <div className={cn("rounded-xl bg-gradient-to-r p-0.5", meta.groupAccent)}>
      <div className="rounded-[11px] bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
          <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-body font-bold uppercase tracking-wider", meta.pillBg, meta.pillText)}>
            <meta.Icon size={10} />
            {meta.label}
          </span>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
            {streams.length}
          </span>
        </div>
        <ul className="divide-y divide-border/30">
          {streams.map(s => (
            <StreamRow
              key={streamKey(s)}
              stream={s}
              expanded={expandedKey === streamKey(s)}
              onToggleExpand={() => onToggleExpand(s)}
              onOpen={() => onOpen(s)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Stream row (collapsed + expanded)
// ───────────────────────────────────────────────────────────────────────────

function StreamRow({
  stream, expanded, onToggleExpand, onOpen,
}: {
  stream: Stream;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
}) {
  const isProject = stream.kind === "project";
  const Icon = isProject ? FolderKanban : Target;
  const pending = isProject ? stream.pendingTasks : stream.pendingSubtasks;
  const total   = isProject ? stream.totalTasks   : stream.totalSubtasks;
  const progressPct = total === 0 ? 0 : Math.round(((total - pending) / total) * 100);
  const meta = BUCKET_META[stream.bucket];

  const nextActionLabel = (() => {
    const next = stream.nextActions[0];
    if (!next) return null;
    return isProject ? (next as TimelineTask).title : (next as SubtaskItem).text;
  })();

  return (
    <li>
      <div
        className={cn(
          "border-l-2 transition-colors",
          meta.borderL,
          expanded && "bg-background/40",
        )}
      >
        <button
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className={cn(
            "w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors group",
            "hover:bg-background/60",
          )}
        >
          {/* Icon */}
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isProject
              ? "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          )}>
            <Icon size={14} />
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                "text-sm font-body font-medium text-foreground truncate",
                stream.bucket === "done" && "line-through opacity-60",
              )}>
                {stream.title}
              </div>
              {stream.flaggedCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 rounded-full px-1.5 py-0.5">
                  <Star size={9} className="fill-current" />
                  {stream.flaggedCount}
                </span>
              )}
            </div>

            {/* Sub-line: client / source · category · counts */}
            <div className="flex items-center gap-2 mt-0.5 text-[11px] font-body text-muted-foreground/80">
              {isProject ? (
                <>
                  {stream.clientName && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                      <User size={9} /> {stream.clientName}
                    </span>
                  )}
                  <span className="tabular-nums">{total - pending}/{total} tâches</span>
                </>
              ) : (
                <>
                  <span className="capitalize">{stream.source}</span>
                  {stream.category && <span className="truncate max-w-[120px]">· {stream.category}</span>}
                  <span className="tabular-nums">· {total - pending}/{total}</span>
                </>
              )}
            </div>

            {/* Next action (B) */}
            {!expanded && nextActionLabel && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-body text-foreground/70 truncate">
                <ArrowRight size={10} className="text-muted-foreground/60 shrink-0" />
                <span className="truncate">{nextActionLabel}</span>
              </div>
            )}
          </div>

          {/* Right: progress + chevron */}
          <div className="flex items-center gap-2.5 shrink-0">
            {total > 0 && (
              <div className="hidden sm:flex items-center gap-2 w-[88px]">
                <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      progressPct === 100 ? "bg-emerald-500" : "bg-primary/60",
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">{progressPct}%</span>
              </div>
            )}
            <ChevronRight
              size={14}
              className={cn(
                "text-muted-foreground/40 group-hover:text-foreground transition-all",
                expanded && "rotate-90 text-foreground",
              )}
            />
          </div>
        </button>

        {/* Expanded panel (E) */}
        {expanded && (
          <ExpandedPanel stream={stream} onOpen={onOpen} />
        )}
      </div>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Expanded panel
// ───────────────────────────────────────────────────────────────────────────

function ExpandedPanel({ stream, onOpen }: { stream: Stream; onOpen: () => void }) {
  const updateSubtask = useUpdateSubtask();
  const { flag: flagSubtask } = useFlagSubtask();
  const { flag: flagTask, unflag: unflagTask } = useFlagProjectTask();
  const { updateProjectTask } = useProjects();

  const actions = stream.nextActions;
  const moreCount = (stream.kind === "project" ? stream.pendingTasks : stream.pendingSubtasks) - actions.length;

  return (
    <div className="px-3 pb-3 pt-0.5 ml-11 mr-3 space-y-1">
      {actions.length === 0 ? (
        <div className="text-[12px] font-body text-muted-foreground/70 italic py-2">
          Plus rien d'ouvert sur ce stream.
        </div>
      ) : (
        <ul className="space-y-1">
          {actions.map(a => {
            if (stream.kind === "project") {
              const t = a as TimelineTask;
              const urgent = isTaskUrgent(t);
              return (
                <ActionRow
                  key={t.id}
                  title={t.title}
                  flagged={!!t.flaggedToday}
                  urgent={urgent}
                  metaText={t.deadline ? `Deadline ${t.deadline.slice(0, 10)}` : t.dateLabel || null}
                  locked={t.status !== "open"}
                  onToggleFlag={() => {
                    if (t.flaggedToday) unflagTask(stream.id, t.id);
                    else                flagTask(stream.id, t);
                  }}
                  onComplete={() => {
                    updateProjectTask(stream.id, t.id, {
                      status: "completed",
                      completed: true,
                      completedAt: new Date().toISOString(),
                    });
                  }}
                />
              );
            }
            const sub = a as SubtaskItem;
            const urgent = isSubtaskUrgent(sub);
            return (
              <ActionRow
                key={sub.id}
                title={sub.text}
                flagged={!!sub.flaggedToday}
                urgent={urgent}
                metaText={
                  sub.priority === "high" ? "Prio haute"
                  : sub.recurrence ? "Récurrent"
                  : sub.dueDate ? `Pour le ${sub.dueDate}`
                  : null
                }
                locked={false}
                onToggleFlag={() => {
                  if (sub.flaggedToday) {
                    updateSubtask.mutate({ id: sub.id, patch: { flaggedToday: false } });
                  } else {
                    flagSubtask(sub);
                  }
                }}
                onComplete={() => {
                  updateSubtask.mutate({ id: sub.id, patch: { completed: true } });
                }}
              />
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2 pt-1.5">
        {moreCount > 0 ? (
          <span className="text-[10px] font-body text-muted-foreground/70">
            + {moreCount} autre{moreCount > 1 ? "s" : ""}
          </span>
        ) : <span />}
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-[11px] font-body font-medium text-primary hover:underline underline-offset-2"
        >
          Ouvrir le stream
          <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

function ActionRow({
  title, flagged, urgent, metaText, locked, onToggleFlag, onComplete,
}: {
  title: string;
  flagged: boolean;
  urgent: boolean;
  metaText: string | null;
  locked: boolean;
  onToggleFlag: () => void;
  onComplete: () => void;
}) {
  return (
    <li className={cn(
      "flex items-center gap-2 rounded-lg px-2 py-1.5 group",
      "hover:bg-background/80 transition-colors",
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0",
        urgent ? "bg-red-400" : "bg-muted-foreground/30",
      )} />
      <span className="flex-1 min-w-0 text-[12.5px] font-body text-foreground/90 truncate">
        {title}
      </span>
      {metaText && (
        <span className="text-[10px] font-body text-muted-foreground hidden sm:inline truncate max-w-[120px]">
          {metaText}
        </span>
      )}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={onToggleFlag}
          disabled={locked}
          aria-label={flagged ? "Retirer du sprint" : "Ajouter au sprint"}
          className={cn(
            "p-1 rounded-md transition-colors",
            flagged
              ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
              : "text-muted-foreground/50 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10",
            locked && "opacity-30 cursor-not-allowed hover:bg-transparent",
          )}
        >
          <Star size={12} className={flagged ? "fill-current" : ""} />
        </button>
        <button
          onClick={onComplete}
          aria-label="Marquer comme terminé"
          className="p-1 rounded-md text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors"
        >
          <CheckCircle2 size={12} />
        </button>
      </div>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Empty state
// ───────────────────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: StreamFilter }) {
  const message = filter === "urgent"
    ? "Rien d'urgent — tu peux respirer."
    : filter === "active"
    ? "Aucun stream actif. Crée un projet ou un objectif pour démarrer."
    : "Aucun stream.";
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
        <FolderKanban size={18} className="text-muted-foreground/50" />
      </div>
      <p className="text-sm font-body text-muted-foreground/70">{message}</p>
    </div>
  );
}
