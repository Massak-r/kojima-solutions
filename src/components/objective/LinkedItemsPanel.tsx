import { useMemo, useState } from "react";
import { Link as LinkIcon, FolderKanban, Users, X } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import type { UnifiedObjective } from "@/api/objectiveSource";

interface LinkedItemsPanelProps {
  objective: UnifiedObjective;
  onLinkedProjectChange: (id: string | null) => void;
  onLinkedClientChange: (id: string | null) => void;
}

export function LinkedItemsPanel({ objective, onLinkedProjectChange, onLinkedClientChange }: LinkedItemsPanelProps) {
  const { projects } = useProjects();
  const { clients }  = useClients();

  const linkedProject = useMemo(
    () => (objective.linkedProjectId ? projects.find(p => p.id === objective.linkedProjectId) : null),
    [projects, objective.linkedProjectId],
  );
  const linkedClient = useMemo(
    () => (objective.linkedClientId ? clients.find(c => c.id === objective.linkedClientId) : null),
    [clients, objective.linkedClientId],
  );

  const [pickProject, setPickProject] = useState(false);
  const [pickClient,  setPickClient]  = useState(false);

  const hasAny = linkedProject || linkedClient || pickProject || pickClient;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Project */}
      {linkedProject ? (
        <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/20 pl-2 pr-1 py-0.5">
          <FolderKanban size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
          <RouterLink
            to={`/project/${linkedProject.id}/brief`}
            className="text-xs font-body font-semibold text-indigo-700 dark:text-indigo-300 hover:underline truncate max-w-[180px]"
          >
            {linkedProject.title}
          </RouterLink>
          <button
            onClick={() => onLinkedProjectChange(null)}
            className="text-indigo-500/70 hover:text-indigo-700 p-0.5"
            title="Retirer le lien"
          >
            <X size={11} />
          </button>
        </div>
      ) : pickProject ? (
        <select
          value=""
          onChange={e => { if (e.target.value) onLinkedProjectChange(e.target.value); setPickProject(false); }}
          onBlur={() => setPickProject(false)}
          autoFocus
          className="text-xs font-body bg-secondary/50 border border-border/50 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[240px]"
        >
          <option value="">Sélectionner un projet...</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setPickProject(true)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-body text-muted-foreground/70 hover:text-foreground rounded-full px-2.5 py-1 border border-dashed border-border/40 hover:border-border/70 transition-all",
          )}
        >
          <FolderKanban size={12} />
          <span>+ Lier un projet</span>
        </button>
      )}

      {/* Client */}
      {linkedClient ? (
        <div className="flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-200/50 dark:border-violet-500/20 pl-2 pr-1 py-0.5">
          <Users size={12} className="text-violet-600 dark:text-violet-400 shrink-0" />
          <RouterLink
            to="/clients"
            className="text-xs font-body font-semibold text-violet-700 dark:text-violet-300 hover:underline truncate max-w-[180px]"
          >
            {linkedClient.name}
          </RouterLink>
          <button
            onClick={() => onLinkedClientChange(null)}
            className="text-violet-500/70 hover:text-violet-700 p-0.5"
            title="Retirer le lien"
          >
            <X size={11} />
          </button>
        </div>
      ) : pickClient ? (
        <select
          value=""
          onChange={e => { if (e.target.value) onLinkedClientChange(e.target.value); setPickClient(false); }}
          onBlur={() => setPickClient(false)}
          autoFocus
          className="text-xs font-body bg-secondary/50 border border-border/50 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[240px]"
        >
          <option value="">Sélectionner un client...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => setPickClient(true)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-body text-muted-foreground/70 hover:text-foreground rounded-full px-2.5 py-1 border border-dashed border-border/40 hover:border-border/70 transition-all",
          )}
        >
          <Users size={12} />
          <span>+ Lier un client</span>
        </button>
      )}

      {!hasAny && (
        <span className="text-[10px] text-muted-foreground/40 font-body ml-1">
          <LinkIcon size={10} className="inline mr-1" />
          Associer cet objectif à un projet ou client
        </span>
      )}
    </div>
  );
}
