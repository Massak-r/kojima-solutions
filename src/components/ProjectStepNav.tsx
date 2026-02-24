import { useNavigate } from "react-router-dom";
import { FileText, Map, Eye, MessageSquare } from "lucide-react";

const STEPS = [
  { key: "details", label: "Details", icon: FileText },
  { key: "roadmap", label: "Roadmap", icon: Map },
  { key: "overview", label: "Overview", icon: Eye },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface ProjectStepNavProps {
  projectId: string;
  currentStep: StepKey;
}

export function ProjectStepNav({ projectId, currentStep }: ProjectStepNavProps) {
  const navigate = useNavigate();

  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-4xl mx-auto px-6">
        <nav className="flex gap-0">
          {STEPS.map((step, i) => {
            const isActive = currentStep === step.key;
            const Icon = step.icon;
            return (
              <button
                key={step.key}
                onClick={() => navigate(`/project/${projectId}/${step.key}`)}
                className={`flex items-center gap-2 px-5 py-3 font-body text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
