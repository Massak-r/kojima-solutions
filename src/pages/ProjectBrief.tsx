import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { ProjectDetailsPanel } from "@/components/ProjectDetailsPanel";
import { getIntakeByProject, type IntakeResponse, type Tier } from "@/api/funnels";
import { FileText, Inbox, User, Mail, Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TIER_LABELS: Record<Tier, { label: string; color: string }> = {
  essential: { label: "Essentiel", color: "bg-muted text-muted-foreground" },
  professional: { label: "Professionnel", color: "bg-primary/15 text-primary" },
  custom: { label: "Sur mesure", color: "bg-violet-500/15 text-violet-600" },
};

const QUESTION_LABELS: Record<string, string> = {
  projectType: "Type de projet",
  goals: "Objectifs",
  audience: "Public cible",
  features: "Fonctionnalités souhaitées",
  references: "Références / inspirations",
  timeline: "Délai souhaité",
  budget: "Budget estimé",
  tier: "Formule choisie",
};

export default function ProjectBrief() {
  const { id } = useParams<{ id: string }>();
  const { projects, updateProject } = useProjects();
  const project = projects.find((p) => p.id === id);

  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getIntakeByProject(id)
      .then((list) => setIntake(list.length > 0 ? list[0] : null))
      .catch(() => {})
      .finally(() => setIntakeLoading(false));
  }, [id]);

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground font-body">
        Projet introuvable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={project.id} currentStep="brief" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Section 1: Project metadata */}
        <section>
          <ProjectDetailsPanel project={project} onChange={(updates) => updateProject(project.id, updates)} />
        </section>

        {/* Section 2: Intake brief */}
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <FileText size={14} className="text-primary" />
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Brief client
            </h2>
          </div>

          {intakeLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : !intake ? (
            <div className="p-5 text-center">
              <Inbox size={28} className="text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50 font-body">
                Aucun brief client lié à ce projet.
              </p>
              <p className="text-xs text-muted-foreground/30 font-body mt-1">
                Le brief apparaît automatiquement quand un intake est converti en projet.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Client info */}
              <div className="flex items-center gap-4 flex-wrap">
                {intake.clientName && (
                  <div className="flex items-center gap-1.5 text-sm font-body text-foreground">
                    <User size={13} className="text-muted-foreground" />
                    <span className="font-medium">{intake.clientName}</span>
                  </div>
                )}
                {intake.clientEmail && (
                  <a
                    href={`mailto:${intake.clientEmail}`}
                    className="flex items-center gap-1.5 text-sm font-body text-primary hover:underline"
                  >
                    <Mail size={13} />
                    {intake.clientEmail}
                  </a>
                )}
                {intake.suggestedTier && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${TIER_LABELS[intake.suggestedTier]?.color ?? ""}`}
                  >
                    <Star size={9} className="mr-1" />
                    {TIER_LABELS[intake.suggestedTier]?.label ?? intake.suggestedTier}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground font-body">
                  {new Date(intake.createdAt).toLocaleDateString("fr-CH")}
                </span>
              </div>

              {/* Responses */}
              <div className="grid gap-3">
                {Object.entries(intake.responses).map(([key, value]) => {
                  if (!value || (typeof value === "string" && !value.trim())) return null;
                  const label = QUESTION_LABELS[key] || key;
                  const display = Array.isArray(value) ? value.join(", ") : String(value);
                  return (
                    <div key={key} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <dt className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {label}
                      </dt>
                      <dd className="text-sm font-body text-foreground whitespace-pre-wrap">
                        {display}
                      </dd>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
