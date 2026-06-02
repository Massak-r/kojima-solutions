import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import type { SubtaskItem } from "@/api/todoSubtasks";

/** Objectives go on the radar once they've been quiet this many days. */
const QUIET_DAYS = 14;

function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / 86_400_000);
}

/**
 * AlertsZone card — "Radar d'oubli". Surfaces objectives you *were* engaged with
 * (ever flagged/completed a subtask, or marked in-progress) but haven't touched
 * in ≥14 days. Distinct from "En retard" (deadline-based): this catches the
 * parallel tracks that quietly drop off the radar. Returns null when clear.
 */
export function NeglectRadar() {
  const navigate = useNavigate();
  const { data: objectives = [] } = useObjectives();
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { projects } = useProjects();
  const { clients } = useClients();

  const subsByObjective = useMemo(() => {
    const m: Record<string, SubtaskItem[]> = {};
    for (const s of allSubtasks) (m[s.parentId] ??= []).push(s);
    return m;
  }, [allSubtasks]);

  const projectsById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects) m[p.id] = p.title || "(Sans titre)";
    return m;
  }, [projects]);

  const clientsById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) m[c.id] = c.name;
    return m;
  }, [clients]);

  const silent = useMemo(() => {
    const out: { id: string; source: string; text: string; days: number; label: string | null }[] = [];
    for (const o of objectives) {
      if (o.completed || o.status === "done") continue;
      const subs = subsByObjective[o.id] ?? [];
      // Only consider tracks that were actually worked at some point — keeps
      // perpetually-dormant "someday" buckets off the radar.
      const engaged =
        o.status === "in_progress" ||
        subs.some((s) => s.completedAt || s.flaggedAt || s.completed || s.status === "in_progress");
      if (!engaged) continue;
      // Last real touch: prefer concrete sprint activity, else the row's own mtime.
      const workStamps = subs
        .flatMap((s) => [s.completedAt, s.flaggedAt])
        .filter((d): d is string => !!d)
        .map((d) => new Date(d).getTime());
      const last = workStamps.length ? Math.max(...workStamps) : new Date(o.updatedAt ?? o.createdAt).getTime();
      const days = daysSince(last);
      if (days < QUIET_DAYS) continue;
      const label =
        (o.linkedProjectId && projectsById[o.linkedProjectId]) ||
        (o.linkedClientId && clientsById[o.linkedClientId]) ||
        o.category ||
        (o.source === "personal" ? "Perso" : null);
      out.push({ id: o.id, source: o.source, text: o.text, days, label });
    }
    return out.sort((a, b) => b.days - a.days).slice(0, 5);
  }, [objectives, subsByObjective, projectsById, clientsById]);

  if (silent.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Radar size={14} className="text-violet-500" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Radar d'oubli
        </h2>
      </div>
      <div className="divide-y divide-border/30">
        {silent.map((s) => (
          <div
            key={`${s.source}-${s.id}`}
            onClick={() => navigate(`/objective/${s.source}/${s.id}`)}
            className="flex items-center justify-between px-5 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-body font-medium text-foreground truncate">{s.text}</p>
              {s.label && <p className="text-[10px] text-muted-foreground font-body truncate">{s.label}</p>}
            </div>
            <span
              className={cn(
                "text-xs font-mono font-semibold shrink-0 ml-2",
                s.days >= 30 ? "text-red-600" : s.days >= 21 ? "text-amber-600" : "text-muted-foreground",
              )}
            >
              {s.days}j
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
