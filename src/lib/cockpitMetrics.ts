import { type Quote, totalQuote } from "@/types/quote";

export interface MonthPoint {
  /** YYYY-MM bucket key. */
  key: string;
  /** Short French month label for the axis. */
  label: string;
  ca: number;
}

export interface ClientCA {
  client: string;
  ca: number;
}

export interface CockpitMetrics {
  /** Paid revenue for the current calendar year (money in). */
  caYtd: number;
  /** Validated invoices, billed and awaiting payment (créances). */
  receivables: number;
  /** Validated devis, accepted but not yet invoiced (à facturer). */
  toBill: number;
  /** To-validate documents (potential revenue / pipeline). */
  pipeline: number;
  /** Validated invoices past their validity date. */
  overdueCount: number;
  invoiceCount: number;
  quoteCount: number;
  /** Rough devis→facture conversion (invoices / non-template devis). */
  conversionPct: number;
  avgInvoice: number;
  /** Rolling 12-month paid-CA series, oldest first, ending on `now`'s month. */
  monthly: MonthPoint[];
  /** Top 5 clients by paid CA, descending. */
  topClients: ClientCA[];
}

const MONTH_LABELS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "aoû", "sep", "oct", "nov", "déc"];

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Derive the dirigeant-cockpit metrics from the quote/invoice cache. Pure:
 * `now` is injected so the rolling window and YTD are deterministic/testable.
 * CA is keyed off invoice `createdAt` (no separate paid-date is stored) — same
 * proxy the Accounting monthly chart already uses.
 */
export function computeCockpitMetrics(quotes: Quote[], now: Date): CockpitMetrics {
  // invoice_status is the money-state regardless of doc type. A *validated
  // invoice* is a billed créance (à recevoir); a *validated devis* is accepted
  // but not yet billed (à facturer) — the same split the rest of the app uses.
  // Templates never represent real money, so exclude them throughout.
  const active = quotes.filter((q) => !q.isTemplate);
  const isInvoice = (q: Quote) => q.docType === "invoice";
  const paid = active.filter((q) => q.invoiceStatus === "paid");
  const year = now.getFullYear();

  const caYtd = paid
    .filter((q) => new Date(q.createdAt).getFullYear() === year)
    .reduce((s, q) => s + totalQuote(q), 0);

  const receivables = active
    .filter((q) => isInvoice(q) && q.invoiceStatus === "validated")
    .reduce((s, q) => s + totalQuote(q), 0);

  const toBill = active
    .filter((q) => !isInvoice(q) && q.invoiceStatus === "validated")
    .reduce((s, q) => s + totalQuote(q), 0);

  const pipeline = active
    .filter((q) => q.invoiceStatus === "to-validate")
    .reduce((s, q) => s + totalQuote(q), 0);

  const overdueCount = active.filter((q) => {
    if (!isInvoice(q) || q.invoiceStatus !== "validated" || !q.validityDate) return false;
    return new Date(q.validityDate).getTime() < now.getTime();
  }).length;

  const invoiceCount = active.filter(isInvoice).length;
  const quoteCount = active.filter((q) => !isInvoice(q)).length;
  const conversionPct = quoteCount > 0 ? Math.round((invoiceCount / quoteCount) * 100) : 0;
  const paidTotal = paid.reduce((s, q) => s + totalQuote(q), 0);
  const avgInvoice = invoiceCount > 0 ? Math.round(paidTotal / invoiceCount) : 0;

  // Rolling 12-month window ending on the current month.
  const monthly: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(year, now.getMonth() - i, 1);
    monthly.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()], ca: 0 });
  }
  const idx = new Map(monthly.map((m, i) => [m.key, i]));
  for (const q of paid) {
    const i = idx.get(monthKey(new Date(q.createdAt)));
    if (i !== undefined) monthly[i].ca += totalQuote(q);
  }

  const byClient = new Map<string, number>();
  for (const q of paid) {
    const name = q.clientName?.trim() || "—";
    byClient.set(name, (byClient.get(name) ?? 0) + totalQuote(q));
  }
  const topClients = [...byClient.entries()]
    .map(([client, ca]) => ({ client, ca }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 5);

  return { caYtd, receivables, toBill, pipeline, overdueCount, invoiceCount, quoteCount, conversionPct, avgInvoice, monthly, topClients };
}
