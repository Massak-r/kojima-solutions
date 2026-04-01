import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Receipt, Info, Clock, Search, Download } from "lucide-react";
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

// ── Helpers ───────────────────────────────────────────────────

function formatCHF(value: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const TVA_RATE = 0.081;

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${accent ?? "bg-primary/10"}`}>
        <Icon size={17} className={accent ? "text-white" : "text-primary"} />
      </div>
      <p className="font-body text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="font-body text-xs text-muted-foreground mt-1">{sub}</p>}
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
          date: q.date,
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

  // ── Derived: pipeline = validated + to-validate quotes ──
  const pipelineInvoices = useMemo(
    () =>
      quotes
        .filter((q) => q.invoiceStatus === "validated" || q.invoiceStatus === "to-validate")
        .map((q) => ({
          id: q.id,
          date: q.date,
          validityDate: q.validityDate,
          clientName: q.clientName,
          quoteNumber: q.quoteNumber,
          projectTitle: q.projectTitle,
          amount: totalQuote(q),
          status: q.invoiceStatus,
        }))
        .filter((q) => {
          const y = new Date(q.date).getFullYear();
          return !isNaN(y) && y === year;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [quotes, year]
  );

  const totalPipeline = pipelineInvoices.reduce((s, q) => s + q.amount, 0);

  // ── Derived: expenses for year ──
  const yearExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.date).getFullYear() === year),
    [expenses, year]
  );

  const totalExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const taxEstimate = totalRevenue * TVA_RATE;

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
      const y = new Date(q.date).getFullYear();
      if (!isNaN(y)) ys.add(y);
    });
    expenses.forEach((e) => {
      const y = new Date(e.date).getFullYear();
      if (!isNaN(y)) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [quotes, expenses, currentYear]);

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
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    const updated = [...expenses, newExpense];
    setExpenses(updated);
    saveExpenses(updated);
    setNewDescription("");
    setNewAmount("");
    setNewNotes("");

    // Persist to API
    if (expenseApiReady) {
      try {
        await apiCreateExpense({ date: newExpense.date, amount: newExpense.amount, description: newExpense.description, category: newExpense.category, notes: newExpense.notes });
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
                onClick={() => navigate("/space")}
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

            {/* Pipeline */}
            {totalPipeline > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-primary" />
                    <h2 className="font-display text-sm font-semibold text-foreground">Prévisionnel</h2>
                    <span className="font-body text-xs text-muted-foreground">devis validés non encore payés</span>
                  </div>
                  <span className="font-display text-lg font-bold text-primary">{formatCHF(totalPipeline)}</span>
                </div>
                <div className="space-y-1.5">
                  {pipelineInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${inv.status === "validated" ? "bg-palette-sage" : "bg-palette-amber"}`} />
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
                      Date: new Date(inv.date).toLocaleDateString("fr-CH"),
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
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(inv.date).toLocaleDateString("fr-CH")}</td>
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
                      Date: new Date(e.date).toLocaleDateString("fr-CH"),
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
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(exp.date).toLocaleDateString("fr-CH")}</td>
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

          {/* ── Tab: Pipeline ── */}
          <TabsContent value="pipeline" className="space-y-5">
            {/* Pipeline stat */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                icon={Clock}
                label="À recevoir"
                value={formatCHF(totalPipeline)}
                sub={`${pipelineInvoices.length} devis en attente`}
              />
              <StatCard
                icon={TrendingUp}
                label="Déjà encaissé"
                value={formatCHF(totalRevenue)}
                sub={`${paidInvoices.length} facture${paidInvoices.length !== 1 ? "s" : ""}`}
                accent="bg-palette-sage"
              />
            </div>

            {pipelineInvoices.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-body text-sm">
                Aucun devis validé en attente de paiement pour {year}.
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Projet</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Paiement estimé</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pipelineInvoices.map((inv) => {
                        const dueDate = inv.validityDate ? new Date(inv.validityDate) : null;
                        const isOverdue = dueDate ? dueDate < new Date() : false;
                        return (
                          <tr
                            key={inv.id}
                            className="hover:bg-secondary/20 transition-colors cursor-pointer"
                            onClick={() => navigate(`/quotes/${inv.id}`)}
                          >
                            <td className="px-4 py-3 font-medium text-foreground">{inv.clientName || "-"}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{inv.projectTitle || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                  inv.status === "validated"
                                    ? "border-palette-sage/40 text-palette-sage bg-palette-sage/5"
                                    : "border-palette-amber/40 text-palette-amber bg-palette-amber/5"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${inv.status === "validated" ? "bg-palette-sage" : "bg-palette-amber"}`} />
                                  {inv.status === "validated" ? "Validé" : "À valider"}
                                </span>
                                {isOverdue && (
                                  <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                    En retard
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className={`px-4 py-3 hidden md:table-cell text-xs ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                              {dueDate ? dueDate.toLocaleDateString("fr-CH") : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-primary tabular-nums">
                              {formatCHF(inv.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/20">
                        <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total à recevoir</td>
                        <td className="px-4 py-3 text-right font-display text-base font-bold text-primary">{formatCHF(totalPipeline)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="font-body text-xs text-muted-foreground">
                Les dates de paiement estimées sont basées sur la date du devis + 30 jours.
                Les montants correspondent aux devis validés ou en attente de validation.
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
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Dépense rapide</DialogTitle>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
