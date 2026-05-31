import { useMemo } from "react";
import { TrendingUp, FileText, Receipt, CheckCircle2, Clock } from "lucide-react";
import { totalQuote, type Quote } from "@/types/quote";

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

/**
 * Devis → Factures → Payées funnel. Read-only over the quotes cache. Conversion
 * is a proxy (factures émises / devis émis) since devis don't carry an explicit
 * accepted/declined outcome — labelled "transf." to stay honest.
 */
export function QuoteStatsPanel({ quotes }: { quotes: Quote[] }) {
  const s = useMemo(() => {
    const real = quotes.filter((q) => !q.isTemplate);
    const devis = real.filter((q) => (q.docType ?? "quote") === "quote");
    const invoices = real.filter((q) => q.docType === "invoice");
    const paid = invoices.filter((q) => q.invoiceStatus === "paid");
    const outstanding = invoices.filter((q) => q.invoiceStatus === "validated" || q.invoiceStatus === "to-validate");
    const sum = (a: Quote[]) => a.reduce((t, q) => t + totalQuote(q), 0);
    return {
      devisN: devis.length,
      invN: invoices.length,
      paidN: paid.length,
      paidValue: sum(paid),
      outstandingValue: sum(outstanding),
      avgInv: invoices.length ? sum(invoices) / invoices.length : 0,
      conv: devis.length ? Math.round((invoices.length / devis.length) * 100) : 0,
      hasReal: real.length > 0,
    };
  }, [quotes]);

  if (!s.hasReal) return null;

  const items = [
    { icon: <FileText size={13} className="text-primary" />, label: "Devis", value: String(s.devisN) },
    { icon: <Receipt size={13} className="text-accent" />, label: "Factures", value: String(s.invN), sub: `transf. ${s.conv}%` },
    { icon: <CheckCircle2 size={13} className="text-emerald-600" />, label: "Encaissé", value: fmt(s.paidValue), sub: `${s.paidN} payée${s.paidN !== 1 ? "s" : ""}` },
    { icon: <Clock size={13} className="text-amber-600" />, label: "En attente", value: fmt(s.outstandingValue) },
    { icon: <TrendingUp size={13} className="text-primary" />, label: "Panier moyen", value: fmt(s.avgInv) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
      {items.map((it) => (
        <div key={it.label} className="glass-card rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            {it.icon}
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">{it.label}</span>
          </div>
          <div className="text-sm font-bold font-body tabular-nums">{it.value}</div>
          {it.sub && <div className="text-[10px] text-muted-foreground font-body">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}
