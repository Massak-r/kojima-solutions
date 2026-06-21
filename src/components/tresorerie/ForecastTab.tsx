import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine, Area,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { listAccounts } from "@/api/accounts";
import { listPayables } from "@/api/payables";
import { listCosts } from "@/api/personalCosts";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { computeCashflowForecast, type ForecastReceivable } from "@/lib/forecast";

const HORIZON = 6;

function formatCHF(n: number, compact = false): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF", maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(n).replace(/(?<=\d)\s(?=\d)/g, "'");
}

/** Trésorerie prévisionnelle — feeds the tested computeCashflowForecast engine
 *  with the canonical money spine (Σ account balances + payables with recurrence
 *  projected forward + validated invoices to collect). */
export function ForecastTab() {
  const { quotes } = useQuotes();
  const { data: accounts, isLoading: loadingA } = useQuery({ queryKey: ["accounts"], queryFn: () => listAccounts(), staleTime: 60_000 });
  const { data: payables, isLoading: loadingP } = useQuery({ queryKey: ["payables"], queryFn: () => listPayables(), staleTime: 60_000 });
  const { data: costs } = useQuery({ queryKey: ["personal-costs"], queryFn: () => listCosts(), staleTime: 60_000 });

  // listAccounts() already excludes archived accounts server-side.
  const openingBalance = useMemo(
    () => (accounts ?? []).reduce((s, a) => s + (a.balance || 0), 0),
    [accounts],
  );

  const receivables: ForecastReceivable[] = useMemo(
    () => quotes
      .filter((q) => q.docType === "invoice" && q.invoiceStatus === "validated")
      .map((q) => ({ amount: totalQuote(q), expectedDate: (q.validityDate || q.createdAt || "").slice(0, 10) }))
      .filter((r) => r.amount > 0 && r.expectedDate),
    [quotes],
  );

  const forecast = useMemo(
    () => computeCashflowForecast({
      openingBalance,
      payables: payables ?? [],
      recurringCosts: costs ?? [],
      receivables,
      horizonMonths: HORIZON,
      now: new Date(),
    }),
    [openingBalance, payables, costs, receivables],
  );

  const loading = loadingA || loadingP;
  const last = forecast.months[forecast.months.length - 1];
  const endBalance = last?.endBalance ?? openingBalance;
  const totalReceivable = receivables.reduce((s, r) => s + r.amount, 0);
  const firstNeg = forecast.months.find((m) => m.endBalance < 0);

  const runway = forecast.runwayMonths;
  const positive = runway === null;
  const tone = positive ? "growing"
    : runway <= 3 ? "danger"
    : runway <= 6 ? "warn"
    : "ok";
  const tonePill =
    tone === "danger" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40"
    : tone === "warn" ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40"
    : tone === "growing" ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40"
    : "bg-primary/10 text-primary border-primary/30";

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
            Prévisionnel sur {HORIZON} mois
          </h2>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-body font-semibold border", tonePill)}>
          {positive ? <TrendingUp size={11} /> : tone === "danger" ? <AlertTriangle size={11} /> : <TrendingDown size={11} />}
          {positive ? "Cashflow positif" : `Runway : ${runway} mois`}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Solde actuel" value={formatCHF(openingBalance)} hint="Σ comptes" />
            <Stat
              label="Net moyen / mois"
              value={(forecast.avgNet >= 0 ? "+" : "") + formatCHF(Math.round(forecast.avgNet))}
              valueClass={forecast.avgNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}
            />
            <Stat
              label={`Dans ${HORIZON} mois`}
              value={formatCHF(endBalance)}
              valueClass={endBalance < 0 ? "text-destructive" : endBalance < openingBalance ? "text-amber-700 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-400"}
            />
            <Stat label="À encaisser" value={formatCHF(totalReceivable)} hint="factures validées" />
          </div>

          {firstNeg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Solde projeté négatif dès <strong>{firstNeg.label}</strong> ({formatCHF(firstNeg.endBalance)}). Encaisse une facture ou décale une sortie.</span>
            </div>
          )}

          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast.months} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="forecast-tab-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCHF(v, true)} tick={{ fontSize: 10 }} width={64} />
                <ReTooltip
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number, key: string) => {
                    const map: Record<string, string> = { endBalance: "Solde", inflow: "Rentrées", outflow: "Sorties", net: "Net" };
                    return [formatCHF(value), map[key] ?? key];
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Area
                  type="monotone" dataKey="endBalance" stroke="hsl(var(--primary))" strokeWidth={2.5}
                  fill="url(#forecast-tab-fill)" fillOpacity={1} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body min-w-[440px]">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50">
                  <th className="text-left py-1.5 font-medium">Mois</th>
                  <th className="text-right py-1.5 font-medium">Rentrées</th>
                  <th className="text-right py-1.5 font-medium">Sorties</th>
                  <th className="text-right py-1.5 font-medium">Net</th>
                  <th className="text-right py-1.5 font-medium">Solde projeté</th>
                </tr>
              </thead>
              <tbody>
                {forecast.months.map((m) => (
                  <tr key={m.month} className="border-b border-border/20">
                    <td className="py-1.5">{m.label}</td>
                    <td className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{m.inflow ? formatCHF(m.inflow) : "·"}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{m.outflow ? "-" + formatCHF(m.outflow) : "·"}</td>
                    <td className={cn("text-right tabular-nums", m.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{m.net >= 0 ? "+" : ""}{formatCHF(m.net)}</td>
                    <td className={cn("text-right tabular-nums font-semibold", m.endBalance < 0 ? "text-destructive" : "")}>{formatCHF(m.endBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground/80 font-body leading-relaxed">
            Basé sur Σ comptes + payables (entrées/sorties, récurrences projetées) + charges récurrentes (budget) + factures validées à encaisser. Les devis non validés ne comptent pas. ⚠️ Si une charge est à la fois en payable récurrent et en budget, elle compte deux fois, garde-la à un seul endroit.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, valueClass }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body block mb-1">{label}</span>
      <p className={cn("text-lg font-bold tabular-nums", valueClass)}>{value}</p>
      {hint && <span className="text-[9px] text-muted-foreground/60 font-body">{hint}</span>}
    </div>
  );
}
