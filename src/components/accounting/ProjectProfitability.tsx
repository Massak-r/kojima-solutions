import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2, TrendingUp, TrendingDown, AlertTriangle, Clock, Info, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { formatCHF } from "@/components/accounting/utils";
import {
  listProjectProfitability, type ProjectProfitabilityRow,
} from "@/api/projectProfitability";

// Quote strings are free-text ("5'000", "CHF 4500.-", "4 500,00"). Strip Swiss
// thousands separators/whitespace, normalise the decimal mark, then parse.
function parseAmount(raw?: string | null): number {
  if (!raw) return 0;
  let s = String(raw).replace(/['\s  ]/g, "").replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function fmtHours(h: number): string {
  return `${h.toFixed(h < 10 ? 1 : 0)} h`;
}

interface Row extends ProjectProfitabilityRow {
  quote: number;
  rate: number;
  laborValue: number;
  directCosts: number;
  hasQuote: boolean;
  margin: number | null;
  marginPct: number | null;
  burnPct: number | null;
}

function burnColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct > 85)  return "bg-amber-500";
  if (pct > 70)  return "bg-amber-400";
  return "bg-emerald-500";
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", "in-progress": "En cours", completed: "Terminé", "on-hold": "En pause",
};

export function ProjectProfitability() {
  const { settings } = useCompanySettings();
  const [data, setData] = useState<ProjectProfitabilityRow[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"client" | "all">("client");

  function load() {
    setLoading(true);
    setError(false);
    listProjectProfitability()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const rate0 = settings.defaultHourlyRate || 0;
    return data
      .filter(r => scope === "all" ? true : r.kind === "client")
      .map(r => {
        const quote = parseAmount(r.revisedQuote) || parseAmount(r.initialQuote);
        const rate = r.clientRate ?? rate0;
        const laborValue = r.trackedHours * rate;
        const directCosts = r.allocatedCosts || 0;
        const cost = laborValue + directCosts;
        const hasQuote = quote > 0;
        const margin = hasQuote ? quote - cost : null;
        const marginPct = hasQuote && quote > 0 ? (margin! / quote) * 100 : null;
        const burnPct = hasQuote && quote > 0 ? (cost / quote) * 100 : null;
        return { ...r, quote, rate, laborValue, directCosts, hasQuote, margin, marginPct, burnPct };
      })
      // Worst margin first so problem projects surface; quoted before unquoted.
      .sort((a, b) => {
        if (a.hasQuote !== b.hasQuote) return a.hasQuote ? -1 : 1;
        if (a.hasQuote && b.hasQuote) return (a.marginPct ?? 0) - (b.marginPct ?? 0);
        return b.trackedHours - a.trackedHours;
      });
  }, [data, scope, settings.defaultHourlyRate]);

  // Totals over quoted projects in scope.
  const totals = useMemo(() => {
    const quoted = rows.filter(r => r.hasQuote);
    const quote = quoted.reduce((s, r) => s + r.quote, 0);
    const labor = quoted.reduce((s, r) => s + r.laborValue, 0);
    const costs = quoted.reduce((s, r) => s + r.directCosts, 0);
    const margin = quote - labor - costs;
    const underwater = quoted.filter(r => (r.margin ?? 0) < 0).length;
    return { quote, labor, costs, margin, marginPct: quote > 0 ? (margin / quote) * 100 : 0, underwater, count: quoted.length };
  }, [rows]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground font-body">Impossible de charger la rentabilité.</p>
        <button onClick={load} className="text-xs font-body text-primary hover:underline inline-flex items-center gap-1">
          <RefreshCw size={12} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Model note */}
      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs font-body text-muted-foreground flex gap-2">
        <Info size={14} className="shrink-0 mt-0.5 text-primary" />
        <span>
          Coût = heures suivies × taux ({formatCHF(settings.defaultHourlyRate)}/h par défaut, ou le taux du client) + coûts directs alloués (payables liés au projet).
          Marge nette = devis − coût total. Alloue un paiement à un projet dans Trésorerie → À payer.
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Devis (signés)", value: formatCHF(totals.quote), sub: `${totals.count} projet${totals.count !== 1 ? "s" : ""}`, cls: "" },
          { label: "Coût (temps)", value: formatCHF(totals.labor), sub: "heures × taux", cls: "" },
          { label: "Coûts directs", value: formatCHF(totals.costs), sub: "payables alloués", cls: totals.costs > 0 ? "text-amber-600" : "" },
          {
            label: "Marge nette",
            value: formatCHF(totals.margin),
            sub: `${totals.marginPct >= 0 ? "+" : ""}${totals.marginPct.toFixed(0)}%`,
            cls: totals.margin >= 0 ? "text-emerald-600" : "text-destructive",
          },
        ].map(c => (
          <div key={c.label} className="glass-card rounded-xl p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-1">{c.label}</p>
            <p className={cn("text-base sm:text-lg font-bold font-body tabular-nums", c.cls)}>{c.value}</p>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Scope + underwater hint */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Périmètre</span>
          {(["client", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition",
                scope === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "client" ? "Clients" : "Tous"}
            </button>
          ))}
        </div>
        {totals.underwater > 0 && (
          <span className="text-xs font-body text-destructive flex items-center gap-1">
            <AlertTriangle size={12} /> {totals.underwater} sous l'eau
          </span>
        )}
      </div>

      {/* Project rows */}
      {rows.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground font-body">
          Aucun projet à afficher.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const overEstimate = r.estimatedHours != null && r.estimatedHours > 0 && r.trackedHours > r.estimatedHours;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={cn(
                  "glass-card rounded-xl p-4",
                  r.margin != null && r.margin < 0 && "ring-1 ring-destructive/30"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-body font-semibold text-sm truncate">{r.title}</span>
                      {r.status && (
                        <span className="text-[10px] px-1.5 py-0 rounded-full border border-border text-muted-foreground font-body">
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      )}
                      {scope === "all" && r.kind !== "client" && (
                        <span className="text-[10px] px-1.5 py-0 rounded-full border border-sky-300/50 text-sky-600 dark:text-sky-400 font-body">
                          {r.kind === "internal" ? "Interne" : "Perso"}
                        </span>
                      )}
                    </div>
                    {r.client && <span className="text-[11px] text-muted-foreground font-body">{r.client}</span>}
                  </div>
                  <div className="text-right shrink-0">
                    {r.hasQuote ? (
                      <>
                        <div className={cn("font-display text-lg font-semibold tabular-nums", (r.margin ?? 0) >= 0 ? "text-emerald-600" : "text-destructive")}>
                          {(r.margin ?? 0) >= 0 ? "+" : ""}{formatCHF(r.margin ?? 0)}
                        </div>
                        <div className={cn("text-[11px] font-body tabular-nums flex items-center justify-end gap-0.5", (r.marginPct ?? 0) >= 0 ? "text-emerald-600" : "text-destructive")}>
                          {(r.marginPct ?? 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {(r.marginPct ?? 0) >= 0 ? "+" : ""}{(r.marginPct ?? 0).toFixed(0)}%
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-muted-foreground font-body">Sans devis</div>
                    )}
                  </div>
                </div>

                {/* Burn bar (quoted projects) */}
                {r.hasQuote && (
                  <div className="mb-2">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", burnColor(r.burnPct ?? 0))}
                        style={{ width: `${Math.min(100, r.burnPct ?? 0)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Figures */}
                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-body text-muted-foreground tabular-nums">
                  {r.hasQuote && <span>Devis <strong className="text-foreground">{formatCHF(r.quote)}</strong></span>}
                  <span className="inline-flex items-center gap-1">
                    <Clock size={11} />
                    <span className={cn(overEstimate && "text-amber-600 font-medium")}>{fmtHours(r.trackedHours)}</span>
                    {r.estimatedHours != null && r.estimatedHours > 0 && (
                      <span className="opacity-70">/ {fmtHours(r.estimatedHours)} est.</span>
                    )}
                  </span>
                  <span>Main d'œuvre <strong className="text-foreground">{formatCHF(r.laborValue)}</strong></span>
                  {r.directCosts > 0 && (
                    <span>Achats <strong className="text-foreground">{formatCHF(r.directCosts)}</strong></span>
                  )}
                  <span className="opacity-70">{formatCHF(r.rate)}/h</span>
                  {r.hasQuote && (
                    <span className="opacity-70">{(r.burnPct ?? 0).toFixed(0)}% consommé</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
