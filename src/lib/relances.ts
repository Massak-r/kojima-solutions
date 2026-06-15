import { type Quote, totalQuote } from "@/types/quote";

/**
 * Relances — the unified "what needs a nudge today" engine.
 *
 * Four buckets, all *derived* from existing state (no new storage). An item
 * self-heals out of the list the moment the underlying state changes: bill a
 * devis, mark an invoice paid, or open a new thread with a client and it
 * disappears on the next render. Same philosophy as the acompte/solde loop.
 *
 * Pure + `now`-injected so the windows are deterministic and testable.
 * Respects the no-auto-email rule: the engine only tells the operator what
 * needs chasing; sending stays manual.
 */

/** A sent devis with no response for this many days is worth chasing. */
export const AGING_DEVIS_DAYS = 7;
/** A client engaged before but silent this long is worth reconnecting. */
export const COLD_CLIENT_DAYS = 60;

export type RelanceKind = "expired-devis" | "to-invoice" | "overdue-invoice" | "cold-client";
export type RelanceTone = "danger" | "warn" | "info";

export interface RelanceItem {
  kind: RelanceKind;
  /** Quote id or client id, depending on kind. */
  id: string;
  /** Primary label — client/company name. */
  client: string;
  /** Document number (devis/facture buckets only). */
  ref?: string;
  /** CHF at stake: remaining-to-bill for to-invoice, full total for overdue. */
  amount?: number;
  /** Days overdue / days since sent / days of silence — the urgency number. */
  days: number;
  tone: RelanceTone;
  /** Ready-to-render French explanation, e.g. "Échue depuis 31j". */
  reason: string;
  /** Where the row click takes the operator. */
  href: string;
}

export interface RelancesResult {
  /** Sent devis awaiting signature, expired or unanswered ≥ AGING_DEVIS_DAYS. */
  expiredDevis: RelanceItem[];
  /** Validated devis not yet fully invoiced. */
  toInvoice: RelanceItem[];
  /** Validated invoices past their échéance. */
  overdueInvoices: RelanceItem[];
  /** Engaged-then-silent clients with no open thread. */
  coldClients: RelanceItem[];
  /** Money the operator can act to collect now: to-invoice remaining + overdue. */
  atStake: number;
  /** Total actionable items across every bucket. */
  count: number;
}

/** Minimal client shape the engine needs (StoredClient satisfies it). */
export interface RelanceClientLike {
  id: string;
  name: string;
  organization?: string;
  email?: string;
}

/** Minimal project shape the engine needs (StoredProject satisfies it). */
export interface RelanceProjectLike {
  clientId?: string;
  client?: string;
  createdAt?: string;
  status?: string;
}

/**
 * Percentage of a devis already covered by linked acompte/solde invoices.
 * Mirrors the derivation in QuotesList; self-healing on invoice delete.
 */
