import type { Quote } from "@/types/quote";
import { totalQuote } from "@/types/quote";

/**
 * Minimal ISO 20022 CAMT.052/053/054 reader for invoice reconciliation.
 *
 * We only need booked entries: amount, direction, date, the remittance text
 * (where QR-bill Phase 1 puts the invoice number — see QrBillSection) and the
 * counterparty. Namespace-agnostic so it copes with any camt.05x.001.xx flavour
 * a bank emits. Browser/jsdom `DOMParser` does the XML work.
 */
export interface CamtEntry {
  amount: number;
  currency: string;
  credit: boolean;        // true = money in (CRDT)
  date: string;           // YYYY-MM-DD (booking date), "" if absent
  reference: string;      // remittance: structured ref + unstructured message
  counterparty: string;   // debtor (credits) / creditor (debits) name, "" if absent
}

function els(parent: Element | Document, name: string): Element[] {
  // getElementsByTagNameNS('*', …) matches the tag in ANY namespace — CAMT files
  // declare a default xmlns, so a plain getElementsByTagName would miss them.
  return Array.from(parent.getElementsByTagNameNS("*", name));
}

function firstText(parent: Element, name: string): string {
  return els(parent, name)[0]?.textContent?.trim() ?? "";
}

function bookingDate(ntry: Element): string {
  const bookg = els(ntry, "BookgDt")[0];
  if (!bookg) return "";
  const dt = firstText(bookg, "Dt") || firstText(bookg, "DtTm");
  return dt ? dt.slice(0, 10) : "";
}

/** Parse a CAMT XML string into booked entries. Throws on invalid XML. */
export function parseCamt(xml: string): CamtEntry[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Fichier illisible — ce n'est pas un XML CAMT valide.");
  }
  const entries: CamtEntry[] = [];
  for (const ntry of els(doc, "Ntry")) {
    const amtEl = els(ntry, "Amt")[0];
    if (!amtEl) continue;
    const amount = parseFloat(amtEl.textContent || "0");
    if (!Number.isFinite(amount)) continue;
    const credit = firstText(ntry, "CdtDbtInd") === "CRDT";

    // Remittance: gather every structured ref + unstructured message across the
    // entry's transaction details (an entry can bundle several).
    const refs: string[] = [];
    for (const rmt of els(ntry, "RmtInf")) {
      for (const u of els(rmt, "Ustrd")) if (u.textContent?.trim()) refs.push(u.textContent.trim());
      for (const r of els(rmt, "Ref")) if (r.textContent?.trim()) refs.push(r.textContent.trim());
    }
    // Also accept AddtlNtryInf / a top-level <Ref> as a last resort.
    if (refs.length === 0) {
      const addtl = firstText(ntry, "AddtlNtryInf");
      if (addtl) refs.push(addtl);
    }

    const partyTag = credit ? "Dbtr" : "Cdtr";
    const party = els(ntry, partyTag)[0];
    const counterparty = party ? (els(party, "Nm")[0]?.textContent?.trim() ?? "") : "";

    entries.push({
      amount,
      currency: amtEl.getAttribute("Ccy") || "CHF",
      credit,
      date: bookingDate(ntry),
      reference: refs.join(" ").replace(/\s+/g, " ").trim(),
      counterparty,
    });
  }
  return entries;
}

export interface CamtMatch {
  entry: CamtEntry;
  invoice: Quote | null;
  amountMatches: boolean;  // bank amount == invoice total (within a centime)
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/**
 * Pair each incoming credit with an open invoice. Primary signal: the invoice
 * number printed in the remittance message (Phase-1 "without reference" bills).
 * Fallback: a single open invoice whose total equals the credit. Each invoice
 * is claimed once, so two identical payments can't both grab it.
 */
export function reconcile(entries: CamtEntry[], invoices: Quote[]): CamtMatch[] {
  const open = invoices.filter(
    (q) => q.docType === "invoice" && !q.isTemplate && q.invoiceStatus !== "paid",
  );
  const used = new Set<string>();

  return entries
    .filter((e) => e.credit && e.amount > 0)
    .map((entry) => {
      const ref = entry.reference.toUpperCase();
      let invoice =
        open.find(
          (inv) => inv.quoteNumber && !used.has(inv.id) && ref.includes(inv.quoteNumber.toUpperCase()),
        ) ?? null;

      if (!invoice) {
        const sameAmount = open.filter((inv) => !used.has(inv.id) && near(totalQuote(inv), entry.amount));
        if (sameAmount.length === 1) invoice = sameAmount[0];
      }

      if (invoice) used.add(invoice.id);
      return {
        entry,
        invoice,
        amountMatches: invoice ? near(totalQuote(invoice), entry.amount) : false,
      };
    });
}
