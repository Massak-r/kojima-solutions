import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/ProjectsContext";

export function UpcomingDeadlines() {
  const navigate = useNavigate();
  const { projects } = useProjects();

  const upcomingDeadlines = useMemo(() => {
    const now = Date.now();
    const in14d = now + 14 * 86400000;
    return projects
      .filter(p => p.status === "in-progress" && p.endDate)
      .filter(p => {
        const end = new Date(p.endDate!).getTime();
        return end >= now && end <= in14d;
      })
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
      .slice(0, 5);
  }, [projects]);

  if (upcomingDeadlines.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Calendar size={14} className="text-amber-500" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Deadlines proches
        </h2>
      </div>
      <div className="divide-y divide-border/30">
        {upcomingDeadlines.map(p => {
          const daysLeft = Math.ceil((new Date(p.endDate!).getTime() - Date.now()) / 86400000);
          return (
            <div
              key={p.id}
              onClick={() => navigate(`/project/${p.id}/brief`)}
              className="flex items-center justify-between px-5 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-body font-medium text-foreground truncate">{p.title}</p>
                {p.client && <p className="text-[10px] text-muted-foreground font-body">{p.client}</p>}
              </div>
              <span className={cn(
                "text-xs font-mono font-semibold shrink-0 ml-2",
                daysLeft <= 3 ? "text-red-600" : daysLeft <= 7 ? "text-amber-600" : "text-muted-foreground",
              )}>
                {daysLeft <= 0 ? "Aujourd'hui" : `${daysLeft}j`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
