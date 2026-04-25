import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FileText, ClipboardCheck, ListTodo, Blocks, Check,
  User, Calendar, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { getCadrage } from "@/api/cadrage";
import { getProjectModules } from "@/api/modules";
import { KIND_LABELS, KIND_BADGE_CLASSES, STATUS_LABELS } from "@/types/project";

const STEPS = [
  { key: "brief", label: "Brief", icon: FileText },
  { key: "cadrage", label: "Cadrage", icon: ClipboardCheck },
  { key: "modules", label: "Modules", icon: Blocks },
  { key: "etapes", label: "Etapes", icon: ListTodo },
  { key: "documents", label: "Documents", icon: FileText },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const STATUS_DOT: Record<string, string> = {
  draft:         "bg-muted-foreground/40",
  "in-progress": "bg-primary",
  completed:     "bg-emerald-500",
  "on-hold":     "bg-amber-500",
};

interface ProjectStepNavProps {
  projectId: string;
  currentStep: StepKey;
  dirty?: boolean;
}

export function ProjectStepNav({ projectId, currentStep, dirty }: ProjectStepNavProps) {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { getClient } = useClients();
  const { quotes } = useQuotes();
  const project = projects.find((p) => p.id === projectId);
  const clientName = project?.clientId ? getClient(project.clientId)?.name : null;
  const clientDisplay = clientName || project?.client || null;

  const [cadrageDone, setCadrageDone] = useState(false);
  const [modulesDone, setModulesDone] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    getCadrage(projectId)
      .then((c) =>
        setCadrageDone(
          !!c && !!(c.objectives || c.inScope || c.deliverables || c.budgetValidated),
        ),
      )
      .catch(() => {});
    getProjectModules(projectId)
      .then((m) => setModulesDone(!!m && m.modules.length > 0))
      .catch(() => {});
  }, [projectId]);

  const completion: Record<StepKey, boolean> = {
    brief: !!project && (!!project.clientId || !!project.description?.trim()),
    cadrage: cadrageDone,
    modules: modulesDone,
    etapes: (project?.tasks ?? []).length > 0,
    documents: quotes.some((q) => q.projectId === projectId),
  };

  const doneCount = STEPS.reduce((n, s) => n + (completion[s.key] ? 1 : 0), 0);

  function handleNavigate(stepKey: string) {
    if (dirty) {
      const ok = window.confirm("Modifications non sauvegardées. Continuer ?");
      if (!ok) return;
    }
    navigate(`/project/${projectId}/${stepKey}`);
  }

  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <nav className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px" aria-label="Étapes du projet">
          {STEPS.map((step) => {
            const isActive = currentStep === step.key;
            const isDone = completion[step.key];
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => handleNavigate(step.key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-3 font-body text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{step.label}</span>
                {isDone ? (
                  <Check
                    size={12}
                    strokeWidth={3}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-primary" : "text-emerald-500",
                    )}
                    aria-label="Terminé"
                  />
                ) : (
                  <Circle
                    size={8}
                    className="shrink-0 text-muted-foreground/30 fill-transparent"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
          <div className="ml-auto hidden sm:flex items-center pl-3 pr-1 text-[10px] font-mono text-muted-foreground/60 tabular-nums whitespace-nowrap">
            {doneCount}/{STEPS.length}
          </div>
        </nav>

        {/* Horizontal summary strip — always visible, compact */}
        {project && (
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap py-1.5 -mt-px text-[11px] font-body text-muted-foreground">
            <span
              className="inline-flex items-center gap-1.5 shrink-0"
              title={STATUS_LABELS[project.status]}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  STATUS_DOT[project.status] ?? "bg-muted-foreground/40",
                )}
                aria-hidden
              />
              <span className="text-foreground/80">{STATUS_LABELS[project.status]}</span>
            </span>
            {(project.kind ?? "client") !== "client" && (
              <span
                className={cn(
                  "inline-flex items-center shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                  KIND_BADGE_CLASSES[project.kind ?? "client"],
                )}
              >
                {KIND_LABELS[project.kind ?? "client"]}
              </span>
            )}
            {clientDisplay && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <User size={11} className="shrink-0 opacity-60" />
                <span className="truncate max-w-[160px] sm:max-w-xs text-foreground/70">{clientDisplay}</span>
              </span>
            )}
            {(project.startDate || project.endDate) && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Calendar size={11} className="opacity-60" />
                <span className="tabular-nums">
                  {project.startDate ? formatShortDate(project.startDate) : "?"}
                  {project.endDate && ` → ${formatShortDate(project.endDate)}`}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  } catch {
    return dateStr;
  }
}
