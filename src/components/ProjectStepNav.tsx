import { useNavigate } from "react-router-dom";
import { FileText, ClipboardCheck, ListTodo, Blocks } from "lucide-react";
import { cn } from "@/lib/utils";

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
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => handleNavigate(step.key)}
                className={cn(
                  "relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-3 font-body text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
