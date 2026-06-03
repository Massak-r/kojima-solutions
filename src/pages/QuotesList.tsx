import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2, Receipt, Search, Copy, ArrowUpDown, Bell, Check, Loader2, RefreshCw, BookmarkCheck, Coins, CalendarPlus, Users, Wallet } from "lucide-react";
import { formatDateSwiss } from "@/lib/dateFormat";
import { totalQuote, netSubtotalQuote } from "@/types/quote";
import type { Quote } from "@/types/quote";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuoteStatsPanel } from "@/components/quotes/QuoteStatsPanel";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { sendInvoiceReminder } from "@/api/invoiceReminder";

function formatCurrency(value: number, lang: "fr" | "en"): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CH" : "en-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

const STATUS_PILLS: { key: string; label: string }[] = [
  { key: "all",          label: "Tous" },
  { key: "draft",        label: "Brouillon" },
  { key: "to-validate",  label: "À valider" },
  { key: "validated",    label: "Validé" },
  { key: "paid",         label: "Payé" },
];

const TYPE_PILLS: { key: string; label: string }[] = [
  { key: "all",     label: "Tous" },
  { key: "quote",   label: "Devis" },
  { key: "invoice", label: "Factures" },
];

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "newest",    label: "Plus récent" },
  { key: "oldest",    label: "Plus ancien" },
  { key: "amount-up", label: "Montant ↑" },
  { key: "amount-down", label: "Montant ↓" },
  { key: "client",    label: "Client A-Z" },
];

