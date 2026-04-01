import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { totalQuote } from "@/types/quote";
import { Plus, FileBarChart, Pencil, ChevronRight, Blocks, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { getProjectModules } from "@/api/modules";
import { generateQuoteLinesFromModules } from "@/lib/moduleGenerators";
import { MAINTENANCE_OPTIONS } from "@/data/moduleCatalog";
import { useToast } from "@/hooks/use-toast";
import { createEmptyQuote, type Quote } from "@/types/quote";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  "to-validate": { label: "À valider", cls: "bg-amber-100 text-amber-700" },
  validated: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
  paid: { label: "Payé", cls: "bg-emerald-100 text-emerald-700" },
  "on-hold": { label: "En pause", cls: "bg-gray-100 text-gray-600" },
};

function formatCHF(n: number) {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 0 }) + " CHF";
}

export default function ProjectQuotes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { getClient } = useClients();
  const { quotes, addQuote, updateQuote } = useQuotes();
  const { toast } = useToast();
  const project = projects.find((p) => p.id === id);

  async function handleImportFromModules() {
    if (!id || !project) return;
    // Warn if quotes already exist for this project
    const existingProjectQuotes = quotes.filter((q) => q.projectId === id);
    if (existingProjectQuotes.length > 0) {
      const confirmed = window.confirm(
        `${existingProjectQuotes.length} devis existe(nt) déjà pour ce projet. Créer un nouveau devis depuis les modules ?`
      );
      if (!confirmed) return;
    }
    const data = await getProjectModules(id);
    if (!data || data.modules.length === 0) {
      toast({ title: "Aucun module sélectionné", variant: "destructive" });
      return;
    }
    const lines = generateQuoteLinesFromModules(data.modules);
    // Add maintenance line if applicable
    const maint = MAINTENANCE_OPTIONS.find((o) => o.tier === data.maintenance);
    if (maint && maint.price > 0) {
      lines.push({
        id: Math.random().toString(36).slice(2, 10),
        description: `Maintenance annuelle (${maint.label})`,
        quantity: 1,
        unitPrice: maint.price,
      });
    }
    const base = createEmptyQuote("fr");
    const quote: Quote = {
      ...base,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      projectId: id,
      projectTitle: project.title,
      clientName: (project.clientId ? getClient(project.clientId)?.name : null) || project.client || "",
      lineItems: lines,
    };
    addQuote(quote);
    toast({ title: `Devis créé avec ${lines.length} lignes` });
    navigate(`/quotes/${quote.id}`);
  }

  function handleConvertToInvoice(q: typeof quotes[0]) {
    const confirmed = window.confirm(
      `Convertir le devis ${q.quoteNumber || ""} en facture ?`
    );
    if (!confirmed) return;
    const now = new Date();
    const invoiceNumber = `FAC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    updateQuote(q.id, {
      ...q,
      docType: "invoice",
      quoteNumber: invoiceNumber,
      invoiceStatus: "to-validate",
    });
    toast({ title: "Devis converti en facture", description: invoiceNumber });
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground font-body">
        Projet introuvable.
      </div>
    );
  }

  // Filter quotes for this project
  const projectQuotes = quotes
    .filter((q) => q.projectId === id || q.projectTitle === project.title)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={project.id} currentStep="quotes" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <section className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileBarChart size={14} className="text-primary" />
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Devis & factures
              </h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleImportFromModules}>
                <Blocks size={12} /> Depuis les modules
              </Button>
              <Button size="sm" className="text-xs gap-1.5" onClick={() => navigate(`/quotes/new`)}>
                <Plus size={12} /> Nouveau devis
              </Button>
            </div>
          </div>

          {projectQuotes.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <FileBarChart size={32} className="text-muted-foreground/20 mx-auto" />
              <p className="text-sm text-muted-foreground/50 font-body">
                Aucun devis pour ce projet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {projectQuotes.map((q) => {
                const st = STATUS_STYLES[q.invoiceStatus ?? ""] ?? STATUS_STYLES.draft;
                const isInv = q.docType === "invoice";
                return (
                  <div
                    key={q.id}
                    onClick={() => navigate(`/quotes/${q.id}`)}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/20 cursor-pointer transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", isInv ? "border-accent/40 text-accent" : "border-primary/40 text-primary")}>
                          {isInv ? "FAC" : "DEV"}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground/60">{q.quoteNumber || "-"}</span>
                      </div>
                      <p className="text-sm font-body font-medium text-foreground/80">{q.clientName || "-"}</p>
                    </div>
                    <span className="text-sm font-body font-semibold text-foreground/80 tabular-nums">
                      {formatCHF(totalQuote(q))}
                    </span>
                    <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 shrink-0", st.cls)}>
                      {st.label}
                    </Badge>
                    {!isInv && (q.invoiceStatus === "validated" || q.invoiceStatus === "paid") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(q); }}
                        className="p-1.5 rounded-md text-muted-foreground/40 hover:text-accent hover:bg-accent/10 transition-colors shrink-0"
                        title="Convertir en facture"
                      >
                        <ArrowRightLeft size={13} />
                      </button>
                    )}
                    <ChevronRight size={13} className="text-muted-foreground/20 group-hover:text-muted-foreground transition-colors" />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
