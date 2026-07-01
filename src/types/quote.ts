export type QuoteLang = "fr" | "en";

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Back-reference to the module that generated this line, for traceability. */
  sourceModuleId?: string;
  /** Complexity tier at the moment the line was generated. */
  sourceComplexity?: "simple" | "advanced" | "custom";
}

export interface Quote {
  id: string;
  createdAt: string; // ISO
  projectId?: string;
  lang: QuoteLang;

  // Client
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  clientAddress?: string;
  clientRef?: string; // client's own reference / PO number, shown on the invoice

  // Quote meta
  quoteNumber: string;
  validityDate: string; // YYYY-MM-DD
  projectTitle: string;
  projectDescription: string;
  conditions: string;

  // Lines
  lineItems: QuoteLineItem[];

  // TVA 8.1%
  applyTva: boolean;

  // Remise / Discount (applied before TVA)
  discountEnabled?: boolean;
  discountType?: "amount" | "percent";
  discountValue?: number;
  discountLabel?: string;
  docType?: "quote" | "invoice";
  invoiceStatus?: "draft" | "to-validate" | "validated" | "paid" | "on-hold";
  paymentTerms?: string;

  // Reusable template flag. Templates don't appear in the main list and serve
  // as starting points for new quotes via the "Partir d'un modèle…" picker.
  isTemplate?: boolean;
  templateName?: string | null;

  // Acompte/solde linkage. Set on an *invoice* to point back at the source
  // devis it partially bills; the devis's billed state is derived by summing
  // billedPct across all invoices that reference it (self-healing on delete).
  sourceQuoteId?: string;
  billingKind?: "acompte" | "solde";
  billedPct?: number;
}

export const TVA_RATE = 8.1;

export function createEmptyLineItem(): QuoteLineItem {
  return {
    id: crypto.randomUUID?.() ?? `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: "",
    quantity: 1,
    unitPrice: 0,
  };
}

export function createEmptyQuote(lang: QuoteLang = "fr"): Omit<Quote, "id" | "createdAt"> {
  const now = new Date();
  const validity = new Date(now);
  validity.setMonth(validity.getMonth() + 1);
  return {
    lang,
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    clientAddress: "",
    // Real auto-generated number is computed in QuoteForm from existing quotes.
    // This placeholder is only used when the form has no access to the quotes list.
    quoteNumber: nextQuoteNumber([], "quote", now.getFullYear()),
    validityDate: validity.toISOString().slice(0, 10),
    projectTitle: "",
    projectDescription: "",
    conditions: "",
    lineItems: [createEmptyLineItem()],
    applyTva: false,
    discountEnabled: false,
    discountType: "amount",
    discountValue: 0,
    discountLabel: "",
    docType: "quote",
    invoiceStatus: "draft",
  };
}

/** Prefix used in quote numbers for each document type. */
export function quoteNumberPrefix(docType: "quote" | "invoice"): string {
  return docType === "invoice" ? "FAC" : "DEV";
}

function slugifyForFilename(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Client-facing filename for the printed PDF (without extension).
 *  The document number already encodes the type (FAC-… / DEV-…) and is unique,
 *  so it makes the cleanest, most sortable filename — "FAC-2026-07-001.pdf".
 *  Falls back to a labelled name only when the number is missing.
 *  Browsers append ".pdf" automatically when saving from the print dialog. */
export function buildQuoteFilename(quote: Pick<Quote, "docType" | "quoteNumber" | "clientCompany" | "clientName">): string {
  const number = (quote.quoteNumber || "").trim();
  if (number) return number;
  const docLabel = (quote.docType ?? "quote") === "invoice" ? "Facture" : "Devis";
  const who = slugifyForFilename(quote.clientCompany || quote.clientName || "Client") || "Client";
  return `${docLabel}_${who}`;
}

/** Compute the next sequential quote number (DEV-YYYY-NNN or FAC-YYYY-NNN). */
export function nextQuoteNumber(
  existing: Pick<Quote, "quoteNumber" | "docType">[],
  docType: "quote" | "invoice",
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1,
): string {
  const prefix = quoteNumberPrefix(docType);
  // Robust: read the trailing sequence whether the number is legacy
  // PREFIX-YYYY-NNN or the current PREFIX-YYYY-MM-NNN. Annual sequence (max+1)
  // so a mixed history can't collide; the month is added for readability.
  const re = new RegExp(`^${prefix}-${year}-(?:\\d{2}-)?(\\d+)$`);
  const max = existing
    .filter((q) => (q.docType ?? "quote") === docType)
    .map((q) => {
      const m = (q.quoteNumber ?? "").match(re);
      return m ? parseInt(m[1], 10) : 0;
    })
    .reduce((a, b) => Math.max(a, b), 0);
  const mm = String(month).padStart(2, "0");
  return `${prefix}-${year}-${mm}-${String(max + 1).padStart(3, "0")}`;
}

/** Return true if `number` is already used by a different quote. */
export function quoteNumberConflicts(
  existing: Pick<Quote, "id" | "quoteNumber">[],
  number: string,
  currentId: string | null,
): boolean {
  if (!number) return false;
  return existing.some((q) => q.quoteNumber === number && q.id !== currentId);
}

/**
 * The invoice number that mirrors a devis number — DEV-YYYY[-MM]-NNN becomes
 * FAC-YYYY[-MM]-NNN — so a quote and the invoice raised from it share one
 * sequence (easy to reconcile). Returns null when the source isn't a DEV
 * number or the mirrored number is already taken, so the caller falls back to
 * a fresh sequential number.
 */
export function invoiceNumberFromQuote(
  quoteNumber: string,
  existing: Pick<Quote, "id" | "quoteNumber">[],
): string | null {
  const m = (quoteNumber ?? "").match(/^DEV-(.+)$/);
  if (!m) return null;
  const candidate = `FAC-${m[1]}`;
  return quoteNumberConflicts(existing, candidate, null) ? null : candidate;
}

export function subtotalQuote(quote: Pick<Quote, "lineItems">): number {
  return quote.lineItems.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export function discountAmountQuote(
  quote: Pick<Quote, "lineItems" | "discountEnabled" | "discountType" | "discountValue">
): number {
  if (!quote.discountEnabled) return 0;
  const value = Math.max(0, Number(quote.discountValue ?? 0) || 0);
  const sub = subtotalQuote(quote);
  if (quote.discountType === "percent") return (sub * value) / 100;
  return value;
}

export function netSubtotalQuote(
  quote: Pick<Quote, "lineItems" | "discountEnabled" | "discountType" | "discountValue">
): number {
  return Math.max(0, subtotalQuote(quote) - discountAmountQuote(quote));
}

export function tvaAmountQuote(
  quote: Pick<
    Quote,
    "lineItems" | "applyTva" | "discountEnabled" | "discountType" | "discountValue"
  >
): number {
  if (!quote.applyTva) return 0;
  return (netSubtotalQuote(quote) * TVA_RATE) / 100;
}

export function totalQuote(quote: Pick<Quote, "lineItems" | "applyTva">): number {
  // Back-compat: older callers may not pass discount fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = quote as any;
  const withDiscount = {
    ...q,
    discountEnabled: q.discountEnabled ?? false,
    discountType: q.discountType ?? "amount",
    discountValue: q.discountValue ?? 0,
  } as Quote;
  return netSubtotalQuote(withDiscount) + tvaAmountQuote(withDiscount);
}
