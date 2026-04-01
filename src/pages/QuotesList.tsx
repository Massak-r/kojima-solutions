import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuotes } from "@/hooks/useQuotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2, Receipt, Search, Copy, ArrowUpDown, Bell, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { totalQuote } from "@/types/quote";
import type { Quote } from "@/types/quote";
import { EmptyState } from "@/components/ui/EmptyState";
import { useInlineDelete } from "@/hooks/useInlineDelete";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { sendInvoiceReminder } from "@/api/invoiceReminder";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const isFr = (locale: string) => locale === "fr";

  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());

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

  const filtered = useMemo(() => {
    let list = [...quotes];
    if (statusFilter !== "all") list = list.filter((q) => q.invoiceStatus === statusFilter);
    if (typeFilter !== "all") list = list.filter((q) => q.docType === typeFilter);
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
  }, [quotes, statusFilter, typeFilter, searchQuery, sortBy, dateFrom, dateTo]);

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
    };
    delete (clone as any).id;
    delete (clone as any).createdAt;
    delete (clone as any).updatedAt;

    const newQuote = addQuote(clone as any);
    if (newQuote && typeof newQuote === "object" && "id" in newQuote) {
      navigate(`/quotes/${(newQuote as any).id}`);
    }
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
                {t("Devis & Factures", "Quotes & Invoices")}
              </h1>
              <p className="font-body text-primary-foreground/65 mt-1 text-sm">
                {t("Gérez vos devis et factures clients.", "Manage your quotes and client invoices.")}
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
              </div>
              {/* Sort + Date range */}
              <div className="flex flex-wrap items-center gap-2">
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
                          <div className="font-medium text-foreground break-words">
                            {q.quoteNumber} {q.projectTitle ? `· ${q.projectTitle}` : ""}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {q.clientName} · {formatCurrency(totalQuote(q), q.lang)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(q.createdAt), "dd MMM yyyy", {
                              locale: isFr(q.lang) ? fr : enUS,
                            })}
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
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("Supprimer le devis ?", "Delete this quote?")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t(
                                  "Cette action est irréversible.",
                                  "This action cannot be undone."
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Annuler", "Cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteQuote(q.id)}
                              >
                                {t("Supprimer", "Delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
