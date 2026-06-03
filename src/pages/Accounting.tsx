import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote, tvaAmountQuote, type Quote } from "@/types/quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Receipt, Info, Clock, Search, Download, CheckCircle2, Paperclip, Loader2, X } from "lucide-react";
import { downloadCSV } from "@/lib/csvExport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  Expense,
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
} from "@/types/expense";
import { loadExpenses, saveExpenses } from "@/lib/expenseStorage";
import {
  listExpenses as apiListExpenses,
  createExpense as apiCreateExpense,
  deleteExpense as apiDeleteExpense,
  batchImportExpenses,
} from "@/api/expenses";
import { uploadImage } from "@/api/projects";
import { bufferFile } from "@/lib/fileBuffer";


import { formatCHF, todayISO, MONTHS_FR, TVA_RATE } from "@/components/accounting/utils";
import { formatDateSwiss } from "@/lib/dateFormat";

import { StatCard } from "@/components/accounting/StatCard";
import { ProjectProfitability } from "@/components/accounting/ProjectProfitability";
import { TaxSetAside } from "@/components/accounting/TaxSetAside";

// ── Outstanding money (receivables / potential revenue) ────────

type OutstandingRow = {
  id: string;
  clientName: string;
  quoteNumber: string;
  projectTitle: string;
  amount: number;
  validityDate: string;
  createdAt: string;
};

