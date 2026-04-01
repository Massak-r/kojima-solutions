import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox, ChevronDown, ChevronRight, Loader2, Eye, Mail,
  Plus, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useToast } from "@/hooks/use-toast";
import {
  listIntakeResponses, updateIntakeResponse,
  type IntakeResponse, type Tier,
} from "@/api/funnels";
import { generateQuoteLinesFromModules } from "@/lib/moduleGenerators";
import { getModuleById } from "@/data/moduleCatalog";
import type { ModuleComplexity } from "@/types/module";
import { createEmptyQuote } from "@/types/quote";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  new:       { label: "Nouveau",  cls: "bg-red-100 text-red-600" },
  reviewed:  { label: "Vu",       cls: "bg-amber-100 text-amber-700" },
  converted: { label: "Converti", cls: "bg-emerald-100 text-emerald-700" },
};

const TIER_LABELS: Record<string, string> = {
  essential: "Essentiel",
  professional: "Professionnel",
  custom: "Sur mesure",
};

const TIER_COLORS: Record<string, string> = {
  essential: "bg-gray-100 text-gray-700",
  professional: "bg-blue-100 text-blue-700",
  custom: "bg-violet-100 text-violet-700",
};

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH");
}

export function IntakeManager() {
  const navigate = useNavigate();
  const { createProject, updateProject } = useProjects();
  const { addQuote } = useQuotes();
  const { clients, addClient } = useClients();
  const { toast } = useToast();
  const [intakes, setIntakes] = useState<IntakeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listIntakeResponses()
      .then(setIntakes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function markReviewed(id: string) {
    try {
      const updated = await updateIntakeResponse(id, { status: "reviewed" as IntakeResponse["status"] });
      setIntakes((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch {}
  }

  async function convertToProject(intake: IntakeResponse) {
    const responses = intake.responses ?? {};
    const projectType = (responses.projectType as string) ?? "";
    const selectedModules = (responses.selectedModules as { id: string; complexity: string }[]) ?? [];
    const estimate = responses.estimate as { low?: number; high?: number; yearly?: number } | undefined;
    const pageCount = (responses.pageCount as string) ?? "multi";
    const maintenance = (responses.maintenance as string) ?? "none";
    const hostingTier = (responses.hostingTier as string) ?? "simple";
    const company = (responses.company as string) ?? "";

    // Find or create client by email
    let clientId: string | undefined;
    if (intake.clientEmail) {
      const existing = clients.find(
        (c) => c.email?.toLowerCase() === intake.clientEmail.toLowerCase()
      );
      if (existing) {
        clientId = existing.id;
      } else {
        const newClient = addClient({
          name: intake.clientName || "Client",
          email: intake.clientEmail,
          organization: company || undefined,
        });
        clientId = newClient.id;
      }
    }

    // Create project
    const p = createProject();
    updateProject(p.id, {
      title: projectType || intake.clientName || "Nouveau projet",
      client: intake.clientName || "",
      clientId,
    });

    // Build quote line items from intake modules
    const moduleLines = selectedModules.length > 0
      ? generateQuoteLinesFromModules(
          selectedModules.map((m) => ({
            moduleId: m.id,
            complexity: m.complexity as ModuleComplexity,
          }))
        )
      : [];

    // Add base project line
    const baseLineId = crypto.randomUUID?.() ?? `line-${Date.now()}`;
    const baseLine = {
      id: baseLineId,
      description: "Base projet (design, responsive, mise en ligne)",
      quantity: 1,
      unitPrice: 1500,
    };

    // Add page count surcharge if applicable
    const pageExtras: Record<string, number> = { single: 0, multi: 500, large: 1500 };
    const pageExtra = pageExtras[pageCount] ?? 0;
    const lines = [baseLine, ...moduleLines];
    if (pageExtra > 0) {
      const pageLabels: Record<string, string> = { multi: "Multi-pages (3-10)", large: "Site étendu (10+)" };
      lines.push({
        id: crypto.randomUUID?.() ?? `line-page-${Date.now()}`,
        description: `Pages supplémentaires (${pageLabels[pageCount] ?? pageCount})`,
        quantity: 1,
        unitPrice: pageExtra,
      });
    }

    // Create draft quote
    const quoteBase = createEmptyQuote("fr");
    const now = new Date();
    const quoteId = crypto.randomUUID?.() ?? `q-${Date.now()}`;
    const quote = {
      ...quoteBase,
      id: quoteId,
      createdAt: now.toISOString(),
      projectId: p.id,
      clientName: intake.clientName || "",
      clientEmail: intake.clientEmail || "",
      clientCompany: company,
      projectTitle: projectType || "Nouveau projet",
      projectDescription: estimate
        ? `Estimation: CHF ${formatCHF(estimate.low ?? 0)} – ${formatCHF(estimate.high ?? 0)}`
        : "",
      lineItems: lines,
    };
    addQuote(quote);

    // Mark intake as converted
    try {
      const updated = await updateIntakeResponse(intake.id, {
        status: "converted" as IntakeResponse["status"],
        projectId: p.id,
      });
      setIntakes((prev) => prev.map((i) => (i.id === intake.id ? updated : i)));
    } catch {}

    toast({ title: "Projet + devis créés", description: `${moduleLines.length} module(s) importé(s)` });
    navigate(`/quotes/${quoteId}`);
  }

  const newCount = intakes.filter((i) => i.status === "new").length;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Intakes
          </h2>
          {newCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {newCount}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-muted-foreground/40">{intakes.length} total</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-muted-foreground/30" />
        </div>
      ) : intakes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground/40 font-body">Aucune demande pour l'instant.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {intakes.map((intake) => {
            const st = STATUS_STYLES[intake.status] ?? STATUS_STYLES.new;
            const isExpanded = expandedId === intake.id;
            const responses = intake.responses ?? {};
            const projectType = (responses.projectType as string) ?? "";
            const goals = (responses.goals as string[]) ?? [];
            const audience = (responses.audience as string) ?? "";
            const timeline = (responses.timeline as string) ?? "";
            const refs = (responses.references as string[]) ?? [];
            const existingSite = responses.existingSite as { url?: string; feedback?: string } | null;
            const message = (responses.message as string) ?? "";
            const phone = (responses.phone as string) ?? "";
            const company = (responses.company as string) ?? "";
            const selectedModules = (responses.selectedModules as { id: string; complexity: string }[]) ?? [];
            const estimate = responses.estimate as { low?: number; high?: number; yearly?: number } | undefined;

            return (
              <div key={intake.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : intake.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-body font-medium text-foreground/80">
                        {intake.clientName || "Anonyme"}
                      </span>
                      <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0", st.cls)}>
                        {st.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40 font-body">
                      {projectType && <span>{projectType}</span>}
                      {selectedModules.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Package size={9} /> {selectedModules.length} modules
                        </span>
                      )}
                      {estimate && (
                        <span className="font-mono">
                          ~CHF {formatCHF(estimate.low ?? 0)}
                        </span>
                      )}
                      {intake.suggestedTier && (
                        <Badge variant="secondary" className={cn("text-[8px] px-1 py-0", TIER_COLORS[intake.suggestedTier] ?? "")}>
                          {TIER_LABELS[intake.suggestedTier] ?? intake.suggestedTier}
                        </Badge>
                      )}
                      <span>{new Date(intake.createdAt).toLocaleDateString("fr-CH")}</span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-muted-foreground/30 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="bg-secondary/10 rounded-xl p-3 space-y-2 text-xs font-body">
                      {intake.clientEmail && (
                        <Row label="Email" value={intake.clientEmail} />
                      )}
                      {phone && <Row label="Téléphone" value={phone} />}
                      {company && <Row label="Entreprise" value={company} />}
                      {projectType && <Row label="Type" value={projectType} />}
                      {timeline && <Row label="Délai" value={timeline} />}
                      {goals.length > 0 && <Row label="Objectifs" value={goals.join(", ")} />}
                      {audience && <Row label="Public cible" value={audience} />}
                      {refs.length > 0 && (
                        <Row label="Inspirations" value={refs.filter(Boolean).join(", ")} />
                      )}
                      {existingSite && existingSite.url && (
                        <Row label="Site existant" value={existingSite.url + (existingSite.feedback ? ` - ${existingSite.feedback}` : "")} />
                      )}
                      {message && <Row label="Message" value={message} />}
                    </div>

                    {/* Module details from intake */}
                    {selectedModules.length > 0 && (
                      <div className="bg-primary/5 rounded-xl p-3 space-y-1.5">
                        <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest">
                          Modules sélectionnés
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedModules.map((m) => {
                            const mod = getModuleById(m.id);
                            return (
                              <span
                                key={m.id}
                                className="text-[10px] font-body bg-background/80 border border-border/40 rounded-md px-2 py-0.5"
                              >
                                {mod?.name ?? m.id}
                                <span className="text-muted-foreground/40 ml-1">
                                  ({m.complexity})
                                </span>
                              </span>
                            );
                          })}
                        </div>
                        {estimate && (
                          <p className="text-xs font-mono text-foreground/70 mt-1">
                            Estimation: CHF {formatCHF(estimate.low ?? 0)} – {formatCHF(estimate.high ?? 0)}
                            {(estimate.yearly ?? 0) > 0 && (
                              <span className="text-muted-foreground/50"> + {formatCHF(estimate.yearly ?? 0)}/an</span>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {intake.status === "new" && (
                        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => markReviewed(intake.id)}>
                          <Eye size={12} /> Marquer vu
                        </Button>
                      )}
                      {intake.status !== "converted" && (
                        <Button size="sm" variant="default" className="text-xs gap-1.5" onClick={() => convertToProject(intake)}>
                          <Plus size={12} /> Créer projet + devis
                        </Button>
                      )}
                      {intake.clientEmail && (
                        <a
                          href={`mailto:${intake.clientEmail}?subject=Kojima Solutions - Votre projet`}
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          <Mail size={12} /> Répondre par email
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground/40 w-20 shrink-0">{label}</span>
      <span className="text-foreground/70 flex-1 break-words">{value}</span>
    </div>
  );
}
