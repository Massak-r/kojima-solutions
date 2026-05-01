import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/contexts/ProjectsContext";

/**
 * Compact alert listing client feedback responses pending admin review.
 * Returns null if no projects have answered feedback requests.
 */
export function PendingFeedback() {
  const navigate = useNavigate();
  const { projects } = useProjects();

  const items = useMemo(() => {
    const list: { projectId: string; projectTitle: string; clientName?: string; count: number }[] = [];
    for (const p of projects) {
      let count = 0;
      for (const t of p.tasks ?? []) {
        for (const r of t.feedbackRequests ?? []) {
          if (r.resolved && r.response) count++;
        }
      }
      if (count > 0) {
        list.push({ projectId: p.id, projectTitle: p.title, clientName: p.client, count });
      }
    }
    return list.sort((a, b) => b.count - a.count).slice(0, 8);
  }, [projects]);

  if (items.length === 0) return null;

  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-palette-amber" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Retours client
          </h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">
            {total}
          </Badge>
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((item) => (
          <button
            key={item.projectId}
            onClick={() => navigate(`/project/${item.projectId}/etapes`)}
            className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-secondary/40 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-body font-medium text-foreground truncate">
                {item.projectTitle}
              </div>
              {item.clientName && (
                <div className="text-[11px] font-body text-muted-foreground/70 truncate">
                  {item.clientName}
                </div>
              )}
            </div>
            <span className="text-[10px] font-body font-semibold bg-palette-amber/15 text-palette-amber border border-palette-amber/30 rounded-full px-2 py-0.5 shrink-0">
              {item.count} retour{item.count > 1 ? "s" : ""}
            </span>
            <ChevronRight size={13} className="text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
