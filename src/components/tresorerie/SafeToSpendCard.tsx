import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { listAccounts } from "@/api/accounts";
import { listPayables } from "@/api/payables";
import { listExpenses } from "@/api/expenses";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote, tvaAmountQuote } from "@/types/quote";
import { computeSetAside, readTaxProvisionRate } from "@/lib/safeToSpend";

const SOON_DAYS = 30;

function chf(n: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const t = new Date(date + "T00:00:00").getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((t - today) / 86_400_000);
}

/**
 * "Disponible maintenant" — the one honest number for a solo SARL: the
 * entreprise cash actually free to spend = Σ entreprise balances − committed
 * outflows due soon − money to keep aside (TVA due + tax provision). Conservative
 * by design: expected inflows are NOT counted (you don't have them yet), and
 * only "obligatoire" (committed) outflows are deducted. Reflects balances as of
 * the last statement sync.
 */
export function SafeToSpendCard() {
  const year = new Date().getFullYear();
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ["accounts"], queryFn: () => listAccounts(), staleTime: 60_000 });
  const { data: payables = [] } = useQuery({ queryKey: ["payables"], queryFn: () => listPayables(), staleTime: 60_000 });
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses", year], queryFn: () => listExpenses(year), staleTime: 60_000 });
  const { quotes } = useQuotes();
  const rate = readTaxProvisionRate();

  const m = useMemo(() => {
    const entreprise = accounts.filter((a) => a.type === "entreprise" && !a.isArchived);
    const balance = entreprise.reduce((s, a) => s + (a.balance || 0), 0);
    const persoIds = new Set(accounts.filter((a) => a.type === "perso").map((a) => a.id));

    // Committed outflows due within 30 days (overdue included), excluding any
    // tied to a personal account so they line up with the entreprise balance.
    const outflowsSoon = payables
      .filter((p) => p.direction === "out" && p.commitment === "committed" && (p.status === "pending" || p.status === "scheduled"))
      .filter((p) => !(p.accountId && persoIds.has(p.accountId)))
      .filter((p) => { const d = daysUntil(p.dueDate); return d !== null && d <= SOON_DAYS; })
      .reduce((s, p) => s + p.amount, 0);

    // Set-aside from this year's paid invoices (real TVA) + expenses.
    const paid = quotes.filter((q) => q.invoiceStatus === "paid" && new Date(q.createdAt).getFullYear() === year);
    const revenueTTC = paid.reduce((s, q) => s + totalQuote(q), 0);
    const tvaCollected = paid.reduce((s, q) => s + tvaAmountQuote(q), 0);
    const expensesTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const setAside = computeSetAside({ revenueTTC, tvaCollected, expenses: expensesTotal, rate });

    return {
      hasEntreprise: entreprise.length > 0,
      balance,
      outflowsSoon,
      setAside,
      disponible: balance - outflowsSoon - setAside.total,
    };
  }, [accounts, payables, expenses, quotes, rate, year]);

  if (isLoading) return null;

  if (!m.hasEntreprise) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-card p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-sm">Marque un compte comme « entreprise » pour suivre ton disponible.</span>
        </div>
      </div>
    );
  }

  const negative = m.disponible < 0;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-eyebrow">Disponible maintenant</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ce que l'entreprise peut dépenser sans toucher aux provisions.
          </p>
        </div>
        <div className="text-right">
          <div className={cn(
            "font-display text-3xl font-semibold tabular-nums leading-none",
            negative ? "text-destructive" : "text-palette-sage",
          )}>
            {chf(m.disponible)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Cell label="Solde entreprise" value={chf(m.balance)} />
        <Cell label="− Engagé sous 30j" value={chf(m.outflowsSoon)} />
        <Cell label="− À provisionner" value={chf(m.setAside.total)} tone={m.setAside.total > 0 ? "amber" : undefined} />
      </div>

      <p className="text-[11px] text-muted-foreground flex gap-2">
        <Info size={13} className="shrink-0 mt-0.5 text-primary" />
        <span>
          Provisions = TVA à reverser ({chf(m.setAside.tvaToRemit)}) + impôts ({rate}% du bénéfice, ajustable dans Finance).
          Reflète le solde du dernier relevé ; les rentrées attendues ne sont pas comptées.
        </span>
      </p>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn(
        "font-display text-sm sm:text-base font-semibold tabular-nums",
        tone === "amber" ? "text-palette-amber" : "text-foreground",
      )}>
        {value}
      </div>
    </div>
  );
}