export default function QuotesList() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { quotes, deleteQuote, addQuote } = useQuotes();
  const { clients } = useClients();
  const { projects } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();

  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState(searchParams.get("client") ?? "all");
  const [sortBy, setSortBy] = useState("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());

  const templateCount = useMemo(
    () => quotes.filter((q) => q.isTemplate === true).length,
    [quotes],
  );

  const { deleteWithUndo } = useUndoableDelete<Quote>({
    hardDelete: (id) => deleteQuote(id),
    restore: (quote) => addQuote(quote),
    message: (q) => t(
      q.isTemplate
        ? "Modèle supprimé"
        : q.docType === "invoice" ? "Facture supprimée" : "Devis supprimé",
      q.isTemplate
        ? "Template deleted"
        : q.docType === "invoice" ? "Invoice deleted" : "Quote deleted",
    ),
    undoLabel: t("Annuler", "Undo"),
  });

  async function handleSendReminder(q: Quote) {
    if (!q.clientEmail || sendingReminder) return;
    setSendingReminder(q.id);
    try {
      await sendInvoiceReminder({
        quoteId: q.id,
        clientEmail: q.clientEmail,
        clientName: q.clientName,
        quoteNumber: q.quoteNumber,
        amount: formatCurrency(totalQuote(q), q.lang),
      });
      setReminderSent((prev) => new Set(prev).add(q.id));
      toast({ title: "Rappel envoyé", description: `Email envoyé à ${q.clientEmail}` });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'envoyer le rappel.", variant: "destructive" });
    } finally {
      setSendingReminder(null);
    }
  }

  function isOverdue(q: Quote): boolean {
    if (q.invoiceStatus !== "validated") return false;
    if (!q.validityDate) return false;
    return new Date(q.validityDate).getTime() < Date.now();
  }

  // Resolve the selected client to its quote-matching keys (project ids +
  // email), mirroring the fiche 360 logic: a quote belongs to a client when
  // it's attached to one of their projects or carries their email.
  const clientMatch = useMemo(() => {
    if (clientFilter === "all") return null;
    const c = clients.find((cl) => cl.id === clientFilter);
    if (!c) return null;
    const projIds = new Set(projects.filter((p) => p.clientId === c.id).map((p) => p.id));
    return { projIds, email: c.email?.toLowerCase() };
  }, [clientFilter, clients, projects]);

  function changeClientFilter(value: string) {
    setClientFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("client");
    else next.set("client", value);
    setSearchParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    let list = [...quotes];
    // Templates are surfaced in a separate view to keep the main list clean.
    list = list.filter((q) => (q.isTemplate === true) === showTemplates);
    if (statusFilter !== "all") list = list.filter((q) => q.invoiceStatus === statusFilter);
    if (typeFilter !== "all") list = list.filter((q) => q.docType === typeFilter);
    if (clientMatch) {
      list = list.filter((q) =>
        (q.projectId && clientMatch.projIds.has(q.projectId)) ||
        (!!clientMatch.email && q.clientEmail?.toLowerCase() === clientMatch.email)
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((item) =>
        [item.quoteNumber, item.projectTitle, item.clientName].some((f) => f?.toLowerCase().includes(q))
      );
    }
    // Date range
    if (dateFrom) list = list.filter((q) => q.createdAt >= dateFrom);
    if (dateTo) list = list.filter((q) => q.createdAt <= dateTo + "T23:59:59");
    // Sort
    switch (sortBy) {
      case "oldest": list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case "amount-up": list.sort((a, b) => totalQuote(a) - totalQuote(b)); break;
      case "amount-down": list.sort((a, b) => totalQuote(b) - totalQuote(a)); break;
      case "client": list.sort((a, b) => (a.clientName || "").localeCompare(b.clientName || "")); break;
      default: list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [quotes, statusFilter, typeFilter, clientMatch, searchQuery, sortBy, dateFrom, dateTo, showTemplates]);

  function renewInvoice(original: Quote) {
    const year = new Date().getFullYear();
    const prefix = "FAC";
    const existing = quotes
      .filter((q) => q.docType === "invoice" && q.quoteNumber?.startsWith(`${prefix}-${year}`))
      .map((q) => {
        const parts = q.quoteNumber?.split("-");
        return parts && parts.length === 3 ? parseInt(parts[2], 10) : 0;
      });
    const nextNum = Math.max(0, ...existing) + 1;
    const newNumber = `${prefix}-${year}-${String(nextNum).padStart(3, "0")}`;

    // Set validity to 30 days from now
    const validity = new Date();
    validity.setDate(validity.getDate() + 30);

    const clone: any = {
      ...original,
      quoteNumber: newNumber,
      docType: "invoice",
      invoiceStatus: "draft",
      validityDate: validity.toISOString().slice(0, 10),
    };
    delete clone.id;
    delete clone.createdAt;
    delete clone.updatedAt;

    const newQuote = addQuote(clone);
    toast({ title: t("Facture renouvelée", "Invoice renewed") });
    if (newQuote && typeof newQuote === "object" && "id" in newQuote) {
      navigate(`/quotes/${(newQuote as any).id}`);
    }
  }

  function duplicateQuote(original: Quote) {
    const year = new Date().getFullYear();
    const prefix = original.docType === "invoice" ? "FAC" : "DEV";
    // Find next number
    const existing = quotes
      .filter((q) => q.docType === original.docType && q.quoteNumber?.startsWith(`${prefix}-${year}`))
      .map((q) => {
        const parts = q.quoteNumber?.split("-");
        return parts && parts.length === 3 ? parseInt(parts[2], 10) : 0;
      });
    const nextNum = Math.max(0, ...existing) + 1;
    const newNumber = `${prefix}-${year}-${String(nextNum).padStart(3, "0")}`;

    const clone: Omit<Quote, "id" | "createdAt" | "updatedAt"> = {
      ...original,
      quoteNumber: newNumber,
      // Duplicating a template produces a regular quote — the template stays
      // intact and the operator picks up an editable draft.
      isTemplate: false,
      templateName: null,
      invoiceStatus: "draft",
    };
    delete (clone as any).id;
    delete (clone as any).createdAt;
    delete (clone as any).updatedAt;

    const newQuote = addQuote(clone as any);
    toast({ title: t(
      original.isTemplate ? "Modèle dupliqué" : "Devis dupliqué",
      original.isTemplate ? "Template duplicated" : "Quote duplicated",
    ) });
    if (newQuote && typeof newQuote === "object" && "id" in newQuote) {
      navigate(`/quotes/${(newQuote as any).id}`);
    }
  }

  // % of a devis already covered by linked invoices (acompte + solde). Derived,
  // not stored — deleting an invoice automatically frees that share again.
  function billedPctFor(quoteId: string): number {
    return quotes
      .filter((q) => q.docType === "invoice" && q.sourceQuoteId === quoteId)
      .reduce((sum, q) => sum + (q.billedPct ?? 0), 0);
  }

  function nextInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const existing = quotes
      .filter((q) => q.docType === "invoice" && q.quoteNumber?.startsWith(`FAC-${year}`))
      .map((q) => { const p = q.quoteNumber?.split("-"); return p && p.length === 3 ? parseInt(p[2], 10) : 0; });
    return `FAC-${year}-${String(Math.max(0, ...existing) + 1).padStart(3, "0")}`;
  }

  // Bill a percentage of a devis as a draft invoice, linked back to the source
  // so the devis shows its billed state and the balance can be billed later.
  function billPctOfQuote(original: Quote, pct: number, kind: "acompte" | "solde"): string {
    const base = netSubtotalQuote(original);
    const newId = crypto.randomUUID?.() ?? `q-${Date.now()}`;
    const label = kind === "acompte" ? "Acompte" : "Solde";
    const clone: any = {
      ...original,
      id: newId,
      quoteNumber: nextInvoiceNumber(),
      docType: "invoice",
      invoiceStatus: "draft",
      isTemplate: false,
      templateName: null,
      discountEnabled: false,
      projectTitle: `${label} ${pct}% — ${original.projectTitle || original.quoteNumber}`,
      sourceQuoteId: original.id,
      billingKind: kind,
      billedPct: pct,
      lineItems: [{
        id: crypto.randomUUID?.() ?? `line-${Date.now()}`,
        description: `${label} ${pct}% sur ${original.quoteNumber}${original.projectTitle ? " — " + original.projectTitle : ""}`,
        quantity: 1,
        unitPrice: Math.round(base * (pct / 100) * 100) / 100,
      }],
    };
    delete clone.createdAt; delete clone.updatedAt;
    addQuote(clone);
    return newId;
  }

  // Acompte: 50% deposit invoice from a devis.
  function acompteFromQuote(original: Quote) {
    const id = billPctOfQuote(original, 50, "acompte");
    toast({ title: t("Acompte 50% créé", "50% deposit created"), description: t("Brouillon de facture — ajuste si besoin.", "Draft invoice — adjust if needed.") });
    navigate(`/quotes/${id}`);
  }

  // Solde: bill whatever percentage of the devis isn't yet invoiced.
  function soldeFromQuote(original: Quote) {
    const remaining = Math.round((100 - billedPctFor(original.id)) * 100) / 100;
    if (remaining <= 0) return;
    const id = billPctOfQuote(original, remaining, "solde");
    toast({ title: t(`Solde ${remaining}% créé`, `${remaining}% balance created`), description: t("Brouillon de facture — ajuste si besoin.", "Draft invoice — adjust if needed.") });
    navigate(`/quotes/${id}`);
  }

  // Billing action shown on a devis row: acompte when nothing's billed, then
  // "facturer le solde" until it's fully invoiced, then nothing (badge says so).
  function billingAction(q: Quote) {
    if (q.docType === "invoice" || q.isTemplate) return null;
    const billed = billedPctFor(q.id);
    if (billed <= 0) {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-accent"
          title={t("Générer un acompte 50%", "Generate 50% deposit")}
          onClick={() => acompteFromQuote(q)}
        >
          <Coins size={14} />
        </Button>
      );
    }
    if (billed < 100) {
      const remaining = Math.round((100 - billed) * 100) / 100;
      return (
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1 h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          title={t("Facturer le solde", "Bill the balance")}
          onClick={() => soldeFromQuote(q)}
        >
          <Wallet size={12} /> {t(`Solde ${remaining}%`, `Balance ${remaining}%`)}
        </Button>
      );
    }
    return null;
  }

  // Retainer: generate this month's draft invoice from an invoice template.
  function billRetainer(template: Quote) {
    const monthLabel = new Date().toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
    const baseTitle = template.templateName || template.projectTitle || "Prestation";
    const newId = crypto.randomUUID?.() ?? `q-${Date.now()}`;
    const clone: any = {
      ...template,
      id: newId,
      quoteNumber: nextInvoiceNumber(),
      docType: "invoice",
      invoiceStatus: "draft",
      isTemplate: false,
      templateName: null,
      projectTitle: `${baseTitle} — ${monthLabel}`,
    };
    delete clone.createdAt; delete clone.updatedAt;
    addQuote(clone);
    toast({ title: t("Facture du mois créée", "Monthly invoice created"), description: monthLabel });
    navigate(`/quotes/${newId}`);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Receipt size={22} className="text-accent" />
            <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary-foreground/60">
              {t("Documents", "Documents")}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                {showTemplates
                  ? t("Modèles", "Templates")
                  : t("Devis & Factures", "Quotes & Invoices")}
              </h1>
              <p className="font-body text-primary-foreground/65 mt-1 text-sm">
                {showTemplates
                  ? t(
                      "Vos modèles réutilisables. Cliquez sur Dupliquer pour démarrer un nouveau devis.",
                      "Your reusable templates. Click Duplicate to start a new quote.",
                    )
                  : t("Gérez vos devis et factures clients.", "Manage your quotes and client invoices.")}
              </p>
            </div>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-1.5">
              <Link to="/quotes/new">
                <Plus size={15} />
                {t("Nouveau devis", "New quote")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 md:px-12 py-8 pb-16">

        {quotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("Aucun devis", "No quotes yet")}
            description={t(
              "Créez votre premier devis ou facture pour commencer.",
              "Create your first quote or invoice to get started."
            )}
            action={{ label: t("Créer un devis", "Create a quote"), onClick: () => navigate("/quotes/new"), icon: Plus }}
          />
        ) : (
          <>
            {!showTemplates && <QuoteStatsPanel quotes={quotes} />}

            {/* Search + Filters */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("Rechercher un devis...", "Search quotes...")}
                  className="pl-9 font-body"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Status pills */}
                <div className="flex gap-1">
                  {STATUS_PILLS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setStatusFilter(p.key)}
                      className={cn(
                        "text-xs font-body px-2.5 py-1 rounded-full border transition-colors",
                        statusFilter === p.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "text-muted-foreground border-border hover:bg-secondary"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
                {/* Type pills */}
                <div className="flex gap-1">
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
                </div>
                {/* Templates toggle */}
                <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
                <button
                  onClick={() => setShowTemplates((v) => !v)}
                  className={cn(
                    "text-xs font-body px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1.5",
                    showTemplates
                      ? "bg-accent text-accent-foreground border-accent"
                      : "text-muted-foreground border-border hover:bg-secondary"
                  )}
                  title={showTemplates
                    ? t("Revenir aux devis", "Back to quotes")
                    : t("Voir vos modèles", "View your templates")}
                >
                  <BookmarkCheck size={12} />
                  {showTemplates
                    ? t("Devis", "Quotes")
                    : t("Modèles", "Templates")}
                  {!showTemplates && templateCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({templateCount})
                    </span>
                  )}
                </button>
              </div>
              {/* Client + Sort + Date range */}
              <div className="flex flex-wrap items-center gap-2">
                {clients.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-muted-foreground" />
                      <select
                        value={clientFilter}
                        onChange={(e) => changeClientFilter(e.target.value)}
                        className="text-xs font-body border border-border rounded-md px-2 py-1 bg-background text-foreground max-w-[160px]"
                      >
                        <option value="all">{t("Tous les clients", "All clients")}</option>
                        {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
                  </>
                )}
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown size={12} className="text-muted-foreground" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs font-body border border-border rounded-md px-2 py-1 bg-background text-foreground"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
                <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
                  <span>Du</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-7 w-[130px] text-xs px-2"
                  />
                  <span>Au</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-7 w-[130px] text-xs px-2"
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground font-body py-12">
                {t("Aucun résultat.", "No results.")}
              </p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((q) => (
                  <li key={q.id}>
                    <div className="glass-card-hover p-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {q.isTemplate ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 shrink-0 border-accent/40 text-accent inline-flex items-center gap-1"
                            >
                              <BookmarkCheck size={10} />
                              {t("Modèle", "Template")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 shrink-0",
                                q.docType === "invoice"
                                  ? "border-accent/40 text-accent"
                                  : "border-primary/40 text-primary"
                              )}
                            >
                              {q.docType === "invoice" ? "FAC" : "DEV"}
                            </Badge>
                          )}
                          <div className="font-medium text-foreground break-words">
                            {q.isTemplate && q.templateName
                              ? q.templateName
                              : `${q.quoteNumber}${q.projectTitle ? ` · ${q.projectTitle}` : ""}`}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {q.clientName} · {formatCurrency(totalQuote(q), q.lang)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatDateSwiss(q.createdAt)}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn("text-[10px] px-1.5 py-0", {
                              "bg-amber-100 text-amber-800": q.invoiceStatus === "to-validate",
                              "bg-emerald-100 text-emerald-800": q.invoiceStatus === "paid",
                              "bg-blue-100 text-blue-800": q.invoiceStatus === "validated",
                              "bg-gray-100 text-gray-700": q.invoiceStatus === "draft",
                            })}
                          >
                            {STATUS_PILLS.find((p) => p.key === q.invoiceStatus)?.label ?? q.invoiceStatus}
                          </Badge>
                          {isOverdue(q) && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                              En retard
                            </Badge>
                          )}
                          {q.docType !== "invoice" && !q.isTemplate && billedPctFor(q.id) > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-accent/10 text-accent">
                              {billedPctFor(q.id) >= 100
                                ? t("Soldé", "Settled")
                                : t(`Acompte ${billedPctFor(q.id)}% facturé`, `${billedPctFor(q.id)}% invoiced`)}
                            </Badge>
                          )}
                          {q.docType === "invoice" && q.billingKind && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent/40 text-accent">
                              {q.billingKind === "acompte" ? t("Acompte", "Deposit") : t("Solde", "Balance")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Reminder button for unpaid invoices */}
                        {q.invoiceStatus === "validated" && q.clientEmail && (
                          reminderSent.has(q.id) ? (
                            <span className="text-[10px] text-emerald-600 font-body flex items-center gap-1 mr-1">
                              <Check size={12} /> Rappel envoyé
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1 h-7 text-amber-700 border-amber-300 hover:bg-amber-50"
                              onClick={() => handleSendReminder(q)}
                              disabled={sendingReminder === q.id}
                            >
                              {sendingReminder === q.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Bell size={12} />
                              )}
                              Rappel
                            </Button>
                          )
                        )}
                        {q.docType === "invoice" && q.invoiceStatus === "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                            title={t("Renouveler la facture", "Renew invoice")}
                            onClick={() => renewInvoice(q)}
                          >
                            <RefreshCw size={14} />
                          </Button>
                        )}
                        {billingAction(q)}
                        {q.isTemplate && q.docType === "invoice" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1 h-7"
                            title={t("Générer la facture du mois", "Generate this month's invoice")}
                            onClick={() => billRetainer(q)}
                          >
                            <CalendarPlus size={12} /> {t("Facturer le mois", "Bill month")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={t("Dupliquer", "Duplicate")}
                          onClick={() => duplicateQuote(q)}
                        >
                          <Copy size={14} />
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/quotes/${q.id}`}>
                            {t("Ouvrir", "Open")}
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteWithUndo(q)}
                          title={t("Supprimer", "Delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

      </div>
    </div>
  );
}
