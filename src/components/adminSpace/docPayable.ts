import { classifyPdf } from "@/api/adminDocs";
import { extractInvoiceFields } from "@/lib/invoiceExtractor";
import type { PayablePrefill } from "./DocToPayableDialog";

/**
 * Read a document's PDF text (server-side extraction) and build a best-effort
 * payable prefill from it. Shared by the triage queue and the filed-documents
 * list so a facture can be registered as a future payment from either place.
 */
export async function buildDocPayablePrefill(docId: string, docTitle: string): Promise<PayablePrefill> {
  const payload = await classifyPdf(docId);
  const f = extractInvoiceFields(payload.extractedText || "");
  const refBits = [f.iban && `IBAN ${f.iban}`, f.reference && `réf ${f.reference}`].filter(Boolean).join(" · ");
  return {
    label: f.vendor ? `Facture ${f.vendor}` : docTitle,
    amount: f.amount != null ? String(f.amount) : "",
    dueDate: f.dueDate ?? "",
    category: "",
    notes: `Depuis « ${docTitle} »${refBits ? " · " + refBits : ""}`,
  };
}
