import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, FileText, Receipt } from "lucide-react";
import { createEmptyQuote, totalQuote } from "@/types/quote";
import type { Quote } from "@/types/quote";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:         { label: "Draft",       className: "bg-muted text-muted-foreground border-border" },
  "to-validate": { label: "To Validate", className: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
  validated:     { label: "Validated",   className: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
  paid:          { label: "Paid",        className: "bg-primary/10 text-primary border-primary/30" },
  "on-hold":     { label: "On Hold",     className: "bg-palette-rose/15 text-palette-rose border-palette-rose/30" },
};

export default function ProjectInvoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const { getClient } = useClients();
  const { quotes, deleteQuote, updateQuote } = useQuotes();
  const project = getProject(id!);

  // null = list view | "new" | "edit:<quoteId>"
  const [mode, setMode] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Project not found</p>
          <Button onClick={() => navigate("/projects")} variant="outline">
            <ArrowLeft size={14} className="mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const projectQuotes = quotes
    .filter((q) => q.projectId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSaved = () => setMode(null);

  const newInitial = {
    ...createEmptyQuote(),
    projectTitle: project.title,
    clientName: (project.clientId ? getClient(project.clientId)?.name : null) || project.client || "",
    projectId: id!,
  };

  const editingQuoteId = mode?.startsWith("edit:") ? mode.slice(5) : null;
  const editingQuote = editingQuoteId ? quotes.find((q) => q.id === editingQuoteId) : null;
  const editInitial = editingQuote
    ? (() => { const { id: _id, createdAt: _ca, ...rest } = editingQuote; return rest; })()
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-6 no-print">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => mode ? setMode(null) : navigate(`/project/${id}/feedback`)}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft size={16} className="mr-2" />
            {mode ? "Back to list" : "Feedback"}
          </Button>
          {!mode && (
            <Button
              size="sm"
              onClick={() => setMode("new")}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-xs gap-1.5"
            >
              <Plus size={14} /> New Quote
            </Button>
          )}
        </div>
      </header>

      <div className="no-print">
        <ProjectStepNav projectId={id!} currentStep="invoice" />
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {mode ? (
          /* ── Form view ── */
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground mb-6">
              {mode === "new" ? "New Quote / Invoice" : "Edit Quote"}
            </h1>
            <QuoteForm
              initial={mode === "new" ? newInitial : editInitial}
              quoteId={editingQuoteId}
              onSaved={handleSaved}
            />
          </div>
        ) : (
          /* ── List view ── */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground no-print">{project.title}</h1>
                <p className="font-body text-sm text-muted-foreground mt-1 no-print">Quotes &amp; Invoices</p>
              </div>
            </div>

            {projectQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-xl">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Receipt size={24} className="text-primary" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground mb-2">No documents yet</h2>
                <p className="font-body text-sm text-muted-foreground mb-5 max-w-xs">
                  Create your first quote or invoice for this project.
                </p>
                <Button onClick={() => setMode("new")} className="gap-2">
                  <Plus size={16} /> Create Quote
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {projectQuotes.map((q) => (
                  <div
                    key={q.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 hover:shadow-card-hover transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${q.docType === "invoice" ? "bg-accent/10" : "bg-primary/10"}`}>
                        <FileText size={18} className={q.docType === "invoice" ? "text-accent" : "text-primary"} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-display text-sm font-semibold text-foreground">{q.quoteNumber}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${q.docType === "invoice" ? "bg-accent/10 text-accent border-accent/30" : "bg-primary/10 text-primary border-primary/30"}`}
                          >
                            {q.docType === "invoice" ? "Facture" : "Devis"}
                          </Badge>
                        </div>
                        <p className="font-body text-xs text-muted-foreground truncate">{q.clientName || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Invoice status selector */}
                      <div className="flex items-center gap-2">
                        {(() => {
                          const status = (q.invoiceStatus || "draft") as Quote["invoiceStatus"] & string;
                          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
                          return (
                            <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>
                              {cfg.label}
                            </Badge>
                          );
                        })()}
                        <select
                          value={q.invoiceStatus || "draft"}
                          onChange={(e) => updateQuote(q.id, { ...q, invoiceStatus: e.target.value as Quote["invoiceStatus"] })}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground cursor-pointer hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30"
                        >
                          <option value="draft">Draft</option>
                          <option value="to-validate">To Validate</option>
                          <option value="validated">Validated</option>
                          <option value="paid">Paid</option>
                          <option value="on-hold">On Hold</option>
                        </select>
                      </div>
                      <div className="text-right hidden sm:block shrink-0">
                        <p className="font-display text-sm font-semibold text-foreground">
                          CHF {new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(totalQuote(q)).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'")}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setMode(`edit:${q.id}`)}
                          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        {deleteConfirmId === q.id ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => { deleteQuote(q.id); setDeleteConfirmId(null); }}>Supprimer</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(q.id)}
                            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
