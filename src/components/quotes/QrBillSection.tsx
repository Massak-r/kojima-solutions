import { useMemo } from "react";
import { SwissQRBill } from "swissqrbill/svg";
import type { Data } from "swissqrbill/types";
import type { Quote } from "@/types/quote";
import { totalQuote } from "@/types/quote";
import type { CompanySettings } from "@/types/companySettings";

type QrQuote = Pick<
  Quote,
  | "quoteNumber"
  | "projectTitle"
  | "lineItems"
  | "applyTva"
  | "discountEnabled"
  | "discountType"
  | "discountValue"
>;

/**
 * Build the Swiss QR-bill payload from the créancier profile + invoice.
 * Pure and exported so it can be unit-tested without rendering.
 *
 * Returns null when the QR-bill is disabled, the créancier profile is
 * incomplete, or the amount is not positive — the caller then renders nothing.
 *
 * Reference handling (Phase 1): for a normal IBAN we bill "without reference"
 * and carry the invoice number in the message — it prints on the slip and
 * comes back in the bank statement (CAMT) for reconciliation. A QR-IBAN
 * requires a QR reference we don't generate yet; `SwissQRBill` then throws and
 * the caller skips rendering.
 */
export function buildQrBillData(quote: QrQuote, co: CompanySettings): Data | null {
  if (!co.qrEnabled) return null;

  const account = (co.qrIban || co.bankIban || "").replace(/\s+/g, "").toUpperCase();
  const name = (co.qrCreditorName || co.companyName || co.bankAccountHolder || "").trim();
  const street = (co.qrCreditorStreet || "").trim();
  const zip = (co.qrCreditorZip || "").trim();
  const city = (co.qrCreditorCity || "").trim();
  const country = ((co.qrCreditorCountry || "CH").trim() || "CH").slice(0, 2).toUpperCase();
  const amount = Math.round(totalQuote(quote) * 100) / 100;

  // Need a complete créancier + a positive amount to emit a valid bill.
  if (!account || !name || !street || !zip || !city || !(amount > 0)) return null;

  // Invoice number + project as the message: prints on the slip and returns in
  // the bank statement remittance info for later reconciliation.
  const message =
    [quote.quoteNumber, quote.projectTitle].filter(Boolean).join(" — ").slice(0, 140) || undefined;

  return {
    currency: "CHF",
    amount,
    creditor: {
      account,
      name: name.slice(0, 70),
      address: street.slice(0, 70),
      buildingNumber: (co.qrCreditorBuildingNumber || "").trim() || undefined,
      zip,
      city: city.slice(0, 35),
      country,
    },
    message,
  };
}

interface QrBillSectionProps {
  quote: Omit<Quote, "id" | "createdAt"> | Quote;
  settings: CompanySettings;
  lang: "fr" | "en";
}

/**
 * Swiss QR-bill payment part (SIX QR-facture) for invoices, rendered as SVG via
 * the `swissqrbill` library — it builds the spec-compliant SPC payload, the
 * Swiss cross, Latin-1 encoding and the multilingual labels, and validates the
 * IBAN. Renders nothing if the créancier profile is incomplete or invalid, so a
 * misconfiguration never breaks the printed invoice.
 */
export function QrBillSection({ quote, settings: co, lang }: QrBillSectionProps) {
  const svg = useMemo(() => {
    const data = buildQrBillData(quote, co);
    if (!data) return null;
    try {
      return new SwissQRBill(data, { language: lang === "fr" ? "FR" : "EN" }).toString();
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[QR-bill] skipped — invalid créancier config:", err);
      }
      return null;
    }
  }, [quote, co, lang]);

  if (!svg) return null;

  return (
    <div
      className="qr-bill w-full"
      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
