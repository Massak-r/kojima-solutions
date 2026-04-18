import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { totalQuote, createEmptyQuote } from "@/types/quote";
import type { Quote } from "@/types/quote";
import {
  Plus, FileText, Pencil, Trash2, ChevronRight, Blocks, ArrowRightLeft, ListTodo,
} from "lucide-react";
import { getProjectModules } from "@/api/modules";
import { generateQuoteLinesFromModules, generateQuoteLinesFromSteps } from "@/lib/moduleGenerators";
import { MAINTENANCE_OPTIONS } from "@/data/moduleCatalog";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft:         { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  "to-validate": { label: "À valider", cls: "bg-amber-100 text-amber-700" },
  validated:     { label: "Validé",    cls: "bg-emerald-100 text-emerald-700" },
  paid:          { label: "Payé",      cls: "bg-emerald-100 text-emerald-700" },
  "on-hold":     { label: "En pause",  cls: "bg-gray-100 text-gray-600" },
};

const TYPE_PILLS = [
  { key: "all", label: "Tous" },
  { key: "quote", label: "Devis" },
  { key: "invoice", label: "Factures" },
];

function formatCHF(n: number) {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 0 }) + " CHF";
}

export default function ProjectDocuments() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const { getClient } = useClients();
  const { quotes, addQuote, updateQuote, deleteQuote } = useQuotes();
  const { toast } = useToast();
  const { settings: companySettings } = useCompanySettings();
  const project = getProject(id!);

  const [typeFilter, setTypeFilter] = useState("all");
  // null = list view | "new" | "edit:<quoteId>"
  const [mode, setMode] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-20 text-muted-foreground font-body">
          Projet introuvable.
        </div>
      </div>
    );
  }

  const projectQuotes = quotes
    .filter((q) => q.projectId === id || q.projectTitle === project.title)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredQuotes = typeFilter === "all"
    ? projectQuotes
    : typeFilter === "invoice"
      ? projectQuotes.filter((q) => q.docType === "invoice")
      : projectQuotes.filter((q) => q.docType !== "invoice");

  async function handleImportFromModules() {
    if (!id || !project) return;
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
    setMode(`edit:${quote.id}`);
  }

  function handleImportFromSteps() {
    if (!id || !project) return;
    const tasks = project.tasks ?? [];
    const withHours = tasks.filter((t) => t.estimatedHours && t.estimatedHours > 0);
    if (withHours.length === 0) {
      toast({ title: "Aucune étape avec des heures estimées", variant: "destructive" });
      return;
    }
    let rate = companySettings.defaultHourlyRate;
    if (!rate) {
      const input = window.prompt("Taux horaire (CHF/h) :", "120");
      if (!input) return;
      rate = Math.max(0, Number(input) || 0);
      if (!rate) return;
    }
    const lines = generateQuoteLinesFromSteps(withHours, rate);
    const skipped = tasks.length - withHours.length;
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
    const msg = skipped > 0
      ? `Devis créé avec ${lines.length} lignes (${skipped} étape(s) sans heures ignorée(s))`
      : `Devis créé avec ${lines.length} lignes`;
    toast({ title: msg });
    setMode(`edit:${quote.id}`);
  }

  function handleConvertToInvoice(q: Quote) {
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

  const handleSaved = () => setMode(null);
  const editingQuoteId = mode?.startsWith("edit:") ? mode.slice(5) : null;
  const editingQuote = editingQuoteId ? quotes.find((q) => q.id === editingQuoteId) : null;
  const editInitial = editingQuote
    ? (() => { const { id: _id, createdAt: _ca, ...rest } = editingQuote; return rest; })()
    : null;
  const newInitial = {
    ...createEmptyQuote(),
    projectTitle: project.title,
    clientName: (project.clientId ? getClient(project.clientId)?.name : null) || project.client || "",
    projectId: id!,
  };

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={project.id} currentStep="documents" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {mode ? (
          /* ── Form view ── */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {mode === "new" ? "Nouveau devis / facture" : "Modifier le document"}
              </h1>
              <Button variant="outline" size="sm" onClick={() => setMode(null)} className="text-xs">
                Retour à la liste
              </Button>
            </div>
            <QuoteForm
              initial={mode === "new" ? newInitial : editInitial}
              quoteId={editingQuoteId}
              onSaved={handleSaved}
            />
          </div>
        ) : (
          /* ── List view ── */
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Documents
                </h2>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleImportFromModules}>
                  <Blocks size={12} /> Depuis les modules
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleImportFromSteps}>
                  <ListTodo size={12} /> Depuis les étapes
                </Button>
                <Button size="sm" className="text-xs gap-1.5" onClick={() => setMode("new")}>
                  <Plus size={12} /> Nouveau
                </Button>
              </div>
            </div>

            {/* Type filter pills */}
            <div className="flex gap-1 px-5 py-2.5 border-b border-border/50">
              {TYPE_PILLS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setTypeFilter(p.key)}
                  className={cn(
                    "text-xs font-body px-2.5 py-1 rounded-full border transition-colors",
                    typeFilter === p.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground border-border hover:bg-secondary"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 self-center">
                {filteredQuotes.length} / {projectQuotes.length}
              </span>
            </div>

            {filteredQuotes.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <FileText size={32} className="text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground/50 font-body">
                  {projectQuotes.length === 0 ? "Aucun document pour ce projet." : "Aucun résultat."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {filteredQuotes.map((q) => {
                  const st = STATUS_STYLES[q.invoiceStatus ?? ""] ?? STATUS_STYLES.draft;
                  const isInv = q.docType === "invoice";
                  return (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 sm:gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-mono", isInv ? "border-accent/40 text-accent" : "border-primary/40 text-primary")}>
                            {isInv ? "FAC" : "DEV"}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground/60">{q.quoteNumber || "-"}</span>
                          <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 shrink-0", st.cls)}>
                            {st.label}
                          </Badge>
                        </div>
                        <p className="text-sm font-body font-medium text-foreground/80">{q.clientName || "-"}</p>
                      </div>

                      {/* Status selector */}
                      <select
                        value={q.invoiceStatus || "draft"}
                        onChange={(e) => updateQuote(q.id, { ...q, invoiceStatus: e.target.value as Quote["invoiceStatus"] })}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:block text-[10px] bg-secondary border border-border rounded-md px-1.5 py-0.5 text-foreground cursor-pointer hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 shrink-0"
                      >
                        <option value="draft">Brouillon</option>
                        <option value="to-validate">À valider</option>
                        <option value="validated">Validé</option>
                        <option value="paid">Payé</option>
                        <option value="on-hold">En pause</option>
                      </select>

                      <span className="text-sm font-body font-semibold text-foreground/80 tabular-nums shrink-0">
                        {formatCHF(totalQuote(q))}
                      </span>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {!isInv && (q.invoiceStatus === "validated" || q.invoiceStatus === "paid") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleConvertToInvoice(q); }}
                            className="p-1.5 rounded-md text-muted-foreground/40 hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Convertir en facture"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => setMode(`edit:${q.id}`)}
                          className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={13} />
                        </button>
                        {deleteConfirmId === q.id ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px]" onClick={() => { deleteQuote(q.id); setDeleteConfirmId(null); }}>Oui</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setDeleteConfirmId(null)}>Non</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(q.id)}
                            className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