function OutstandingSection({
  title, subtitle, rows, total, accent, lateLabel, emptyText, icon: Icon, onRowClick,
}: {
  title: string;
  subtitle: string;
  rows: OutstandingRow[];
  total: number;
  accent: "sage" | "amber";
  lateLabel: string;
  emptyText: string;
  icon: React.FC<{ size?: number; className?: string }>;
  onRowClick: (id: string) => void;
}) {
  const accentText = accent === "sage" ? "text-palette-sage" : "text-palette-amber";
  const accentDot = accent === "sage" ? "bg-palette-sage" : "bg-palette-amber";
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-secondary/20 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={15} className={accentText} />
          <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
          <span className="font-body text-xs text-muted-foreground hidden sm:block">{subtitle}</span>
        </div>
        <span className={`font-display text-base font-bold ${accentText} whitespace-nowrap`}>{formatCHF(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-muted-foreground font-body text-sm">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border bg-secondary/10">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Projet</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell whitespace-nowrap">Échéance</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((inv) => {
                const due = inv.validityDate ? new Date(inv.validityDate) : null;
                const isLate = due ? due < new Date() : false;
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => onRowClick(inv.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${accentDot}`} />
                        <span className="font-medium text-foreground break-words">{inv.clientName || "-"}</span>
                        {isLate && (
                          <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 whitespace-nowrap">
                            {lateLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell break-words max-w-[220px]">{inv.projectTitle || "-"}</td>
                    <td className={`px-4 py-3 hidden md:table-cell text-xs whitespace-nowrap ${isLate ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{formatDateSwiss(due)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary tabular-nums whitespace-nowrap">{formatCHF(inv.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function Accounting() {
  const navigate = useNavigate();
  const { quotes } = useQuotes();

  // Year selector
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [expenseApiReady, setExpenseApiReady] = useState(false);

  // New expense form
  const [newDate, setNewDate] = useState(todayISO());
  const [newCategory, setNewCategory] = useState<ExpenseCategory>("software");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newReceiptUrl, setNewReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Expense filters
  const [expYear, setExpYear] = useState(currentYear);
  const [expCategory, setExpCategory] = useState<ExpenseCategory | "all">("all");

  // Load expenses from API on mount (with localStorage fallback + migration)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiExpenses = await apiListExpenses();
        if (cancelled) return;

        // One-time migration: if API is empty but localStorage has data, migrate
        const localExpenses = loadExpenses();
        if (apiExpenses.length === 0 && localExpenses.length > 0) {
          await batchImportExpenses(localExpenses.map((e) => ({
            id: e.id, date: e.date, amount: e.amount,
            description: e.description, category: e.category, notes: e.notes,
          })));
          const migrated = await apiListExpenses();
          if (!cancelled) setExpenses(migrated as any);
        } else {
          setExpenses(apiExpenses as any);
        }
        setExpenseApiReady(true);
      } catch {
        // API not available — keep localStorage data
        setExpenseApiReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived: paid invoices (real revenue) ──
  const paidInvoices = useMemo(
    () =>
      quotes
        .filter((q) => q.invoiceStatus === "paid")
        .map((q) => ({
          id: q.id,
          date: q.createdAt,
          clientName: q.clientName,
          quoteNumber: q.quoteNumber,
          projectTitle: q.projectTitle,
          amount: totalQuote(q),
        }))
        .filter((q) => {
          const y = new Date(q.date).getFullYear();
          return !isNaN(y) && y === year;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [quotes, year]
  );

  const totalRevenue = paidInvoices.reduce((s, q) => s + q.amount, 0);

  // ── Derived: outstanding money (NOT year-scoped — these are forward-looking) ──
  // Validated quotes = "à recevoir" (créances, l'argent qu'on te doit).
  // Quotes still awaiting the client's signature = "revenu potentiel"
  // (spéculatif tant que non validé). Soonest validity/échéance first.
  const { receivables, potential } = useMemo(() => {
    const toRow = (q: Quote): OutstandingRow => ({
      id: q.id,
      clientName: q.clientName,
      quoteNumber: q.quoteNumber,
      projectTitle: q.projectTitle,
      amount: totalQuote(q),
      validityDate: q.validityDate,
      createdAt: q.createdAt,
    });
    const bySoonestDue = (a: OutstandingRow, b: OutstandingRow) =>
      (a.validityDate || "9999").localeCompare(b.validityDate || "9999");
    return {
      receivables: quotes
        .filter((q) => !q.isTemplate && q.invoiceStatus === "validated")
        .map(toRow)
        .sort(bySoonestDue),
      potential: quotes
        .filter((q) => !q.isTemplate && q.invoiceStatus === "to-validate")
        .map(toRow)
        .sort(bySoonestDue),
    };
  }, [quotes]);

  const totalReceivables = receivables.reduce((s, q) => s + q.amount, 0);
  const totalPotential = potential.reduce((s, q) => s + q.amount, 0);
  const totalPipeline = totalReceivables + totalPotential;

  // ── Derived: expenses for year ──
  const yearExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.date).getFullYear() === year),
    [expenses, year]
  );

  const totalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const taxEstimate = totalRevenue * TVA_RATE;

  // TVA réellement collectée sur les factures payées (≠ revenue × taux fixe) —
  // 0 si tu ne factures pas la TVA. Sert à la provision "À mettre de côté".
  const tvaCollectedReal = useMemo(
    () => quotes
      .filter((q) => q.invoiceStatus === "paid")
      .filter((q) => { const y = new Date(q.createdAt).getFullYear(); return !isNaN(y) && y === year; })
      .reduce((s, q) => s + tvaAmountQuote(q), 0),
    [quotes, year]
  );

  // ── Monthly chart data ──
  const monthlyData = useMemo(() => {
    return MONTHS_FR.map((month, i) => {
      const inc = paidInvoices
        .filter((q) => new Date(q.date).getMonth() === i)
        .reduce((s, q) => s + q.amount, 0);
      const exp = yearExpenses
        .filter((e) => new Date(e.date).getMonth() === i)
        .reduce((s, e) => s + e.amount, 0);
      return { month, Revenus: inc, Dépenses: exp };
    });
  }, [paidInvoices, yearExpenses]);

  // ── Pie chart data ──
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    yearExpenses.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        name: EXPENSE_CATEGORY_LABELS[key as ExpenseCategory],
        value,
        color: EXPENSE_CATEGORY_COLORS[key as ExpenseCategory],
      }));
  }, [yearExpenses]);

  // ── Filtered expense list ──
  const filteredExpenses = useMemo(
    () =>
      expenses
        .filter((e) => {
          const y = new Date(e.date).getFullYear() === expYear;
          const c = expCategory === "all" || e.category === expCategory;
          const s = !expenseSearch.trim() || [e.description, e.notes].some((f) => f?.toLowerCase().includes(expenseSearch.toLowerCase()));
          return y && c && s;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, expYear, expCategory, expenseSearch]
  );

  // ── Available years (NaN-safe) ──
  const allYears = useMemo(() => {
    const ys = new Set<number>([currentYear]);
    quotes.forEach((q) => {
      const y = new Date(q.createdAt).getFullYear();
      if (!isNaN(y)) ys.add(y);
    });
    expenses.forEach((e) => {
      const y = new Date(e.date).getFullYear();
      if (!isNaN(y)) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [quotes, expenses, currentYear]);

  async function handleReceiptPick(file: File | undefined) {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      // Buffer first — Android revokes the picked file's URI across the upload await.
      const url = await uploadImage(await bufferFile(file));
      setNewReceiptUrl(url);
    } catch (err) {
      console.error("Receipt upload failed", err);
    } finally {
      setUploadingReceipt(false);
    }
  }

  // ── Add expense ──
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(newAmount.replace(",", "."));
    if (!newDescription.trim() || isNaN(amount) || amount <= 0) return;

    const newExpense = {
      id: crypto.randomUUID(),
      date: newDate,
      amount,
      description: newDescription.trim(),
      category: newCategory,
      notes: newNotes.trim() || undefined,
      receiptUrl: newReceiptUrl || undefined,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    const updated = [...expenses, newExpense];
    setExpenses(updated);
    saveExpenses(updated);
    setNewDescription("");
    setNewAmount("");
    setNewNotes("");
    setNewReceiptUrl(null);

    // Persist to API
    if (expenseApiReady) {
      try {
        await apiCreateExpense({ date: newExpense.date, amount: newExpense.amount, description: newExpense.description, category: newExpense.category, notes: newExpense.notes, receiptUrl: newExpense.receiptUrl });
      } catch { /* localStorage fallback already saved */ }
    }
  }

  // ── Delete expense ──
  async function handleDeleteExpense(id: string) {
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    saveExpenses(updated);
    setDeleteConfirm(null);

    if (expenseApiReady) {
      try { await apiDeleteExpense(id); } catch { /* ignore */ }
    }
  }

  // ── Quarterly breakdown ──
  const quarterlyRevenue = useMemo(() => {
    return [0, 1, 2, 3].map((q) => {
      const months = [q * 3, q * 3 + 1, q * 3 + 2];
      return paidInvoices
        .filter((inv) => months.includes(new Date(inv.date).getMonth()))
        .reduce((s, inv) => s + inv.amount, 0);
    });
  }, [paidInvoices]);

  const tvaCollected = totalRevenue * TVA_RATE;
  const tvaPaid = totalExpenses * TVA_RATE;
  const tvaNet = tvaCollected - tvaPaid;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Wallet size={22} className="text-accent" />
            <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary-foreground/60">
              Finance
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                Comptabilité
              </h1>
              <p className="font-body text-primary-foreground/65 mt-1 text-sm">
                Revenus, dépenses et estimations fiscales.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground font-body text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                onClick={() => navigate("/home")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ArrowLeft size={16} className="mr-2" />
                Retour
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide [mask-image:linear-gradient(to_right,transparent,black_0.5rem,black_calc(100%-1.5rem),transparent)] sm:[mask-image:none]">
            <TabsList className="font-body w-max sm:w-max">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                <span className="sm:hidden">Aperçu</span>
                <span className="hidden sm:inline">Vue d'ensemble</span>
              </TabsTrigger>
              <TabsTrigger value="income"   className="text-xs sm:text-sm">Revenus</TabsTrigger>
              <TabsTrigger value="expenses" className="text-xs sm:text-sm">Dépenses</TabsTrigger>
              <TabsTrigger value="pipeline" className="text-xs sm:text-sm">À recevoir</TabsTrigger>
              <TabsTrigger value="tax"      className="text-xs sm:text-sm">Fiscalité</TabsTrigger>
              <TabsTrigger value="profitability" className="text-xs sm:text-sm">Rentabilité</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Tab: Vue d'ensemble ── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={TrendingUp}
                label="Chiffre d'affaires"
                value={formatCHF(totalRevenue)}
                sub={`${paidInvoices.length} facture${paidInvoices.length !== 1 ? "s" : ""} payée${paidInvoices.length !== 1 ? "s" : ""}`}
              />
              <StatCard
                icon={TrendingDown}
                label="Dépenses"
                value={formatCHF(totalExpenses)}
                sub={`${yearExpenses.length} entrée${yearExpenses.length !== 1 ? "s" : ""}`}
                accent="bg-palette-rose"
              />
              <StatCard
                icon={Wallet}
                label="Bénéfice net"
                value={formatCHF(netProfit)}
                accent={netProfit >= 0 ? "bg-palette-sage" : "bg-destructive"}
              />
              <StatCard
                icon={Receipt}
                label="TVA estimée"
                value={formatCHF(taxEstimate)}
                sub={`${(TVA_RATE * 100).toFixed(1)}% du CA`}
                accent="bg-palette-amber"
              />
            </div>

            {/* Encaissements à venir */}
            {totalPipeline > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-primary" />
                    <h2 className="font-display text-sm font-semibold text-foreground">Encaissements à venir</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-body">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-palette-sage/40 text-palette-sage bg-palette-sage/5 font-semibold">
                      À recevoir {formatCHF(totalReceivables)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-palette-amber/40 text-palette-amber bg-palette-amber/5 font-semibold">
                      Potentiel {formatCHF(totalPotential)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[
                    ...receivables.map((inv) => ({ ...inv, kind: "receivable" as const })),
                    ...potential.map((inv) => ({ ...inv, kind: "potential" as const })),
                  ].map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-secondary/20 -mx-1 px-1 rounded transition-colors"
                      onClick={() => navigate(`/quotes/${inv.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${inv.kind === "receivable" ? "bg-palette-sage" : "bg-palette-amber"}`} />
                        <span className="font-body text-sm font-medium text-foreground break-words">{inv.clientName || "-"}</span>
                        <span className="font-body text-xs text-muted-foreground hidden sm:block break-words">{inv.projectTitle}</span>
                      </div>
                      <span className="font-body text-sm font-semibold text-primary ml-3 whitespace-nowrap">{formatCHF(inv.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly bar chart */}
            {(totalRevenue > 0 || totalExpenses > 0) && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <h2 className="font-display text-sm font-semibold text-foreground mb-4">Aperçu mensuel</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData} barGap={4}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "var(--font-body)" }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-body)" }} tickFormatter={(v) => `${v}`} />
                    <Tooltip
                      formatter={(v: number) => formatCHF(v)}
                      contentStyle={{ fontSize: 12, fontFamily: "var(--font-body)" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)" }} />
                    <Bar dataKey="Revenus" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Dépenses" fill="hsl(var(--palette-rose, 346 80% 61%))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Expense pie chart */}
            {pieData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <h2 className="font-display text-sm font-semibold text-foreground mb-4">Dépenses par catégorie</h2>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCHF(v)} contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="space-y-2 min-w-[160px]">
                    {pieData.map((d) => (
                      <li key={d.name} className="flex items-center gap-2 font-body text-xs text-foreground">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="flex-1 break-words min-w-0">{d.name}</span>
                        <span className="text-muted-foreground">{formatCHF(d.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {totalRevenue === 0 && totalExpenses === 0 && totalPipeline === 0 && (
              <div className="text-center py-16 text-muted-foreground font-body text-sm">
                Aucune donnée pour {year}. Marquez des factures comme <strong>Payées</strong> et ajoutez des dépenses pour voir les données ici.
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Revenus ── */}
          <TabsContent value="income" className="space-y-4">
            {paidInvoices.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => downloadCSV(
                    paidInvoices.map((inv) => ({
                      Date: formatDateSwiss(inv.date),
                      Client: inv.clientName || "-",
                      Facture: inv.quoteNumber,
                      Projet: inv.projectTitle || "-",
                      Montant: inv.amount,
                    })),
                    [
                      { key: "Date", label: "Date" },
                      { key: "Client", label: "Client" },
                      { key: "Facture", label: "N° Facture" },
                      { key: "Projet", label: "Projet" },
                      { key: "Montant", label: "Montant (CHF)" },
                    ],
                    `revenus-${year}.csv`,
                  )}
                >
                  <Download size={14} />
                  Exporter CSV
                </Button>
              </div>
            )}
            {paidInvoices.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-body text-sm">
                Aucune facture payée pour {year}.
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Facture</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Projet</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidInvoices.map((inv, i) => (
                      <tr key={inv.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateSwiss(inv.date)}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{inv.clientName || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">{inv.quoteNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell break-words max-w-[200px]">{inv.projectTitle || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-palette-sage">{formatCHF(inv.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/30">
                      <td colSpan={4} className="px-4 py-3 font-semibold font-body text-sm">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{formatCHF(totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>{/* overflow-x-auto */}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Dépenses ── */}
          <TabsContent value="expenses" className="space-y-5">
            {/* Add expense form */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h2 className="font-display text-sm font-semibold text-foreground mb-4">Ajouter une dépense</h2>
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="font-body text-sm"
                    required
                  />
                  <Select value={newCategory} onValueChange={(v) => setNewCategory(v as ExpenseCategory)}>
                    <SelectTrigger className="font-body text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="font-body text-sm md:col-span-2"
                    required
                  />
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-3">
                  <Input
                    placeholder="Montant (CHF)"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="font-body text-sm w-full sm:w-32 md:w-36 shrink-0"
                    required
                  />
                  <Textarea
                    placeholder="Notes (optionnel)"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="font-body text-sm h-9 min-h-0 resize-none flex-1 min-w-0"
                    rows={1}
                  />
                  {/* Receipt photo */}
                  {newReceiptUrl ? (
                    <div className="relative h-9 w-9 shrink-0">
                      <img src={newReceiptUrl} alt="reçu" className="h-9 w-9 object-cover rounded-md border border-border" />
                      <button
                        type="button"
                        onClick={() => setNewReceiptUrl(null)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
                        aria-label="Retirer le reçu"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ) : (
                    <label className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border text-xs font-body text-muted-foreground hover:text-foreground hover:border-primary/40 cursor-pointer transition-colors shrink-0" title="Joindre un reçu (photo)">
                      {uploadingReceipt ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                      <span className="hidden sm:inline">Reçu</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { handleReceiptPick(e.target.files?.[0]); e.currentTarget.value = ""; }}
                      />
                    </label>
                  )}
                  <Button type="submit" className="gap-1.5 shrink-0 w-full sm:w-auto">
                    <Plus size={15} />
                    Ajouter
                  </Button>
                </div>
              </form>
            </div>

            {/* Filters + Search */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={String(expYear)} onValueChange={(v) => setExpYear(Number(v))}>
                <SelectTrigger className="w-24 font-body text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={expCategory} onValueChange={(v) => setExpCategory(v as ExpenseCategory | "all")}>
                <SelectTrigger className="w-48 font-body text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[160px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Rechercher..."
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  className="pl-8 font-body text-sm h-9"
                />
              </div>
              <span className="font-body text-sm text-muted-foreground">
                {filteredExpenses.length} entrée{filteredExpenses.length !== 1 ? "s" : ""}
              </span>
              {filteredExpenses.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs ml-auto"
                  onClick={() => downloadCSV(
                    filteredExpenses.map((e) => ({
                      Date: formatDateSwiss(e.date),
                      Categorie: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
                      Description: e.description,
                      Montant: e.amount,
                      Notes: e.notes ?? "",
                    })),
                    [
                      { key: "Date", label: "Date" },
                      { key: "Categorie", label: "Catégorie" },
                      { key: "Description", label: "Description" },
                      { key: "Montant", label: "Montant (CHF)" },
                      { key: "Notes", label: "Notes" },
                    ],
                    `depenses-${expYear}.csv`,
                  )}
                >
                  <Download size={14} />
                  CSV
                </Button>
              )}
            </div>

            {/* Expense list */}
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-body text-sm">
                Aucune dépense trouvée.
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Catégorie</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Montant</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((exp, i) => (
                      <tr key={exp.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateSwiss(exp.date)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                            style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[exp.category] }}
                          >
                            {EXPENSE_CATEGORY_LABELS[exp.category]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{exp.description}</span>
                          {exp.notes && <span className="block text-xs text-muted-foreground">{exp.notes}</span>}
                          {exp.receiptUrl && (
                            <a
                              href={exp.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                            >
                              <Paperclip size={10} /> Reçu
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-destructive">{formatCHF(exp.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {deleteConfirm === exp.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-destructive text-white font-semibold"
                              >Sup</button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
                              >×</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(exp.id)}
                              className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/30">
                      <td colSpan={3} className="px-4 py-3 font-semibold font-body text-sm">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-destructive">
                        {formatCHF(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>{/* overflow-x-auto */}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: À recevoir ── */}
          <TabsContent value="pipeline" className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard
                icon={CheckCircle2}
                label="À recevoir"
                value={formatCHF(totalReceivables)}
                sub={`${receivables.length} devis validé${receivables.length !== 1 ? "s" : ""}`}
                accent="bg-palette-sage"
              />
              <StatCard
                icon={Clock}
                label="Revenu potentiel"
                value={formatCHF(totalPotential)}
                sub={`${potential.length} devis à valider`}
                accent="bg-palette-amber"
              />
              <StatCard
                icon={TrendingUp}
                label="Déjà encaissé"
                value={formatCHF(totalRevenue)}
                sub={`${paidInvoices.length} facture${paidInvoices.length !== 1 ? "s" : ""} · ${year}`}
              />
            </div>

            <OutstandingSection
              title="À recevoir"
              subtitle="devis validés, en attente de paiement"
              rows={receivables}
              total={totalReceivables}
              accent="sage"
              lateLabel="En retard"
              emptyText="Aucun devis validé en attente de paiement."
              icon={CheckCircle2}
              onRowClick={(qid) => navigate(`/quotes/${qid}`)}
            />

            <OutstandingSection
              title="Revenu potentiel"
              subtitle="devis envoyés, en attente de validation client"
              rows={potential}
              total={totalPotential}
              accent="amber"
              lateLabel="Expiré"
              emptyText="Aucun devis en attente de validation."
              icon={Clock}
              onRowClick={(qid) => navigate(`/quotes/${qid}`)}
            />

            <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="font-body text-xs text-muted-foreground">
                <strong className="text-palette-sage">À recevoir</strong> = devis validés par le client (créances).{" "}
                <strong className="text-palette-amber">Revenu potentiel</strong> = devis envoyés, en attente de signature — non garanti tant qu'il n'est pas validé.
                Un devis dont la date de validité est dépassée est marqué « Expiré » (à relancer). Tous les devis en cours sont affichés, toutes années confondues.
              </p>
            </div>
          </TabsContent>

          {/* ── Tab: Fiscalité ── */}
          <TabsContent value="tax" className="space-y-5">
            <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
              <h2 className="font-display text-base font-semibold text-foreground">Bilan annuel {year}</h2>

              <dl className="space-y-2 font-body text-sm">
                {[
                  { label: "Chiffre d'affaires brut",  value: totalRevenue,   cls: "text-palette-sage font-semibold" },
                  { label: "Charges déductibles",       value: -totalExpenses, cls: "text-destructive font-semibold" },
                  { label: "Revenu net imposable",      value: netProfit,      cls: "text-foreground font-bold border-t border-border pt-2 mt-2" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={`flex justify-between items-center ${cls}`}>
                    <dt className="text-foreground font-normal">{label}</dt>
                    <dd>{formatCHF(Math.abs(value))}{value < 0 ? " (déductible)" : ""}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <TaxSetAside
              revenueTTC={totalRevenue}
              tvaCollected={tvaCollectedReal}
              expenses={totalExpenses}
              year={year}
            />

            {/* Quarterly */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h2 className="font-display text-sm font-semibold text-foreground mb-3">Revenus trimestriels</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quarterlyRevenue.map((rev, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3">
                    <p className="font-body text-xs text-muted-foreground mb-1">T{i + 1}</p>
                    <p className="font-display text-lg font-bold text-foreground">{formatCHF(rev)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* TVA */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-display text-sm font-semibold text-foreground">Estimation TVA ({(TVA_RATE * 100).toFixed(1)}%)</h2>
                <Receipt size={14} className="text-muted-foreground" />
              </div>
              <dl className="space-y-2 font-body text-sm">
                {[
                  { label: "TVA collectée sur CA",        value: tvaCollected, cls: "text-foreground" },
                  { label: "TVA payée sur charges",       value: tvaPaid,      cls: "text-muted-foreground" },
                  { label: "TVA nette due (estimation)",  value: tvaNet,       cls: "text-foreground font-bold border-t border-border pt-2" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={`flex justify-between ${cls}`}>
                    <dt>{label}</dt>
                    <dd className="font-medium">{formatCHF(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="font-body text-xs text-muted-foreground">
                Ces valeurs sont indicatives. Consultez votre fiduciaire pour les déclarations officielles.
                Les revenus sont basés sur les factures marquées comme <strong>Payées</strong> dans le système.
              </p>
            </div>
          </TabsContent>

          {/* ── Tab: Rentabilité ── */}
          <TabsContent value="profitability" className="space-y-5">
            <ProjectProfitability />
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating quick-add button */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
        title="Ajouter une dépense"
      >
        <Plus size={22} />
      </button>

      {/* Quick-add dialog */}
      <ResponsiveDialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <ResponsiveDialogContent className="max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display">Dépense rapide</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <form
            onSubmit={(e) => {
              handleAddExpense(e);
              setShowQuickAdd(false);
            }}
            className="space-y-3"
          >
            <Input
              placeholder="Description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="font-body text-sm"
              required
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Montant (CHF)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="font-body text-sm"
                required
              />
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as ExpenseCategory)}>
                <SelectTrigger className="font-body text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="font-body text-sm"
            />
            <Button type="submit" className="w-full gap-1.5">
              <Plus size={15} />
              Ajouter
            </Button>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
