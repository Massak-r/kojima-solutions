import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownRight, ArrowUpRight, Loader2, History, Receipt, FileText, CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listExpenses } from "@/api/expenses";
import { listPayables } from "@/api/payables";
import { listAccounts } from "@/api/accounts";
import { listQuotes } from "@/api/quotes";
import type { ExpenseItem } from "@/api/expenses";
import type { Payable } from "@/types/payable";
import type { Account } from "@/types/account";
import type { Quote } from "@/types/quote";

function formatCHF(n: number, currency = "CHF") {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  try {
    const formatted = new Intl.NumberFormat("fr-CH", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Math.abs(n)).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
    return `${sign}${formatted}`;
  } catch {
    return `${sign}${Math.abs(n).toFixed(2)} ${currency}`;
  }
}

type Source = "expense" | "payable" | "invoice";

interface LedgerEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  label: string;
  amount: number;        // signed: + income, - outflow
  currency: string;
  accountId?: string | null;
  category?: string | null;
  source: Source;
  sourceId: string;
}

function quoteTotal(q: Quote): number {
  const subtotal = (q.lineItems ?? []).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  let total = subtotal;
  if (q.discountEnabled) {
    if (q.discountType === "percent") total -= subtotal * (q.discountValue ?? 0) / 100;
    else total -= q.discountValue ?? 0;
  }
  if (q.applyTva) total *= 1.081;
  return Math.max(0, total);
}

const SOURCE_LABELS: Record<Source, string> = {
  expense: "Dépense",
  payable: "Payable",
  invoice: "Facture",
};

const SOURCE_ICONS: Record<Source, React.ComponentType<{ className?: string }>> = {
  expense: Receipt,
  payable: CalendarClock,
  invoice: FileText,
};

export function LedgerView() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | Source>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate]     = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([listExpenses(), listPayables({ status: "paid" }), listAccounts({ includeArchived: true }), listQuotes()])
      .then(([exps, pays, accs, qs]) => {
        const expenseEntries: LedgerEntry[] = (exps as ExpenseItem[]).map(e => ({
          id: `e-${e.id}`,
          date: e.date,
          label: e.description || "Dépense",
          amount: -Math.abs(e.amount),
          currency: "CHF",
          accountId: e.accountId ?? null,
          category: e.category ?? null,
          source: "expense",
          sourceId: e.id,
        }));
        const payableEntries: LedgerEntry[] = (pays as Payable[]).map(p => ({
          id: `p-${p.id}`,
          date: (p.paidAt ? p.paidAt.slice(0, 10) : p.dueDate) || new Date().toISOString().slice(0, 10),
          label: p.label,
          // direction='in' = received income (positive). 'out' = expense (negative).
          amount: p.direction === "in" ? Math.abs(p.amount) : -Math.abs(p.amount),
          currency: p.currency,
          accountId: p.accountId ?? null,
          category: p.category ?? null,
          source: "payable",
          sourceId: p.id,
        }));
        const invoiceEntries: LedgerEntry[] = (qs as Quote[])
          .filter(q => q.docType === "invoice" && q.invoiceStatus === "paid")
          .map(q => ({
            id: `i-${q.id}`,
            date: (q.validityDate || q.createdAt || new Date().toISOString()).slice(0, 10),
            label: `${q.quoteNumber || "Facture"} — ${q.clientName || q.projectTitle || ""}`.trim(),
            amount: quoteTotal(q),
            currency: "CHF",
            accountId: null,
            category: "Revenu",
            source: "invoice",
            sourceId: q.id,
          }));
        const all = [...expenseEntries, ...payableEntries, ...invoiceEntries]
          .sort((a, b) => b.date.localeCompare(a.date));
        setEntries(all);
        setAccounts(accs);
      })
      .catch(() => toast({ title: "Erreur", description: "Impossible de charger l'historique", variant: "destructive" }))
      .finally(() => setLoading(false));
  /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (accountFilter === "none" && e.accountId) return false;
      if (accountFilter !== "all" && accountFilter !== "none" && e.accountId !== accountFilter) return false;
      if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
      if (fromDate && e.date < fromDate) return false;
      if (toDate && e.date > toDate) return false;
      return true;
    });
  }, [entries, accountFilter, sourceFilter, fromDate, toDate]);

  const totals = useMemo(() => {
    let income = 0, outflow = 0;
    for (const e of filtered) {
      if (e.amount >= 0) income += e.amount; else outflow += e.amount;
    }
    return { income, outflow, net: income + outflow };
  }, [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 7); // YYYY-MM
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement de l'historique…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Historique
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dépenses, payables et factures encaissées sur une timeline unifiée.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border p-3 bg-muted/30">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Entrées</div>
          <div className="font-display text-xl font-semibold tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
            {formatCHF(totals.income)}
          </div>
        </div>
        <div className="rounded-xl border p-3 bg-muted/30">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Sorties</div>
          <div className="font-display text-xl font-semibold tabular-nums mt-1 text-red-700 dark:text-red-400">
            {formatCHF(totals.outflow)}
          </div>
        </div>
        <div className="rounded-xl border p-3 bg-muted/30">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Net</div>
          <div className={`font-display text-xl font-semibold tabular-nums mt-1 ${totals.net < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {formatCHF(totals.net)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Compte</label>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="none">Sans compte</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Source</label>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="expense">Dépenses</SelectItem>
              <SelectItem value="payable">Payables</SelectItem>
              <SelectItem value="invoice">Factures</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Depuis</label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Jusqu'à</label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-sm text-muted-foreground italic border rounded-lg px-4 py-10 text-center">
          Rien à afficher avec ces filtres.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, items]) => {
            const monthlyNet = items.reduce((s, e) => s + e.amount, 0);
            const label = new Date(month + "-01T00:00:00").toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
            return (
              <section key={month} className="space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground">{label}</h3>
                  <div className={`text-sm tabular-nums font-medium ${monthlyNet < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {formatCHF(monthlyNet)}
                  </div>
                </div>
                <ul className="space-y-1">
                  {items.map(e => {
                    const Icon = SOURCE_ICONS[e.source];
                    const account = e.accountId ? accountById.get(e.accountId) : null;
                    return (
                      <li key={e.id} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/40 transition">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{e.label}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{new Date(e.date + "T00:00:00").toLocaleDateString("fr-CH", { day: "2-digit", month: "short" })}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{SOURCE_LABELS[e.source]}</Badge>
                            {e.category && <span>· {e.category}</span>}
                            {account && <span>· {account.name}</span>}
                          </div>
                        </div>
                        <div className={`text-sm font-medium tabular-nums shrink-0 flex items-center gap-1 ${e.amount < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                          {e.amount < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          {formatCHF(e.amount, e.currency)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
