import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Gauge, TrendingUp, Receipt, Clock, AlertTriangle, Percent, Users, ArrowRight } from "lucide-react";
import { useQuotes } from "@/hooks/useQuotes";
import { computeCockpitMetrics } from "@/lib/cockpitMetrics";
import { formatCHF } from "@/components/kojimaSpace/helpers";
import { cn } from "@/lib/utils";

function KpiCard({ icon, label, value, hint, tone = "default", to }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
  to?: string;
}) {
  const inner = (
    <div className={cn(
      "bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 h-full transition-colors",
      to && "hover:border-primary/40",
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-body font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        "text-2xl font-display font-bold tabular-nums leading-tight",
        tone === "warn" ? "text-destructive" : "text-foreground",
      )}>
        {value}
      </div>
      {hint && <div className="text-[11px] font-body text-muted-foreground/70">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

export default function Cockpit() {
  const { quotes } = useQuotes();
  const m = useMemo(() => computeCockpitMetrics(quotes, new Date()), [quotes]);
  const topMax = m.topClients[0]?.ca ?? 0;
  const caTotal = m.topClients.reduce((s, c) => s + c.ca, 0);
  const noData = m.monthly.every((p) => p.ca === 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Gauge size={22} className="text-accent" />
            <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary-foreground/60">
              Pilotage
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">Tableau de bord</h1>
          <p className="font-body text-primary-foreground/65 mt-1 text-sm">La santé du business en un coup d'œil.</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-8 space-y-6">
        {/* Vital signs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard icon={<TrendingUp size={14} className="text-palette-sage" />} label="CA encaissé (année)" value={formatCHF(m.caYtd)} to="/accounting" />
          <KpiCard icon={<Receipt size={14} className="text-primary" />} label="À recevoir" value={formatCHF(m.receivables)} hint="Validé — encaissement à venir" to="/accounting" />
          <KpiCard icon={<Clock size={14} className="text-palette-amber" />} label="Pipeline" value={formatCHF(m.pipeline)} hint="Revenu potentiel (à valider)" to="/accounting" />
          <KpiCard icon={<AlertTriangle size={14} className="text-destructive" />} label="Factures en retard" value={String(m.overdueCount)} tone={m.overdueCount > 0 ? "warn" : "default"} to="/quotes" />
          <KpiCard icon={<Percent size={14} className="text-accent" />} label="Conversion devis→facture" value={`${m.conversionPct}%`} hint={`${m.invoiceCount} fact. / ${m.quoteCount} devis`} />
          <KpiCard icon={<Receipt size={14} className="text-muted-foreground" />} label="Facture moyenne" value={formatCHF(m.avgInvoice)} />
        </div>

        {/* CA mensuel */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">CA encaissé — 12 derniers mois</h2>
          </div>
          {noData ? (
            <p className="text-sm text-muted-foreground font-body py-8 text-center">
              Pas encore de factures payées sur la période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={m.monthly} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: "hsl(215 45% 30%)", opacity: 0.08 }}
                  formatter={(v: number) => [formatCHF(v), "CA"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(35 12% 80%)", fontSize: 12 }}
                />
                <Bar dataKey="ca" className="fill-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top clients */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-primary" />
            <h2 className="font-display text-sm font-bold text-foreground">Top clients (CA encaissé)</h2>
          </div>
          {m.topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body py-6 text-center">Aucune facture payée pour l'instant.</p>
          ) : (
            <ul className="space-y-2.5">
              {m.topClients.map((c) => (
                <li key={c.client} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="text-foreground truncate">{c.client}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {formatCHF(c.ca)}
                      {caTotal > 0 && <span className="text-muted-foreground/50"> · {Math.round((c.ca / caTotal) * 100)}%</span>}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${topMax > 0 ? (c.ca / topMax) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Shortcuts */}
        <div className="flex flex-wrap gap-2">
          {[
            { to: "/accounting", label: "Comptabilité & rentabilité" },
            { to: "/tresorerie", label: "Trésorerie & échéances" },
            { to: "/quotes", label: "Devis & factures" },
          ].map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="inline-flex items-center gap-1.5 text-xs font-body font-medium px-3 py-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              {s.label} <ArrowRight size={12} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
