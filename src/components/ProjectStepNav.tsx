import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { FileText, ClipboardCheck, ListTodo, Blocks, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { getCadrage } from "@/api/cadrage";
import { getProjectModules } from "@/api/modules";

const STEPS = [
  { key: "brief", label: "Brief", icon: FileText },
  { key: "cadrage", label: "Cadrage", icon: ClipboardCheck },
  { key: "modules", label: "Modules", icon: Blocks },
  { key: "etapes", label: "Etapes", icon: ListTodo },
  { key: "documents", label: "Documents", icon: FileText },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface ProjectStepNavProps {
  projectId: string;
  currentStep: StepKey;
  dirty?: boolean;
}

export function ProjectStepNav({ projectId, currentStep, dirty }: ProjectStepNavProps) {
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const { quotes } = useQuotes();
  const [completed, setCompleted] = useState<Set<StepKey>>(new Set());

  // Check completion for each step using lightweight API calls
  const checkCompletion = useCallback(async () => {
    const done = new Set<StepKey>();
    const project = getProject(projectId);

    // Brief: project exists = done
    if (project) done.add("brief");

    // Etapes: from project context (already loaded)
    if (project?.tasks && project.tasks.length > 0) done.add("etapes");

    // Documents: from quotes context (already loaded)
    const pQuotes = quotes.filter((q) => q.projectId === projectId);
    if (pQuotes.length > 0) done.add("documents");

    // Cadrage, Modules: lightweight API checks
    try {
      const [cadrage, modules] = await Promise.allSettled([
        getCadrage(projectId),
        getProjectModules(projectId),
      ]);
      if (cadrage.status === "fulfilled" && cadrage.value) done.add("cadrage");
      if (modules.status === "fulfilled" && modules.value?.modules?.length > 0) done.add("modules");
    } catch {}

    setCompleted(done);
  }, [projectId, getProject, quotes]);

  useEffect(() => {
    checkCompletion();
  }, [checkCompletion]);

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
        <nav className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
          {STEPS.map((step) => {
            const isActive = currentStep === step.key;
            const isDone = completed.has(step.key) && !isActive;
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => handleNavigate(step.key)}
                className={cn(
                  "relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-3 font-body text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : isDone
                      ? "border-emerald-400/50 text-emerald-600 hover:text-emerald-700"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {isDone ? (
                  <Check size={13} className="shrink-0 text-emerald-500" />
                ) : (
                  <Icon size={14} className="shrink-0" />
                )}
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
