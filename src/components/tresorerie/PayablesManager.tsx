import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Check, RotateCcw, Loader2, CalendarClock,
  AlertCircle, Repeat, CalendarRange, TrendingDown, TrendingUp,
  ArrowDownRight, ArrowUpRight, Lock, CircleDashed,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  listPayables, createPayable, updatePayable, deletePayable,
} from "@/api/payables";
import { listAccounts } from "@/api/accounts";
import {
  type Payable, type PayableStatus, type PayableRecurrence, type PayableDirection, type PayableCommitment,
  PAYABLE_STATUS_LABELS, PAYABLE_RECURRENCE_LABELS, PAYABLE_COMMITMENT_LABELS,
} from "@/types/payable";
import type { Account } from "@/types/account";
import { cn } from "@/lib/utils";

function formatCHF(n: number, currency = "CHF") {
  try {
    return new Intl.NumberFormat("fr-CH", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const target = new Date(date + "T00:00:00").getTime();
  const today  = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((target - today) / 86_400_000);
}

function dueLabel(date?: string | null): { text: string; tone: "ok" | "warn" | "danger" | "muted" } {
  const d = daysUntil(date);
  if (d === null) return { text: "Sans date", tone: "muted" };
  if (d < 0)   return { text: `En retard de ${-d} j`, tone: "danger" };
  if (d === 0) return { text: "Aujourd'hui", tone: "danger" };
  if (d <= 7)  return { text: `Dans ${d} j`, tone: "warn" };
  if (d <= 30) return { text: `Dans ${d} j`, tone: "ok" };
  return { text: new Date(date! + "T00:00:00").toLocaleDateString("fr-CH", { day: "2-digit", month: "short" }), tone: "muted" };
}

// ── Forecast helpers ──────────────────────────────────────────────────────────
// Both project recurring payables into virtual future occurrences. The DB only
// holds the current open instance (next one is spawned on mark-paid), so any
// forward-looking view has to synthesize what will accrue if nothing is paid.

function advanceOccurrence(d: Date, recurrence: PayableRecurrence): boolean {
  switch (recurrence) {
    case "weekly":    d.setDate(d.getDate() + 7); return true;
    case "monthly":   d.setMonth(d.getMonth() + 1); return true;
    case "bimonthly": d.setMonth(d.getMonth() + 2); return true;
    case "quarterly": d.setMonth(d.getMonth() + 3); return true;
    case "biannual":  d.setMonth(d.getMonth() + 6); return true;
    case "yearly":    d.setFullYear(d.getFullYear() + 1); return true;
    default: return false;
  }
}

interface MonthBucket { ym: string; label: string; out: number; in: number; net: number }

function projectByMonth(payables: Payable[], monthsAhead = 6): MonthBucket[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getFullYear(), today.getMonth() + monthsAhead, 0, 23, 59, 59);

  const buckets: MonthBucket[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ ym, label: d.toLocaleDateString("fr-CH", { month: "short" }), out: 0, in: 0, net: 0 });
  }
  const byYm = new Map(buckets.map(b => [b.ym, b]));

  const accrue = (b: MonthBucket, amount: number, direction: PayableDirection) => {
    if (direction === "in") b.in += amount; else b.out += amount;
  };

  for (const p of payables) {
    if (p.status !== "pending" && p.status !== "scheduled") continue;
    if (!p.dueDate) continue;
    const recEnd = p.recurrenceEnd ? new Date(p.recurrenceEnd + "T23:59:59") : null;
    const occ = new Date(p.dueDate + "T00:00:00");
    let safety = 0;
    while (occ <= horizon && safety++ < 200) {
      if (recEnd && occ > recEnd) break;
      const ym = `${occ.getFullYear()}-${String(occ.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byYm.get(ym);
      if (bucket) accrue(bucket, p.amount, p.direction);
      if (!advanceOccurrence(occ, p.recurrence)) break;
    }
    // Apply year-end adjustment (e.g. impôts rattrapage) on its own bucket.
    if (p.adjustmentAmount != null && p.adjustmentDueDate) {
      const adj = new Date(p.adjustmentDueDate + "T00:00:00");
      if (adj <= horizon) {
        const ym = `${adj.getFullYear()}-${String(adj.getMonth() + 1).padStart(2, "0")}`;
        const bucket = byYm.get(ym);
        if (bucket) accrue(bucket, p.adjustmentAmount, p.direction);
      }
    }
  }
  for (const b of buckets) { b.out = Math.round(b.out); b.in = Math.round(b.in); b.net = b.in - b.out; }
  return buckets;
}

interface RangeSummary { out: number; in: number; outCount: number; inCount: number }

function sumUntil(payables: Payable[], until: string): RangeSummary {
  const limit = new Date(until + "T23:59:59");
  const r: RangeSummary = { out: 0, in: 0, outCount: 0, inCount: 0 };
  for (const p of payables) {
    if (p.status !== "pending" && p.status !== "scheduled") continue;
    if (!p.dueDate) continue;
    const recEnd = p.recurrenceEnd ? new Date(p.recurrenceEnd + "T23:59:59") : null;
    const occ = new Date(p.dueDate + "T00:00:00");
    let safety = 0;
    while (occ <= limit && safety++ < 500) {
      if (recEnd && occ > recEnd) break;
      if (p.direction === "in") { r.in += p.amount; r.inCount++; }
      else                      { r.out += p.amount; r.outCount++; }
      if (!advanceOccurrence(occ, p.recurrence)) break;
    }
    if (p.adjustmentAmount != null && p.adjustmentDueDate) {
      const adj = new Date(p.adjustmentDueDate + "T00:00:00");
      if (adj <= limit) {
        if (p.direction === "in") { r.in += p.adjustmentAmount; r.inCount++; }
        else                      { r.out += p.adjustmentAmount; r.outCount++; }
      }
    }
  }
  return r;
}

function sumDirection(payables: Payable[], direction: PayableDirection, withinDays: number): number {
  return payables
    .filter(p => p.direction === direction)
    .filter(p => (p.status === "pending" || p.status === "scheduled") && p.dueDate)
    .filter(p => { const d = daysUntil(p.dueDate); return d !== null && d <= withinDays; })
    .reduce((s, p) => s + p.amount, 0);
}

interface FormState {
  label: string;
  amount: string;
  currency: string;
  direction: PayableDirection;
  dueDate: string;
  accountId: string;
  status: PayableStatus;
  commitment: PayableCommitment;
  category: string;
  notes: string;
  recurrence: PayableRecurrence;
  recurrenceDay: string;
  recurrenceEnd: string;
  adjustmentAmount: string;
  adjustmentDueDate: string;
}

const EMPTY_FORM: FormState = {
  label: "", amount: "", currency: "CHF", direction: "out", dueDate: "", accountId: "",
  status: "pending", commitment: "committed", category: "", notes: "",
  recurrence: "none", recurrenceDay: "", recurrenceEnd: "",
  adjustmentAmount: "", adjustmentDueDate: "",
};

export function PayablesManager() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "scheduled" | "paid" | "all">("pending");
  const [directionFilter, setDirectionFilter] = useState<"all" | PayableDirection>("all");
  const [commitmentFilter, setCommitmentFilter] = useState<"all" | PayableCommitment>("all");
  // Unified horizon: ONE date drives both the "Jusqu'au" projection and the list
  // scope (rows due on/before it). The slider and the date input both edit it.
  // Default = end of next month, so the projection opens on a useful value.
  const [untilDate, setUntilDate] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 2); d.setDate(0);
    return d.toISOString().slice(0, 10);
  });
  const [editing, setEditing] = useState<Payable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const errToast = (msg = "L'opération a échoué") =>
    toast({ title: "Erreur", description: msg, variant: "destructive" });

  const reload = () =>
    Promise.all([listPayables(), listAccounts()])
      .then(([p, a]) => { setPayables(p); setAccounts(a); })
      .catch(() => errToast())
      .finally(() => setLoading(false));

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    let xs = payables;
    if (directionFilter !== "all") xs = xs.filter(p => p.direction === directionFilter);
    if (commitmentFilter !== "all") xs = xs.filter(p => p.commitment === commitmentFilter);
    // ISO dates compare lexicographically; undated rows always pass (no horizon
    // to exceed) and overdue rows pass too (dueDate < today ≤ horizon).
    if (untilDate) xs = xs.filter(p => !p.dueDate || p.dueDate <= untilDate);
    if (tab !== "all") xs = xs.filter(p => p.status === tab);
    return xs;
  }, [payables, tab, directionFilter, commitmentFilter, untilDate]);

  // Slider position = days from today, clamped to its 0–365 range. A date picked
  // further out via the input still filters/projects correctly; the thumb just
  // pins at the far end.
  const horizonDays = Math.max(0, Math.min(365, daysUntil(untilDate) ?? 365));
  const setHorizonFromDays = (d: number) => {
    const base = new Date(); base.setHours(0, 0, 0, 0); base.setDate(base.getDate() + d);
    setUntilDate(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`);
  };
  // "Tout" shortcut → stretch the horizon to the furthest due date so every row
  // shows (undated rows always do); falls back to today if nothing is dated.
  const maxDueDate = useMemo(() => {
    let m: string | null = null;
    for (const p of payables) if (p.dueDate && (!m || p.dueDate > m)) m = p.dueDate;
    return m;
  }, [payables]);

  const totalDue30Out = useMemo(() => sumDirection(payables, "out", 30), [payables]);
  const totalDue30In  = useMemo(() => sumDirection(payables, "in",  30), [payables]);

  const overdueCount = useMemo(() => {
    return payables.filter(p => p.status === "pending" && p.direction === "out" && p.dueDate && (daysUntil(p.dueDate) ?? 1) < 0).length;
  }, [payables]);

  const chartData     = useMemo(() => projectByMonth(payables, 6), [payables]);
  const chartHasData  = useMemo(() => chartData.some(d => d.out > 0 || d.in > 0), [chartData]);
  const untilSummary  = useMemo(() => sumUntil(payables, untilDate), [payables, untilDate]);
  const untilNet      = untilSummary.in - untilSummary.out;
  const untilDateNice = useMemo(() => {
    if (!untilDate) return "";
    return new Date(untilDate + "T00:00:00").toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
  }, [untilDate]);

  function openCreate(direction: PayableDirection = directionFilter === "in" ? "in" : "out") {
    setEditing(null);
    setForm({ ...EMPTY_FORM, direction });
    setDialogOpen(true);
  }

  function openEdit(p: Payable) {
    setEditing(p);
    setForm({
      label: p.label,
      amount: p.amount.toString(),
      currency: p.currency,
      direction: p.direction,
      dueDate: p.dueDate ?? "",
      accountId: p.accountId ?? "",
      status: p.status,
      commitment: p.commitment,
      category: p.category ?? "",
      notes: p.notes ?? "",
      recurrence: p.recurrence,
      recurrenceDay: p.recurrenceDay?.toString() ?? "",
      recurrenceEnd: p.recurrenceEnd ?? "",
      adjustmentAmount: p.adjustmentAmount != null ? p.adjustmentAmount.toString() : "",
      adjustmentDueDate: p.adjustmentDueDate ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim()) { errToast("Libellé requis"); return; }
    const amount = parseFloat(form.amount.replace(",", "."));
    if (!isFinite(amount)) { errToast("Montant invalide"); return; }
    setSaving(true);
    const adj = form.adjustmentAmount ? parseFloat(form.adjustmentAmount.replace(",", ".")) : null;
    const payload = {
      label: form.label.trim(),
      amount,
      currency: form.currency.trim() || "CHF",
      direction: form.direction,
      dueDate: form.dueDate || null,
      accountId: form.accountId || null,
      status: form.status,
      commitment: form.commitment,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
      recurrence: form.recurrence,
      recurrenceDay: form.recurrenceDay ? parseInt(form.recurrenceDay, 10) : null,
      recurrenceEnd: form.recurrenceEnd || null,
      adjustmentAmount: adj !== null && isFinite(adj) ? adj : null,
      adjustmentDueDate: form.adjustmentDueDate || null,
    };
    try {
      if (editing) {
        const updated = await updatePayable(editing.id, payload);
        if ((updated as Payable & { spawned?: Payable }).spawned) {
          toast({ title: "Prochaine échéance créée", description: "Une nouvelle entrée a été générée pour la prochaine occurrence." });
        } else {
          toast({ title: "Payable mis à jour" });
        }
      } else {
        await createPayable(payload);
        toast({ title: "Payable créé" });
      }
      setDialogOpen(false);
      await reload();
    } catch { errToast(); }
    finally { setSaving(false); }
  }

  async function markPaid(p: Payable) {
    try {
      const res = await updatePayable(p.id, { status: "paid" });
      if (res.spawned) {
        toast({ title: "Marqué payé", description: "Prochaine échéance générée automatiquement." });
      } else {
        toast({ title: "Marqué payé" });
      }
      await reload();
    } catch { errToast(); }
  }

  async function markUnpaid(p: Payable) {
    try {
      await updatePayable(p.id, { status: "pending" });
      toast({ title: "Remis à payer" });
      await reload();
    } catch { errToast(); }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deletePayable(deletingId);
      toast({ title: "Supprimé" });
      setDeletingId(null);
      await reload();
    } catch { errToast(); }
  }

  const toneClass = {
    ok:     "text-emerald-700 dark:text-emerald-400",
    warn:   "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
    muted:  "text-muted-foreground",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Paiements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tout ce qui sort ou rentre — sorties + entrées attendues.
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate()} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nouveau
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border p-3 sm:p-4 bg-muted/30">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" /> Sorties 30j
          </div>
          <div className="font-display text-xl sm:text-2xl font-semibold tabular-nums mt-1 text-red-700 dark:text-red-400">
            {formatCHF(totalDue30Out)}
          </div>
        </div>
        <div className="rounded-xl border p-3 sm:p-4 bg-muted/30">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Entrées 30j
          </div>
          <div className="font-display text-xl sm:text-2xl font-semibold tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
            {formatCHF(totalDue30In)}
          </div>
        </div>
        <div className="rounded-xl border p-3 sm:p-4 bg-muted/30">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> En retard
          </div>
          <div className={cn("font-display text-xl sm:text-2xl font-semibold tabular-nums mt-1", overdueCount > 0 && "text-red-700 dark:text-red-400")}>
            {overdueCount}
          </div>
        </div>
        <div className="rounded-xl border p-3 sm:p-4 bg-muted/30 col-span-2 lg:col-span-1">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <CalendarRange className="h-3 w-3" /> Jusqu'au
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="date"
              value={untilDate}
              onChange={e => setUntilDate(e.target.value)}
              className="h-7 text-[11px] w-[8.5rem]"
            />
          </div>
          <div className={cn(
            "font-display text-lg sm:text-xl font-semibold tabular-nums mt-2",
            untilNet < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
          )}>
            {untilNet >= 0 ? "+" : ""}{formatCHF(untilNet)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
            −{formatCHF(untilSummary.out)} · +{formatCHF(untilSummary.in)}
          </div>
        </div>
      </div>

      {chartHasData && (
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Projection 6 mois</h3>
            <span className="text-[10px] text-muted-foreground/70 ml-auto">récurrences projetées</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fontFamily: "var(--font-body)" }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: "var(--font-body)" }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                width={40}
              />
              <ReTooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => {
                  if (name === "out") return [formatCHF(value), "Sorties"];
                  if (name === "in")  return [formatCHF(value), "Entrées"];
                  return [formatCHF(value), name];
                }}
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-body)" }}
                formatter={(value) => value === "out" ? "Sorties" : value === "in" ? "Entrées" : value}
              />
              <Bar dataKey="out" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="in"  fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Direction</span>
        {(["all", "out", "in"] as const).map(d => (
          <button
            key={d}
            onClick={() => setDirectionFilter(d)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition",
              directionFilter === d
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {d === "all" ? "Tout" : d === "out" ? "Sorties" : "Entrées"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Type</span>
        {(["all", "committed", "forecast"] as const).map(c => (
          <button
            key={c}
            onClick={() => setCommitmentFilter(c)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition",
              commitmentFilter === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "all" ? "Tout" : PAYABLE_COMMITMENT_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Unified horizon — the slider IS the "Jusqu'au" date: it drives both the
          projection card above and the list scope below. */}
      <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Jusqu'au</span>
        <Slider
          value={[horizonDays]}
          min={0}
          max={365}
          step={1}
          onValueChange={([d]) => setHorizonFromDays(d)}
          className="flex-1 min-w-[140px] max-w-xs"
          aria-label="Horizon d'échéance"
        />
        <Input
          type="date"
          value={untilDate}
          onChange={e => setUntilDate(e.target.value)}
          className="h-7 text-[11px] w-[8.5rem] shrink-0"
        />
        <button
          onClick={() => setUntilDate(maxDueDate ?? untilDate)}
          title="Jusqu'à la dernière échéance"
          className="text-xs px-2.5 py-1 rounded-full border transition shrink-0 bg-background border-border text-muted-foreground hover:text-foreground"
        >
          Tout
        </button>
        <span className="text-[11px] font-body shrink-0 tabular-nums ml-auto">
          <span className="text-muted-foreground">{filtered.length} ligne{filtered.length !== 1 ? "s" : ""} · solde net </span>
          <span className={untilNet < 0 ? "text-red-700 dark:text-red-400 font-semibold" : "text-emerald-700 dark:text-emerald-400 font-semibold"}>
            {untilNet >= 0 ? "+" : ""}{formatCHF(untilNet)}
          </span>
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">À régler</TabsTrigger>
          <TabsTrigger value="scheduled">Programmés</TabsTrigger>
          <TabsTrigger value="paid">Réglés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground italic border rounded-lg px-4 py-10 text-center">
              Aucun payable {tab !== "all" ? `«${PAYABLE_STATUS_LABELS[tab]}»` : ""}.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(p => {
                const due = dueLabel(p.dueDate);
                const account = p.accountId ? accountById.get(p.accountId) : null;
                const isIn = p.direction === "in";
                return (
                  <li key={p.id} className={cn(
                    "group border rounded-lg p-3 transition hover:border-primary/40 border-l-4",
                    isIn ? "border-l-emerald-500/60" : "border-l-red-500/60",
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => openEdit(p)} className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isIn ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                : <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />}
                          <span className="font-medium truncate">{p.label}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs gap-1",
                              p.commitment === "forecast"
                                ? "border-dashed border-amber-500/50 text-amber-700 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {p.commitment === "forecast" ? <CircleDashed className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {PAYABLE_COMMITMENT_LABELS[p.commitment]}
                          </Badge>
                          {p.recurrence !== "none" && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Repeat className="h-3 w-3" /> {PAYABLE_RECURRENCE_LABELS[p.recurrence]}
                            </Badge>
                          )}
                          {p.category && <Badge variant="secondary" className="text-xs">{p.category}</Badge>}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-3 flex-wrap">
                          <span className={toneClass[due.tone]}>{due.text}</span>
                          {account && <span className="text-muted-foreground">· {account.name}</span>}
                          {p.adjustmentAmount != null && p.adjustmentDueDate && (
                            <span className="text-muted-foreground">
                              · ajust. {p.adjustmentAmount >= 0 ? "+" : ""}{formatCHF(p.adjustmentAmount, p.currency)}
                            </span>
                          )}
                        </div>
                        {p.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.notes}</div>}
                      </button>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "font-display text-lg font-semibold tabular-nums",
                          isIn ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                        )}>
                          {isIn ? "+" : ""}{formatCHF(p.amount, p.currency)}
                        </div>
                        <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition justify-end">
                          {p.status === "paid" ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title={isIn ? "Remettre en attente" : "Remettre à payer"} onClick={() => markUnpaid(p)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700 dark:text-emerald-400" title={isIn ? "Marquer reçu" : "Marquer payé"} onClick={() => markPaid(p)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Éditer" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Supprimer" onClick={() => setDeletingId(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editing ? "Modifier" : "Nouveau"} {form.direction === "in" ? "encaissement" : "paiement"}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, direction: "out" }))}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                  form.direction === "out"
                    ? "border-red-500/60 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowDownRight className="h-4 w-4" /> Sortie
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, direction: "in" }))}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                  form.direction === "in"
                    ? "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowUpRight className="h-4 w-4" /> Entrée
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, commitment: "committed" }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                    form.commitment === "committed"
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lock className="h-4 w-4" /> Obligatoire
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, commitment: "forecast" }))}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                    form.commitment === "forecast"
                      ? "border-amber-500/60 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CircleDashed className="h-4 w-4" /> Prévision
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Libellé</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={form.direction === "in" ? "ex. Salaire, paiement client X…" : "ex. Loyer juin, SIG, impôts…"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Montant</label>
                <Input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Devise</label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={4} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{form.direction === "in" ? "Date attendue" : "Échéance"}</label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Statut</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PayableStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYABLE_STATUS_LABELS) as PayableStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{PAYABLE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Compte source</label>
              <Select value={form.accountId || "__none__"} onValueChange={v => setForm(f => ({ ...f, accountId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {accounts.filter(a => !a.isArchived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.type === "perso" ? "perso" : "entreprise"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Catégorie</label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Logement, Assurance, SARL…" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Récurrence</label>
                <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v as PayableRecurrence }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYABLE_RECURRENCE_LABELS) as PayableRecurrence[]).map(r => (
                      <SelectItem key={r} value={r}>{PAYABLE_RECURRENCE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.recurrence !== "none" && form.recurrence !== "weekly" && (
                <div>
                  <label className="text-xs text-muted-foreground">Jour du mois</label>
                  <Input type="number" min={1} max={31} value={form.recurrenceDay} onChange={e => setForm(f => ({ ...f, recurrenceDay: e.target.value }))} placeholder="1-31" />
                </div>
              )}
              {form.recurrence !== "none" && (
                <div>
                  <label className="text-xs text-muted-foreground">Fin (optionnel)</label>
                  <Input type="date" value={form.recurrenceEnd} onChange={e => setForm(f => ({ ...f, recurrenceEnd: e.target.value }))} />
                </div>
              )}
            </div>
            {form.recurrence !== "none" && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-border p-3">
                <div className="col-span-2 -mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ajustement (optionnel)</span>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    Correction ponctuelle sur la récurrence (ex. impôts rattrapage de fin d'année).
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Montant ± (CHF)</label>
                  <Input type="text" inputMode="decimal" value={form.adjustmentAmount} onChange={e => setForm(f => ({ ...f, adjustmentAmount: e.target.value }))} placeholder="ex. +200 ou -150" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input type="date" value={form.adjustmentDueDate} onChange={e => setForm(f => ({ ...f, adjustmentDueDate: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {form.recurrence !== "none" && (
              <p className="text-xs text-muted-foreground italic">
                Quand tu marqueras cette ligne comme {form.direction === "in" ? "reçue" : "payée"}, la prochaine occurrence sera créée automatiquement.
              </p>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce payable ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible. N'affecte pas les soldes des comptes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