export function billedPctFor(quoteId: string, quotes: Quote[]): number {
  return quotes
    .filter((q) => q.docType === "invoice" && q.sourceQuoteId === quoteId)
    .reduce((sum, q) => sum + (q.billedPct ?? 0), 0);
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function normalize(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}

export function computeRelances(
  quotes: Quote[],
  clients: RelanceClientLike[],
  projects: RelanceProjectLike[],
  now: Date,
): RelancesResult {
  const active = quotes.filter((q) => !q.isTemplate);
  const hrefFor = (q: Quote) =>
    q.projectId ? `/project/${q.projectId}/documents` : `/quotes/${q.id}`;

  // ── 1. Sent devis to chase for signature (expired or unanswered) ──────────
  const expiredDevis: RelanceItem[] = active
    .filter((q) => q.docType !== "invoice" && q.invoiceStatus === "to-validate")
    .map((q) => {
      const ageDays = daysBetween(now, new Date(q.createdAt));
      const expired = q.validityDate
        ? new Date(q.validityDate).getTime() < now.getTime()
        : false;
      const overdueDays = q.validityDate
        ? daysBetween(now, new Date(q.validityDate))
        : 0;
      return { q, ageDays, expired, overdueDays };
    })
    .filter(({ ageDays, expired }) => expired || ageDays >= AGING_DEVIS_DAYS)
    .map(({ q, ageDays, expired, overdueDays }) => ({
      kind: "expired-devis" as const,
      id: q.id,
      client: q.clientName || q.projectTitle || "—",
      ref: q.quoteNumber,
      amount: totalQuote(q),
      days: expired ? overdueDays : ageDays,
      tone: (expired ? "danger" : "warn") as RelanceTone,
      reason: expired
        ? `Expiré depuis ${overdueDays}j`
        : `Envoyé il y a ${ageDays}j, sans réponse`,
      href: hrefFor(q),
    }))
    .sort((a, b) => b.days - a.days);

  // ── 2. Validated devis still to be invoiced ───────────────────────────────
  const toInvoice: RelanceItem[] = active
    .filter((q) => q.docType !== "invoice" && q.invoiceStatus === "validated")
    .map((q) => ({ q, billed: clamp(billedPctFor(q.id, active), 0, 100) }))
    .filter(({ billed }) => billed < 100)
    .map(({ q, billed }) => {
      const ageDays = daysBetween(now, new Date(q.createdAt));
      const remaining = (totalQuote(q) * (100 - billed)) / 100;
      return {
        kind: "to-invoice" as const,
        id: q.id,
        client: q.clientName || q.projectTitle || "—",
        ref: q.quoteNumber,
        amount: remaining,
        days: ageDays,
        tone: (ageDays >= AGING_DEVIS_DAYS ? "warn" : "info") as RelanceTone,
        reason:
          billed > 0
            ? `Acompte ${billed}% facturé · reste ${100 - billed}%`
            : `Validé il y a ${ageDays}j, pas de facture`,
        href: hrefFor(q),
      };
    })
    .sort((a, b) => b.days - a.days);

  // ── 3. Overdue invoices to chase for payment ──────────────────────────────
  const overdueInvoices: RelanceItem[] = active
    .filter(
      (q) =>
        q.docType === "invoice" &&
        q.invoiceStatus === "validated" &&
        !!q.validityDate &&
        new Date(q.validityDate).getTime() < now.getTime(),
    )
    .map((q) => {
      const overdueDays = daysBetween(now, new Date(q.validityDate));
      return {
        kind: "overdue-invoice" as const,
        id: q.id,
        client: q.clientName || q.projectTitle || "—",
        ref: q.quoteNumber,
        amount: totalQuote(q),
        days: overdueDays,
        tone: "danger" as RelanceTone,
        reason: `Échue depuis ${overdueDays}j`,
        href: `/quotes/${q.id}`,
      };
    })
    .sort((a, b) => b.days - a.days);

  // ── 4. Cold clients: engaged before, silent now, no active thread ─────────
  // Skip anyone already surfaced in a money bucket — they're being chased.
  const engaged = new Set<string>();
  for (const it of [...expiredDevis, ...toInvoice, ...overdueInvoices]) {
    engaged.add(normalize(it.client));
  }

  const coldClients: RelanceItem[] = clients
    .map((c) => {
      const cEmail = normalize(c.email);
      const cName = normalize(c.name);
      const cOrg = normalize(c.organization);
      const touchpoints: number[] = [];
      for (const q of active) {
        const match =
          (cEmail && normalize(q.clientEmail) === cEmail) ||
          (cName && normalize(q.clientName) === cName) ||
          (cOrg && normalize(q.clientCompany) === cOrg);
        if (!match) continue;
        const t = new Date(q.createdAt).getTime();
        if (!Number.isNaN(t)) touchpoints.push(t);
      }
      let hasActiveProject = false;
      for (const p of projects) {
        const match =
          (c.id && p.clientId === c.id) || (cName && normalize(p.client) === cName);
        if (!match) continue;
        if (p.status === "in-progress") hasActiveProject = true;
        const t = p.createdAt ? new Date(p.createdAt).getTime() : NaN;
        if (!Number.isNaN(t)) touchpoints.push(t);
      }
      const lastTs = touchpoints.length ? Math.max(...touchpoints) : null;
      return { c, lastTs, hasActiveProject };
    })
    .filter(
      ({ c, lastTs, hasActiveProject }) =>
        lastTs !== null &&
        !hasActiveProject &&
        daysBetween(now, new Date(lastTs)) >= COLD_CLIENT_DAYS &&
        !engaged.has(normalize(c.name)) &&
        !engaged.has(normalize(c.organization)),
    )
    .map(({ c, lastTs }) => {
      const silence = daysBetween(now, new Date(lastTs as number));
      return {
        kind: "cold-client" as const,
        id: c.id,
        client: c.organization || c.name,
        days: silence,
        tone: "info" as RelanceTone,
        reason: `Silence depuis ${silence}j`,
        href: `/clients/${c.id}`,
      };
    })
    .sort((a, b) => b.days - a.days);

  const atStake =
    toInvoice.reduce((s, it) => s + (it.amount ?? 0), 0) +
    overdueInvoices.reduce((s, it) => s + (it.amount ?? 0), 0);
  const count =
    expiredDevis.length + toInvoice.length + overdueInvoices.length + coldClients.length;

  return { expiredDevis, toInvoice, overdueInvoices, coldClients, atStake, count };
}
