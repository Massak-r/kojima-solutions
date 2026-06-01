import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";

/**
 * "En retard" alert — surfaces overdue execution that the "Deadlines proches"
 * card hides (it filters end >= now). Shows in-progress projects past their
 * endDate plus uncompleted steps past their own deadline, most overdue first.
 * Returns null when nothing is late, so the card auto-collapses.
 */
export function OverdueWork() {
  const navigate = useNavigate();
  const { projects } = useProjects();

  const items = useMemo(() => {
    const now = Date.now();
    const out: { id: string; label: string; sub: string; daysOver: number; to: string }[] = [];
    for (const p of projects) {
      if (p.status !== "in-progress") continue;
      if (p.endDate) {
        const end = new Date(p.endDate).getTime();
        if (!Number.isNaN(end) && end < now) {
          out.push({
            id: `proj-${p.id}`,
            label: p.title,
            sub: p.client || "Échéance projet dépassée",
            daysOver: Math.floor((now - end) / 86400000),
            to: `/project/${p.id}/etapes`,
          });
        }
      }
      for (const tk of p.tasks ?? []) {
        if (tk.completed || tk.status === "completed" || !tk.deadline) continue;
        const d = new Date(tk.deadline).getTime();
        if (!Number.isNaN(d) && d < now) {
          out.push({
            id: `task-${p.id}-${tk.id}`,
            label: tk.title,
            sub: p.title,
            daysOver: Math.floor((now - d) / 86400000),
            to: `/project/${p.id}/etapes`,
          });
        }
      }
    }
    return out.sort((a, b) => b.daysOver - a.daysOver).slice(0, 6);
  }, [projects]);

  if (items.length === 0) return null;

  return (
    <section className="bg-card border border-red-200/50 dark:border-red-500/30 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <AlertTriangle size={14} className="text-red-500" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          En retard
        </h2>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((it) => (
          <div
            key={it.id}
            onClick={() => navigate(it.to)}
            className="flex items-center justify-between px-5 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-body font-medium text-foreground truncate">{it.label}</p>
              <p className="text-[10px] text-muted-foreground font-body truncate">{it.sub}</p>
            </div>
            <span className="text-xs font-mono font-semibold shrink-0 ml-2 text-red-600">
              {it.daysOver === 0 ? "Aujourd'hui" : `${it.daysOver}j`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
