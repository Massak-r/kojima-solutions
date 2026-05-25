import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine, Area,
} from "recharts";
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQuotes } from "@/hooks/useQuotes";
import type { PaymentPlanItem } from "@/api/paymentPlans";
import type { PersonalCostItem } from "@/api/personalCosts";
import {
  type PaymentPlan,
  getAmountInMonth,
} from "@/types/paymentPlan";
import {
  FREQUENCY_MONTHLY_FACTOR,
  type CostFrequency,
} from "@/types/personalCost";
import { totalQuote } from "@/types/quote";

const BALANCE_STORAGE_KEY = "kojima-current-balance";
const HORIZON_MONTHS = 6;

interface ForecastPanelProps {
  plans: PaymentPlanItem[];
  costs: PersonalCostItem[];
}

function formatCHF(n: number, opts?: { compact?: boolean }) {
  const fmt = new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
    notation: opts?.compact ? "compact" : "standard",
  });
  return fmt.format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

function loadBalance(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BALANCE_STORAGE_KEY);
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function persistBalance(value: number) {
  try {
    window.localStorage.setItem(BALANCE_STORAGE_KEY, String(value));
  } catch {}
}

function formatYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shortMonthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

export function ForecastPanel({ plans, costs }: ForecastPanelProps) {
  const { quotes } = useQuotes();

  const [balance, setBalance] = useState<number>(() => loadBalance());
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    persistBalance(balance);
  }, [balance]);

  // Aggregate recurring monthly burn from personal_costs.
  const recurringMonthly = useMemo(
    () => costs.reduce((sum, c) => {
      const factor = FREQUENCY_MONTHLY_FACTOR[c.frequency as CostFrequency] ?? 0;
      return sum + c.amount * factor;
    }, 0),
    [costs],
  );

  const activePlans = useMemo(
    () => plans.map((p) => p as PaymentPlan),
    [plans],
  );

  // Income from unpaid invoices materializes on their validityDate.
  // Bucketed by YYYY-MM for the chart.
  const incomeByMonth = useMemo(() => {
    const map = new Map<string, { amount: number; sources: string[] }>();
    for (const q of quotes) {
      if (q.docType !== "invoice") continue;
      if (q.invoiceStatus !== "validated") continue;
      const due = q.validityDate || q.createdAt.slice(0, 10);
      const ym = due.slice(0, 7);
      const total = totalQuote(q);
      const prev = map.get(ym) ?? { amount: 0, sources: [] };
      prev.amount += total;
      prev.sources.push(q.quoteNumber || q.projectTitle || q.clientName);
      map.set(ym, prev);
    }
    return map;
  }, [quotes]);

  // 6-month projection: each row = { month, balance, income, expense, sources }.
  const series = useMemo(() => {
    const out: {
      month: string;
      label: string;
      balance: number;
      income: number;
      expense: number;
      pendingInvoices?: string[];
    }[] = [];
    const now = new Date();
    let running = balance;
    for (let i = 0; i <= HORIZON_MONTHS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = formatYM(d);
      let income = 0;
      let expense = 0;
      if (i === 0) {
        // Anchor row reflects current balance with no movement yet.
        out.push({ month: ym, label: "Aujourd'hui", balance: running, income: 0, expense: 0 });
        continue;
      }
      // Recurring personal costs each month.
      expense += recurringMonthly;
      // Plans: stacked exposure.
      for (const p of activePlans) {
        const amt = getAmountInMonth(p, ym);
        if (amt <= 0) continue;
        if (p.type === "income") income += amt;
        else expense += amt;
      }
      // One-off invoice income falling in this month.
      const inv = incomeByMonth.get(ym);
      if (inv) {
        income += inv.amount;
      }
      running = running + income - expense;
      out.push({
        month: ym,
        label: shortMonthLabel(d),
        balance: Math.round(running),
        income: Math.round(income),
        expense: Math.round(expense),
        pendingInvoices: inv?.sources,
      });
    }
    return out;
  }, [balance, activePlans, recurringMonthly, incomeByMonth]);

  // Average net burn (income - expense, excluding the anchor row).
  const avgNet = useMemo(() => {
    if (series.length <= 1) return 0;
    const movingRows = series.slice(1);
    const sum = movingRows.reduce((s, r) => s + (r.income - r.expense), 0);
    return sum / movingRows.length;
  }, [series]);

  // Runway: months until balance crosses zero at avg net burn rate (only when burn is negative).
  const runwayMonths = useMemo(() => {
    if (avgNet >= 0) return Infinity;
    if (balance <= 0) return 0;
    return Math.floor(balance / Math.abs(avgNet));
  }, [balance, avgNet]);

  // First month where projected balance dips below zero (if any), for inline warning.
  const firstNegativeMonth = useMemo(
    () => series.slice(1).find((r) => r.balance < 0),
    [series],
  );

  const endBalance = series.length > 0 ? series[series.length - 1].balance : balance;

  function startEditBalance() {
    setBalanceInput(String(balance));
    setEditingBalance(true);
  }

  function commitBalance() {
    const trimmed = balanceInput.trim().replace(",", ".");
    const n = Number.parseFloat(trimmed);
    if (Number.isFinite(n)) {
      setBalance(n);
    }
    setEditingBalance(false);
  }

  function runwayLabel(): { text: string; tone: "ok" | "warn" | "danger" | "growing" } {
    if (avgNet >= 0) return { text: "Croissance — pas de runway requis", tone: "growing" };
    if (!Number.isFinite(runwayMonths)) return { text: "—", tone: "ok" };
    if (runwayMonths <= 0) return { text: "Découvert immédiat", tone: "danger" };
    if (runwayMonths <= 3) return { text: `${runwayMonths} mois`, tone: "danger" };
    if (runwayMonths <= 6) return { text: `${runwayMonths} mois`, tone: "warn" };
    if (runwayMonths >= 24) return { text: "24+ mois", tone: "ok" };
    return { text: `${runwayMonths} mois`, tone: "ok" };
  }

  const runway = runwayLabel();
  const tonePill =
    runway.tone === "danger" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40"
    : runway.tone === "warn"   ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40"
    : runway.tone === "growing"? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40"
    :                            "bg-primary/10 text-primary border-primary/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-2xl p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Projection sur {HORIZON_MONTHS} mois
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-body font-semibold border", tonePill)}>
            {runway.tone === "growing" ? <TrendingUp size={11} /> :
             runway.tone === "danger"  ? <AlertTriangle size={11} /> :
                                         <TrendingDown size={11} />}
            Runway : {runway.text}
          </span>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            aria-label={collapsed ? "Déplier" : "Replier"}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Current balance (editable) */}
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">Solde actuel</span>
                {!editingBalance && (
                  <button
                    onClick={startEditBalance}
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    aria-label="Modifier le solde"
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </div>
              {editingBalance ? (
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitBalance();
                      if (e.key === "Escape") setEditingBalance(false);
                    }}
                    className="h-7 text-sm tabular-nums"
                  />
                  <button
                    onClick={commitBalance}
                    className="text-emerald-600 hover:text-emerald-700 p-1"
                    aria-label="Valider"
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : (
                <p className="text-lg font-bold tabular-nums">{formatCHF(balance)}</p>
              )}
            </div>
            {/* Avg net cashflow */}
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body block mb-1">Net moyen / mois</span>
              <p className={cn("text-lg font-bold tabular-nums",
                avgNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}>
                {avgNet >= 0 ? "+" : ""}{formatCHF(Math.round(avgNet))}
              </p>
            </div>
            {/* Projected end balance */}
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body block mb-1">Dans {HORIZON_MONTHS} mois</span>
              <p className={cn("text-lg font-bold tabular-nums",
                endBalance < 0 ? "text-destructive"
                : endBalance < balance ? "text-amber-700 dark:text-amber-300"
                : "text-emerald-600 dark:text-emerald-400",
              )}>
                {formatCHF(endBalance)}
              </p>
            </div>
            {/* Pending invoices in window */}
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body block mb-1">Factures en attente</span>
              <p className="text-lg font-bold tabular-nums">
                {formatCHF(Array.from(incomeByMonth.values()).reduce((s, v) => s + v.amount, 0))}
              </p>
            </div>
          </div>

          {/* Negative-month warning */}
          {firstNegativeMonth && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                Solde projeté négatif dès <strong>{firstNegativeMonth.label}</strong> ({formatCHF(firstNegativeMonth.balance)}). Encaisse une facture en attente ou ajuste tes charges.
              </span>
            </div>
          )}

          {/* Chart */}
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "var(--font-body)" }} />
                <YAxis
                  tickFormatter={(v) => formatCHF(v, { compact: true })}
                  tick={{ fontSize: 10, fontFamily: "var(--font-body)" }}
                  width={64}
                />
                <ReTooltip
                  contentStyle={{ borderRadius: 12, fontSize: 12, fontFamily: "var(--font-body)" }}
                  formatter={(value: number, key: string) => {
                    if (key === "balance") return [formatCHF(value), "Solde"];
                    if (key === "income")  return [formatCHF(value), "Rentrées"];
                    if (key === "expense") return [formatCHF(value), "Sorties"];
                    return [formatCHF(value), key];
                  }}
                  labelFormatter={(label) => label}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#forecast-fill)"
                  fillOpacity={1}
                  animationDuration={600}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Notes */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/80 font-body">
            <span>· Charges récurrentes ({formatCHF(recurringMonthly)}/mois) + plans actifs + factures en attente.</span>
            <span>· Le solde projeté ne tient pas compte des devis non validés.</span>
            <button
              onClick={startEditBalance}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Mettre à jour le solde actuel
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
