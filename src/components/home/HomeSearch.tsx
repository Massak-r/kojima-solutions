import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Target, FolderKanban, X } from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useObjectives } from "@/hooks/useObjectives";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/**
 * Top-of-Home search across projects + objectives. Jumps straight to the
 * project workspace or the objective workspace on pick. Quiet until you type.
 */
export function HomeSearch() {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { data: objectives = [] } = useObjectives();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return { projects: [], objectives: [] };
    return {
      objectives: objectives
        .filter((o) => o.isObjective && (o.text ?? "").toLowerCase().includes(query))
        .slice(0, 5),
      projects: projects
        .filter((p) => (p.title ?? "").toLowerCase().includes(query))
        .slice(0, 5),
    };
  }, [q, projects, objectives]);

  const hasResults = results.projects.length > 0 || results.objectives.length > 0;
  const showPanel = open && q.trim().length > 0;

  function reset() { setQ(""); setOpen(false); }
  function goProject(id: string) { haptic("tap"); reset(); navigate(`/project/${id}/etapes`); }
  function goObjective(source: string, id: string) { haptic("tap"); reset(); navigate(`/objective/${source}/${id}`); }

  return (
    <div className="relative mb-5">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { reset(); (e.target as HTMLInputElement).blur(); }
          }}
          placeholder="Rechercher un projet, un objectif…"
          aria-label="Rechercher un projet ou un objectif"
          className="w-full h-11 pl-9 pr-9 rounded-xl bg-card border border-border shadow-card text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
        />
        {q && (
          <button onClick={reset} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Effacer">
            <X size={15} />
          </button>
        )}
      </div>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute z-40 mt-1.5 w-full rounded-xl bg-card border border-border shadow-overlay overflow-hidden">
            {!hasResults ? (
              <p className="px-4 py-6 text-center text-sm font-body text-muted-foreground">
                Aucun résultat pour « {q.trim()} »
              </p>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto py-1.5">
                {results.objectives.length > 0 && (
                  <div>
                    <p className="px-3 pt-1.5 pb-1 text-eyebrow text-muted-foreground">Objectifs</p>
                    {results.objectives.map((o) => (
                      <button
                        key={`o-${o.id}`}
                        onClick={() => goObjective(o.source, o.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors"
                      >
                        <Target size={15} className="shrink-0 text-primary" />
                        <span className={cn("text-sm font-body truncate", o.completed ? "text-muted-foreground line-through" : "text-foreground")}>
                          {o.text}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {results.projects.length > 0 && (
                  <div>
                    <p className="px-3 pt-1.5 pb-1 text-eyebrow text-muted-foreground">Projets</p>
                    {results.projects.map((p) => (
                      <button
                        key={`p-${p.id}`}
                        onClick={() => goProject(p.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors"
                      >
                        <FolderKanban size={15} className="shrink-0 text-accent" />
                        <span className="text-sm font-body text-foreground truncate">{p.title || "Projet sans titre"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
