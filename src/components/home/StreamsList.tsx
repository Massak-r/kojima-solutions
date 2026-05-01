import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Target, ChevronRight, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects, type StoredProject } from "@/contexts/ProjectsContext";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useClients } from "@/contexts/ClientsContext";
import type { UnifiedObjective } from "@/api/objectiveSource";

type StreamFilter = "all" | "projects" | "admin" | "personal";

interface ProjectStream {
  kind: "project";
  id: string;
  title: string;
  clientName?: string | null;
  pendingTasks: number;
  totalTasks: number;
  flaggedCount: number;
  completed: boolean; // project status === "completed"
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
  completed: boolean;
  raw: UnifiedObjective;
}

type Stream = ProjectStream | ObjectiveStream;

export function StreamsList() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { data: objectives = [] } = useObjectives();
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { getClient } = useClients();

  const [filter, setFilter] = useState<StreamFilter>("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const streams = useMemo<Stream[]>(() => {
    const projectStreams: ProjectStream[] = projects.map((p): ProjectStream => {
      const tasks = p.tasks ?? [];
      const pending = tasks.filter(t => t.status !== "completed").length;
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
        completed: p.status === "completed",
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
          completed: o.completed,
          raw: o,
        };
      });

    let merged: Stream[] = [...projectStreams, ...objectiveStreams];
    if (filter === "projects") merged = merged.filter(s => s.kind === "project");
    if (filter === "admin") merged = merged.filter(s => s.kind === "objective" && s.source === "admin");
    if (filter === "personal") merged = merged.filter(s => s.kind === "objective" && s.source === "personal");
    if (!showCompleted) merged = merged.filter(s => !s.completed);

    // Sort: flagged first, then by pending desc, then by title
    merged.sort((a, b) => {
      const fa = a.flaggedCount > 0 ? 0 : 1;
      const fb = b.flaggedCount > 0 ? 0 : 1;
      if (fa !== fb) return fa - fb;
      const pa = a.kind === "project" ? a.pendingTasks : a.pendingSubtasks;
      const pb = b.kind === "project" ? b.pendingTasks : b.pendingSubtasks;
      if (pa !== pb) return pb - pa;
      return a.title.localeCompare(b.title);
    });

    return merged;
  }, [projects, objectives, allSubtasks, getClient, filter, showCompleted]);

  function handleClick(s: Stream) {
    if (s.kind === "project") {
      navigate(`/project/${s.id}/etapes`);
    } else {
      navigate(`/objective/${s.source}/${s.id}`);
    }
  }

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderKanban size={14} className="text-foreground/60" />
          <h2 className="font-display text-xs font-bold text-foreground/70 uppercase tracking-wider">
            Mes streams
          </h2>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            · {streams.length}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPills filter={filter} onChange={setFilter} />
          <button
            onClick={() => setShowCompleted(v => !v)}
            className={cn(
              "text-[11px] font-body font-medium px-2.5 py-1 rounded-full border transition-colors",
              showCompleted
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {showCompleted ? "Avec terminés" : "Actifs seulement"}
          </button>
        </div>
      </div>

      {streams.length === 0 ? (
        <div className="text-center py-8 text-sm font-body text-muted-foreground/60">
          Rien à afficher avec ce filtre.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {streams.map(s => (
            <StreamRow key={`${s.kind}:${s.id}`} stream={s} onClick={() => handleClick(s)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterPills({ filter, onChange }: { filter: StreamFilter; onChange: (f: StreamFilter) => void }) {
  const opts: { value: StreamFilter; label: string }[] = [
    { value: "all",      label: "Tous"    },
    { value: "projects", label: "Projets" },
    { value: "admin",    label: "Admin"   },
    { value: "personal", label: "Perso"   },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5 gap-0.5">
      {opts.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-body font-medium rounded transition-colors",
            filter === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StreamRow({ stream, onClick }: { stream: Stream; onClick: () => void }) {
  const isProject = stream.kind === "project";
  const Icon = isProject ? FolderKanban : Target;
  const pending = isProject ? stream.pendingTasks : stream.pendingSubtasks;
  const total = isProject ? stream.totalTasks : stream.totalSubtasks;
  const progressPct = total === 0 ? 0 : Math.round(((total - pending) / total) * 100);

  return (
    <li>
      <button
        onClick={onClick}
        className="w-full text-left rounded-xl border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-center gap-3 px-3 py-2.5 group"
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          isProject ? "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        )}>
          <Icon size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-sm font-body font-medium text-foreground truncate",
            stream.completed && "line-through opacity-60",
          )}>
            {stream.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-body text-muted-foreground/70">
            {isProject ? (
              <>
                {stream.clientName && (
                  <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                    <User size={9} />
                    {stream.clientName}
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
        </div>

        {/* Progress mini-bar */}
        {total > 0 && (
          <div className="hidden sm:flex items-center gap-2 w-[100px] shrink-0">
            <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
              <div
                className={cn("h-full rounded-full", progressPct === 100 ? "bg-emerald-500" : "bg-primary/60")}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">{progressPct}%</span>
          </div>
        )}

        {stream.flaggedCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
            <Star size={9} className="fill-current" />
            {stream.flaggedCount}
          </span>
        )}

        <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
      </button>
    </li>
  );
}
