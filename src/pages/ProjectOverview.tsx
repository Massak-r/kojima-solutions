import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { STATUS_LABELS, PAYMENT_LABELS } from "@/types/project";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Download,
  User,
  CalendarDays,
  CircleDot,
  FileText,
  CreditCard,
  StickyNote,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { ProjectData } from "@/types/project";
import { useState, useCallback } from "react";

const STATUS_ICONS: Record<ProjectData["status"], React.ReactNode> = {
  draft: <FileText size={14} />,
  "in-progress": <Clock size={14} />,
  completed: <CheckCircle2 size={14} />,
  "on-hold": <AlertCircle size={14} />,
};

const STATUS_COLORS: Record<ProjectData["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  "in-progress": "bg-primary/10 text-primary",
  completed: "bg-palette-sage/20 text-palette-sage",
  "on-hold": "bg-palette-amber/20 text-palette-amber",
};

const PAYMENT_COLORS: Record<ProjectData["paymentStatus"], string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-palette-amber/20 text-palette-amber",
  paid: "bg-palette-sage/20 text-palette-sage",
};

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  secondary: "bg-secondary",
  rose: "bg-palette-rose",
  sage: "bg-palette-sage",
  amber: "bg-palette-amber",
  violet: "bg-palette-violet",
};

const COLOR_BORDER_MAP: Record<string, string> = {
  primary: "border-primary/30",
  accent: "border-accent/30",
  secondary: "border-border",
  rose: "border-palette-rose/30",
  sage: "border-palette-sage/30",
  amber: "border-palette-amber/30",
  violet: "border-palette-violet/30",
};

type PrintSection = "all" | "summary" | "timeline";

export default function ProjectOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const project = getProject(id!);
  const [printSection, setPrintSection] = useState<PrintSection>("all");

  const handlePrint = useCallback((section: PrintSection) => {
    setPrintSection(section);
    // Allow state to update before printing
    setTimeout(() => {
      window.print();
      setPrintSection("all");
    }, 100);
  }, []);

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Project not found</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft size={14} className="mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground py-4 px-6 no-print">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft size={16} className="mr-2" />
            Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => handlePrint("summary")}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs"
            >
              <Download size={14} className="mr-1.5" />
              Summary PDF
            </Button>
            <Button
              variant="ghost"
              onClick={() => handlePrint("timeline")}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs"
            >
              <Download size={14} className="mr-1.5" />
              Roadmap PDF
            </Button>
            <Button
              variant="ghost"
              onClick={() => handlePrint("all")}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs"
            >
              <Download size={14} className="mr-1.5" />
              Full PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="no-print">
        <ProjectStepNav projectId={id!} currentStep="overview" />
      </div>

      {/* Overview content */}
      <main className="max-w-4xl mx-auto px-6 py-10 print-area">
        {/* Summary section */}
        <div className={printSection === "timeline" ? "print-section-hidden" : ""}>
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-display text-3xl md:text-4xl text-foreground font-bold mb-2">
              {project.title}
            </h1>
            {project.client && (
              <div className="flex items-center gap-2 text-muted-foreground font-body text-sm mb-3">
                <User size={14} />
                <span>{project.client}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-medium ${STATUS_COLORS[project.status]}`}>
                {STATUS_ICONS[project.status]}
                {STATUS_LABELS[project.status]}
              </span>
              {(project.startDate || project.endDate) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-medium bg-secondary text-secondary-foreground">
                  <CalendarDays size={12} />
                  {project.startDate && new Date(project.startDate).toLocaleDateString()}
                  {project.startDate && project.endDate && " → "}
                  {project.endDate && new Date(project.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {project.description && (
            <div className="mb-8">
              <p className="font-body text-foreground/80 text-sm leading-relaxed">{project.description}</p>
            </div>
          )}

          {(project.initialQuote || project.invoiceNumber) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {project.initialQuote && (
                <InfoCard icon={<CreditCard size={16} />} label="Initial Quote" value={project.initialQuote} />
              )}
              {project.revisedQuote && (
                <InfoCard icon={<CreditCard size={16} />} label="Revised Quote" value={project.revisedQuote} highlight />
              )}
              {project.invoiceNumber && (
                <InfoCard
                  icon={<FileText size={16} />}
                  label={`Invoice ${project.invoiceNumber}`}
                  value={PAYMENT_LABELS[project.paymentStatus]}
                  badgeClass={PAYMENT_COLORS[project.paymentStatus]}
                />
              )}
            </div>
          )}

          <Separator className="mb-8" />
        </div>

        {/* Timeline steps */}
        <div className={`mb-8 ${printSection === "summary" ? "print-section-hidden" : ""}`}>
          <h2 className="font-display text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
            <CircleDot size={18} className="text-primary" />
            Project Timeline
            <span className="text-xs font-body font-normal text-muted-foreground ml-2">
              {sorted.length} {sorted.length === 1 ? "step" : "steps"}
            </span>
          </h2>

          {sorted.length === 0 ? (
            <p className="text-muted-foreground font-body text-sm">No timeline steps defined.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-border rounded-full" />
              <div className="flex flex-col gap-6">
                {sorted.map((task, i) => (
                  <div key={task.id} className="relative flex gap-4">
                    <div className="relative z-10 flex-shrink-0 mt-1">
                      <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-xs font-body font-bold text-primary-foreground ${COLOR_MAP[task.color || "primary"]}`}>
                        {i + 1}
                      </div>
                    </div>
                    <div className={`flex-1 bg-card rounded-lg border ${COLOR_BORDER_MAP[task.color || "primary"]} p-4 shadow-sm`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                        <span className="text-xs font-body text-muted-foreground whitespace-nowrap">{task.dateLabel}</span>
                      </div>
                      {task.description && (
                        <div className="font-body text-xs text-foreground/70 leading-relaxed">
                          <RichText text={task.description} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {project.notes && (
          <div className={printSection === "timeline" ? "print-section-hidden" : ""}>
            <Separator className="mb-8" />
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <StickyNote size={18} className="text-primary" />
                Notes
              </h2>
              <div className="bg-card rounded-lg border border-border p-4">
                <p className="font-body text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{project.notes}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoCard({ icon, label, value, highlight, badgeClass }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean; badgeClass?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="font-body text-xs uppercase tracking-wider">{label}</span>
      </div>
      {badgeClass ? (
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-body font-medium ${badgeClass}`}>{value}</span>
      ) : (
        <p className="font-display text-lg font-semibold text-foreground">{value}</p>
      )}
    </div>
  );
}
