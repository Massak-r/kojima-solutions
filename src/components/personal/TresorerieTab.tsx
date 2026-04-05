import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp, Loader2,
  TrendingDown, TrendingUp, Wallet, CalendarCheck, RefreshCw, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import {
  listPaymentPlans, createPaymentPlan, updatePaymentPlan, deletePaymentPlan,
} from "@/api/paymentPlans";
import type { PaymentPlanItem } from "@/api/paymentPlans";
import { listCosts } from "@/api/personalCosts";
import type { PersonalCostItem } from "@/api/personalCosts";
import { FREQUENCY_MONTHLY_FACTOR, FREQUENCY_DAYS, FREQUENCY_LABELS } from "@/types/personalCost";
import type { CostFrequency } from "@/types/personalCost";
import {
  type PaymentPlan, type PaymentPlanType,
  PLAN_TYPE_LABELS, PLAN_TYPE_CLASSES, isOngoingType,
  getAmountInMonth,
  getRemainingAmount, isPlanCompleted,
  currentYearMonth, formatYearMonth, getMonthOffset,
} from "@/types/paymentPlan";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCHF(n: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EXPENSE_COLORS = [
  "#6366f1", "#ec4899", "#f97316", "#14b8a6",
  "#8b5cf6", "#ef4444", "#eab308", "#06b6d4",
  "#84cc16", "#f43f5e",
];

const INCOME_COLORS = [
  "#10b981", "#059669", "#34d399", "#6ee7b7",
];

const RECURRING_COLOR = "hsl(var(--muted-foreground))";

// ── Due-date helpers (for recurring charges) ─────────────────────────────────

function getDaysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysUntilDue(cost: PersonalCostItem): number | null {
  const daysSince = getDaysSince(cost.lastPaid);
  if (daysSince === null) return null;
  return FREQUENCY_DAYS[cost.frequency as CostFrequency] - daysSince;
}

function dueLabel(days: number | null): { text: string; cls: string } {
  if (days === null) return { text: "Jamais payé", cls: "text-amber-600" };
  if (days < 0)      return { text: `En retard ${Math.abs(days)}j`, cls: "text-destructive font-semibold" };
  if (days === 0)    return { text: "Aujourd'hui", cls: "text-destructive font-semibold" };
  if (days <= 3)     return { text: `${days}j`, cls: "text-amber-600 font-medium" };
  if (days <= 7)     return { text: `${days}j`, cls: "text-amber-600" };
  if (days <= 14)    return { text: `${days}j`, cls: "text-muted-foreground" };
  if (days <= 30)    return { text: `${Math.round(days / 7)} sem`, cls: "text-muted-foreground" };
  return { text: `${Math.round(days / 30)} mois`, cls: "text-muted-foreground" };
}

function stripColor(days: number | null): string {
  if (days === null) return "bg-amber-400";
  if (days < 0)      return "bg-red-500";
  if (days <= 3)     return "bg-amber-400";
  if (days <= 7)     return "bg-amber-300";
  return "bg-green-400";
}

// ── Component ────────────────────────────────────────────────────────────────

export function TresorerieTab() {
  const [plans, setPlans] = useState<PaymentPlanItem[]>([]);
  const [costs, setCosts] = useState<PersonalCostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<PaymentPlanType>("installment");
  const [formAmount, setFormAmount] = useState("");
  const [formMonths, setFormMonths] = useState("12");
  const [formStart, setFormStart] = useState(todayStr().slice(0, 8) + "01");
  const [formTotalOwed, setFormTotalOwed] = useState("");
  const [formAdjustment, setFormAdjustment] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Edit dialog
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: "", type: "installment" as PaymentPlanType, monthlyAmount: "", totalMonths: "",
    startDate: "", totalOwed: "", adjustment: "", category: "", notes: "",
  });

  // Recurring charges section
  const [showRecurring, setShowRecurring] = useState(false);

  const { toast } = useToast();
  const errToast = useCallback(() => toast({ title: "Erreur", description: "L'opération a échoué", variant: "destructive" }), [toast]);

  useEffect(() => {
    Promise.all([
      listPaymentPlans().then(setPlans),
      listCosts().then(setCosts),
    ]).catch(errToast).finally(() => setLoading(false));
  }, [errToast]);

  // ── Computed ──

  // Split plans by type
  const expensePlans = useMemo(() => plans.filter(p => p.type !== "income"), [plans]);
  const incomePlans = useMemo(() => plans.filter(p => p.type === "income"), [plans]);

  const activeExpensePlans = useMemo(() => expensePlans.filter(p => !isPlanCompleted(p as PaymentPlan)), [expensePlans]);
  const activeIncomePlans = useMemo(() => incomePlans.filter(p => !isPlanCompleted(p as PaymentPlan)), [incomePlans]);

  const recurringMonthly = useMemo(
    () => costs.reduce((sum, c) => sum + c.amount * FREQUENCY_MONTHLY_FACTOR[c.frequency as CostFrequency], 0),
    [costs]
  );

  const curYM = currentYearMonth();

  const thisMonthExpenses = useMemo(
    () => activeExpensePlans.reduce((sum, p) => sum + getAmountInMonth(p as PaymentPlan, curYM), 0) + recurringMonthly,
    [activeExpensePlans, curYM, recurringMonthly]
  );

  const thisMonthIncome = useMemo(
    () => activeIncomePlans.reduce((sum, p) => sum + getAmountInMonth(p as PaymentPlan, curYM), 0),
    [activeIncomePlans, curYM]
  );

  const totalRemaining = useMemo(
    () => activeExpensePlans.filter(p => !isOngoingType(p.type)).reduce((sum, p) => sum + getRemainingAmount(p as PaymentPlan), 0),
    [activeExpensePlans]
  );

  const netBalance = thisMonthIncome - thisMonthExpenses;

  // ── Chart data: next 12 months ──

  const chartData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return months.map(ym => {
      const row: Record<string, string | number> = { month: formatYearMonth(ym) };

      // Recurring charges aggregated
      if (recurringMonthly > 0) {
        row["Charges récurrentes"] = Math.round(recurringMonthly);
      }

      // Individual expense plans
      activeExpensePlans.forEach(p => {
        const amt = getAmountInMonth(p as PaymentPlan, ym);
        if (amt > 0) row[p.name] = Math.round(amt);
      });

      // Individual income plans
      activeIncomePlans.forEach(p => {
        const amt = getAmountInMonth(p as PaymentPlan, ym);
        if (amt > 0) row[`💰 ${p.name}`] = Math.round(amt);
      });

      return row;
    });
  }, [activeExpensePlans, activeIncomePlans, recurringMonthly]);

  // Separate expense keys and income keys for dual stacking
  const { expenseKeys, incomeKeys } = useMemo(() => {
    const eKeys = new Set<string>();
    const iKeys = new Set<string>();
    const incomeNames = new Set(activeIncomePlans.map(p => `💰 ${p.name}`));

    chartData.forEach(row => {
      Object.keys(row).forEach(k => {
        if (k === "month") return;
        if (incomeNames.has(k)) iKeys.add(k);
        else eKeys.add(k);
      });
    });

    // Sort: "Charges récurrentes" first in expenses
    const eArr = Array.from(eKeys);
    const recurring = eArr.filter(k => k === "Charges récurrentes");
    const rest = eArr.filter(k => k !== "Charges récurrentes");
    return {
      expenseKeys: [...recurring, ...rest],
      incomeKeys: Array.from(iKeys),
    };
  }, [chartData, activeIncomePlans]);

  // ── Handlers ──

  async function handleAdd() {
    if (!formName.trim() || !formAmount) return;
    const isOngoing = formType === "recurring" || formType === "income";
    setSaving(true);
    try {
      const item = await createPaymentPlan({
        name: formName.trim(),
        type: formType,
        monthlyAmount: parseFloat(formAmount),
        totalMonths: isOngoing ? 9999 : (parseInt(formMonths) || 12),
        startDate: formStart,
        totalOwed: formTotalOwed ? parseFloat(formTotalOwed) : null,
        adjustment: formAdjustment ? parseFloat(formAdjustment) : null,
        category: formCategory.trim() || null,
        notes: formNotes.trim() || null,
        paidMonths: [],
      });
      setPlans(prev => [...prev, item]);
      setFormName(""); setFormAmount(""); setFormMonths("12");
      setFormStart(todayStr().slice(0, 8) + "01");
      setFormTotalOwed(""); setFormAdjustment("");
      setFormCategory(""); setFormNotes("");
      setFormType("installment");
      setShowForm(false);
      toast({ title: "Plan ajouté" });
    } catch { errToast(); }
    setSaving(false);
  }

  async function togglePaidMonth(planId: string, monthIdx: number) {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    const prev = plan.paidMonths;
    const next = prev.includes(monthIdx)
      ? prev.filter(m => m !== monthIdx)
      : [...prev, monthIdx].sort((a, b) => a - b);
    setPlans(p => p.map(x => x.id === planId ? { ...x, paidMonths: next } : x));
    try {
      await updatePaymentPlan(planId, { paidMonths: next });
    } catch {
      setPlans(p => p.map(x => x.id === planId ? { ...x, paidMonths: prev } : x));
      errToast();
    }
  }

  async function removePlan(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    const removed = plans.find(p => p.id === id);
    setPlans(prev => prev.filter(p => p.id !== id));
    setDeleteId(null);
    try { await deletePaymentPlan(id); }
    catch { if (removed) setPlans(prev => [...prev, removed]); errToast(); }
  }

  function openEdit(plan: PaymentPlanItem) {
    setEditId(plan.id);
    setEditData({
      name: plan.name,
      type: plan.type,
      monthlyAmount: String(plan.monthlyAmount),
      totalMonths: String(plan.totalMonths),
      startDate: plan.startDate,
      totalOwed: plan.totalOwed != null ? String(plan.totalOwed) : "",
      adjustment: plan.adjustment != null ? String(plan.adjustment) : "",
      category: plan.category ?? "",
      notes: plan.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editId) return;
    const isOngoing = editData.type === "recurring" || editData.type === "income";
    setSaving(true);
    try {
      const updated = await updatePaymentPlan(editId, {
        name: editData.name.trim(),
        type: editData.type,
        monthlyAmount: parseFloat(editData.monthlyAmount),
        totalMonths: isOngoing ? 9999 : (parseInt(editData.totalMonths) || 12),
        startDate: editData.startDate,
        totalOwed: editData.totalOwed ? parseFloat(editData.totalOwed) : null,
        adjustment: editData.adjustment ? parseFloat(editData.adjustment) : null,
        category: editData.category.trim() || null,
        notes: editData.notes.trim() || null,
      });
      setPlans(prev => prev.map(p => p.id === editId ? updated : p));
      setEditId(null);
      toast({ title: "Plan mis à jour" });
    } catch { errToast(); }
    setSaving(false);
  }

  const isFormOngoing = formType === "recurring" || formType === "income";

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Plans actifs", value: String(activeExpensePlans.length + activeIncomePlans.length), icon: <CalendarCheck size={14} className="text-primary" /> },
          { label: "Sorties ce mois", value: formatCHF(thisMonthExpenses), icon: <TrendingDown size={14} className="text-destructive" />, cls: "" },
          { label: "Rentrées ce mois", value: formatCHF(thisMonthIncome), icon: <TrendingUp size={14} className="text-emerald-600" />, cls: "" },
          { label: "Solde net", value: formatCHF(netBalance), icon: <Wallet size={14} className={netBalance >= 0 ? "text-emerald-600" : "text-destructive"} />, cls: netBalance >= 0 ? "text-emerald-600" : "text-destructive" },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-xl p-4 text-center"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {card.icon}
              <span className="text-xs font-body text-muted-foreground">{card.label}</span>
            </div>
            <span className={cn("text-base sm:text-lg font-bold font-body", card.cls)}>{card.value}</span>
          </motion.div>
        ))}
      </div>

      {/* ── Stacked Bar Chart ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-2xl p-5"
      >
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider mb-4">
          Projection mensuelle
        </h3>
        {expenseKeys.length === 0 && incomeKeys.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground font-body">
            Ajoutez un plan pour voir la projection.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fontFamily: "var(--font-body)" }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: "var(--font-body)" }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => `${Math.round(v / 100) * 100}`}
              />
              <ReTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [formatCHF(value), name]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-body)" }}
              />
              {/* Expense bars — stacked together */}
              {expenseKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="expenses"
                  fill={key === "Charges récurrentes" ? RECURRING_COLOR : EXPENSE_COLORS[i % EXPENSE_COLORS.length]}
                  radius={i === expenseKeys.length - 1 && incomeKeys.length === 0 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
              {/* Income bars — separate stack, side by side */}
              {incomeKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="income"
                  fill={INCOME_COLORS[i % INCOME_COLORS.length]}
                  radius={i === incomeKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Expense Plans ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-3"
      >
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
          Plans de paiement
        </h3>

        {expensePlans.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground font-body">
            Aucun plan pour l'instant. Ajoutez vos impôts, dettes ou échéances.
          </div>
        ) : (
          <div className="space-y-2">
            {expensePlans.map((plan, pi) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={pi}
                color={EXPENSE_COLORS[pi % EXPENSE_COLORS.length]}
                deleteId={deleteId}
                onEdit={() => openEdit(plan)}
                onDelete={() => removePlan(plan.id)}
                onCancelDelete={() => setDeleteId(null)}
                onToggleMonth={(idx) => togglePaidMonth(plan.id, idx)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Income Plans ── */}
      {(incomePlans.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="space-y-3"
        >
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-600" /> Revenus attendus
          </h3>
          <div className="space-y-2">
            {incomePlans.map((plan, pi) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                index={pi}
                color={INCOME_COLORS[pi % INCOME_COLORS.length]}
                deleteId={deleteId}
                onEdit={() => openEdit(plan)}
                onDelete={() => removePlan(plan.id)}
                onCancelDelete={() => setDeleteId(null)}
                onToggleMonth={(idx) => togglePaidMonth(plan.id, idx)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Charges Récurrentes (from Budget tab) ── */}
      {costs.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowRecurring(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <span className="font-display text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <RefreshCw size={14} className="text-teal-600" /> Charges récurrentes
              <Badge variant="secondary" className="text-[10px] font-body">{costs.length}</Badge>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-body text-muted-foreground">{formatCHF(recurringMonthly)}/mois</span>
              {showRecurring ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </div>
          </button>
          <AnimatePresence>
            {showRecurring && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-1">
                  {[...costs]
                    .sort((a, b) => {
                      const da = getDaysUntilDue(a);
                      const db = getDaysUntilDue(b);
                      // null (never paid) first, then overdue first, then soonest
                      if (da === null && db === null) return 0;
                      if (da === null) return -1;
                      if (db === null) return 1;
                      return da - db;
                    })
                    .map(cost => {
                    const monthly = cost.amount * FREQUENCY_MONTHLY_FACTOR[cost.frequency as CostFrequency];
                    const days = getDaysUntilDue(cost);
                    const dl = dueLabel(days);
                    return (
                      <div key={cost.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={cn("w-1.5 h-6 rounded-full shrink-0", stripColor(days))} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-body font-medium text-sm truncate">{cost.name}</span>
                            {cost.category && (
                              <Badge variant="secondary" className="text-[10px] font-body">{cost.category}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-body">
                            <span>{formatCHF(cost.amount)} · {FREQUENCY_LABELS[cost.frequency as CostFrequency]}</span>
                            <span className="opacity-60">≈ {formatCHF(monthly)}/mois</span>
                            <span className={cn("text-[11px]", dl.cls)}>{dl.text}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 flex justify-end">
                    <span className="text-[11px] font-body text-muted-foreground flex items-center gap-1">
                      Gérer dans l'onglet Budget <ArrowRight size={10} />
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Add Form ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowForm(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <span className="font-display text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Plus size={14} className="text-primary" /> Nouveau plan
          </span>
          {showForm ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Nom</label>
                    <Input
                      placeholder={formType === "income" ? "Ex: Salaire, Client X…" : "Ex: Impôts 2026, Crédit voiture…"}
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Type</label>
                    <Select value={formType} onValueChange={v => setFormType(v as PaymentPlanType)}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="installment">Échéances fixes (dette)</SelectItem>
                        <SelectItem value="recurring-adjusted">Récurrent avec ajustement (impôts)</SelectItem>
                        <SelectItem value="income">Revenu attendu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className={cn("grid gap-3", isFormOngoing ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">
                      {formType === "income" ? "Montant attendu (CHF)" : "Montant mensuel (CHF)"}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="500"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  {!isFormOngoing && (
                    <div>
                      <label className="text-xs font-body text-muted-foreground mb-1 block">Nombre de mois</label>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        placeholder="12"
                        value={formMonths}
                        onChange={e => setFormMonths(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Date de début</label>
                    <Input
                      type="date"
                      value={formStart}
                      onChange={e => setFormStart(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {formType === "installment" && (
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Montant total dû (optionnel)</label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Ex: 3000"
                      value={formTotalOwed}
                      onChange={e => setFormTotalOwed(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                {formType === "recurring-adjusted" && (
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Ajustement de fin de cycle (+ ou −)</label>
                    <Input
                      type="number"
                      placeholder="Ex: -200 (remboursement) ou 150 (supplément)"
                      value={formAdjustment}
                      onChange={e => setFormAdjustment(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Catégorie (optionnel)</label>
                    <Input
                      placeholder={formType === "income" ? "Ex: Salaire, Freelance…" : "Ex: Impôts, Crédit, Santé…"}
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-body text-muted-foreground mb-1 block">Notes (optionnel)</label>
                    <Input
                      placeholder="Détails supplémentaires…"
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleAdd} disabled={saving || !formName.trim() || !formAmount} size="sm" className="gap-1.5">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Ajouter
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editId} onOpenChange={open => { if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier le plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Nom</label>
              <Input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Type</label>
              <Select value={editData.type} onValueChange={v => setEditData(d => ({ ...d, type: v as PaymentPlanType }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installment">Échéances fixes</SelectItem>
                  <SelectItem value="recurring-adjusted">Récurrent avec ajustement</SelectItem>
                  <SelectItem value="income">Revenu attendu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">
                  {editData.type === "income" ? "Montant attendu" : "Montant mensuel"}
                </label>
                <Input type="number" value={editData.monthlyAmount} onChange={e => setEditData(d => ({ ...d, monthlyAmount: e.target.value }))} className="text-sm" />
              </div>
              {!isOngoingType(editData.type) && (
                <div>
                  <label className="text-xs font-body text-muted-foreground mb-1 block">Nombre de mois</label>
                  <Input type="number" value={editData.totalMonths} onChange={e => setEditData(d => ({ ...d, totalMonths: e.target.value }))} className="text-sm" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Date de début</label>
              <Input type="date" value={editData.startDate} onChange={e => setEditData(d => ({ ...d, startDate: e.target.value }))} className="text-sm" />
            </div>
            {editData.type === "installment" && (
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Montant total dû</label>
                <Input type="number" value={editData.totalOwed} onChange={e => setEditData(d => ({ ...d, totalOwed: e.target.value }))} className="text-sm" />
              </div>
            )}
            {editData.type === "recurring-adjusted" && (
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Ajustement de fin</label>
                <Input type="number" value={editData.adjustment} onChange={e => setEditData(d => ({ ...d, adjustment: e.target.value }))} className="text-sm" />
              </div>
            )}
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Catégorie</label>
              <Input value={editData.category} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Notes</label>
              <Textarea value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} rows={2} className="text-sm resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)} size="sm">Annuler</Button>
            <Button onClick={saveEdit} disabled={saving || !editData.name.trim() || !editData.monthlyAmount} size="sm" className="gap-1.5">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Plan Card Component ────────────────────────────────────────────────────────

function PlanCard({
  plan, index, color, deleteId,
  onEdit, onDelete, onCancelDelete, onToggleMonth,
}: {
  plan: PaymentPlanItem;
  index: number;
  color: string;
  deleteId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onToggleMonth: (idx: number) => void;
}) {
  const ongoing = isOngoingType(plan.type);
  const completed = isPlanCompleted(plan as PaymentPlan);
  const remaining = getRemainingAmount(plan as PaymentPlan);
  const pct = ongoing ? 0 : Math.round((plan.paidMonths.length / plan.totalMonths) * 100);
  const isIncome = plan.type === "income";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "glass-card rounded-xl p-4 group",
        completed && "opacity-60"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="font-body font-semibold text-sm truncate">{plan.name}</span>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", PLAN_TYPE_CLASSES[plan.type])}>
            {PLAN_TYPE_LABELS[plan.type]}
          </Badge>
          {completed && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200">
              Terminé
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100 transition-all"
          >
            <Pencil size={13} />
          </button>
          {deleteId === plan.id ? (
            <div className="flex gap-1">
              <button onClick={onDelete} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">Oui</button>
              <button onClick={onCancelDelete} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Non</button>
            </div>
          ) : (
            <button
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs font-body text-muted-foreground mb-2 flex-wrap">
        <span>{formatCHF(plan.monthlyAmount)}/{isIncome ? "mois attendu" : "mois"}</span>
        {!ongoing && (
          <>
            <span>{plan.paidMonths.length}/{plan.totalMonths} {isIncome ? "reçus" : "payés"}</span>
            <span>Restant: <strong className="text-foreground">{formatCHF(remaining)}</strong></span>
          </>
        )}
        {ongoing && (
          <span className="text-teal-600">En continu</span>
        )}
        {plan.type === "recurring-adjusted" && plan.adjustment != null && (
          <span className={plan.adjustment >= 0 ? "text-destructive" : "text-emerald-600"}>
            Ajust: {plan.adjustment >= 0 ? "+" : ""}{formatCHF(plan.adjustment)}
          </span>
        )}
      </div>

      {/* Progress bar (only for finite plans) */}
      {!ongoing && (
        <div className="h-1.5 rounded-full bg-secondary mb-2 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}

      {/* Month circles (only for finite plans) */}
      {!ongoing && (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: plan.totalMonths }, (_, i) => {
            const paid = plan.paidMonths.includes(i);
            const label = formatYearMonth(getMonthOffset(plan.startDate, i));
            return (
              <button
                key={i}
                title={`${label} — ${paid ? (isIncome ? "Reçu" : "Payé") : (isIncome ? "Non reçu" : "Non payé")}`}
                onClick={() => onToggleMonth(i)}
                className={cn(
                  "w-5 h-5 rounded-full border-2 text-[8px] font-bold font-body transition-all flex items-center justify-center",
                  paid
                    ? "border-transparent text-white"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                )}
                style={paid ? { backgroundColor: color } : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
