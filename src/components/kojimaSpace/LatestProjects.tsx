import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Plus, MessageSquare, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { PROJECT_STATUS, PAYMENT_STATUS } from "./helpers";

interface LatestProjectsProps {
  onNewProject: () => void;
}

export function LatestProjects({ onNewProject }: LatestProjectsProps) {
  const navigate = useNavigate();
  const { projects, loading: projectsLoading } = useProjects();
  const { getClient } = useClients();

  const recentProjects = useMemo(
    () => [...projects]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    [projects],
  );

  const clientName = (p: { clientId?: string; client: string }) =>
    (p.clientId ? getClient(p.clientId)?.name : null) || p.client;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Derniers projets
        </h2>
        <Link
          to="/projects"
          className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Voir tout <ChevronRight size={11} />
        </Link>
      </div>

      {projectsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : recentProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground font-body mb-3">Aucun projet pour l'instant.</p>
          <Button onClick={onNewProject} size="sm" className="gap-1.5">
            <Plus size={13} /> Nouveau projet
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {recentProjects.map(project => {
            const tasks = project.tasks || [];
            const completedTasks = tasks.filter(t => t.completed).length;
            const totalTasks = tasks.length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const responses = tasks.flatMap(t => t.feedbackRequests || []).filter(r => r.resolved && r.response).length;
            const pSt = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.draft;
            const pay = PAYMENT_STATUS[project.paymentStatus] ?? PAYMENT_STATUS.unpaid;

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}/brief`)}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 cursor-pointer transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-display text-sm font-semibold text-foreground break-words">
                      {project.title}
                    </span>
                    {responses > 0 && (
                      <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-body font-semibold bg-palette-amber/15 text-palette-amber border border-palette-amber/30 rounded-full px-1.5 py-0.5">
                        <MessageSquare size={8} /> {responses}
                      </span>
                    )}
                  </div>
                  {clientName(project) && (
                    <p className="text-xs text-muted-foreground font-body">{clientName(project)}</p>
                  )}
                  {totalTasks > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 w-24 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-body">
                        {completedTasks}/{totalTasks} tâches
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${pay.cls}`}>{pay.label}</Badge>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${pSt.cls}`}>{pSt.label}</Badge>
                  <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
