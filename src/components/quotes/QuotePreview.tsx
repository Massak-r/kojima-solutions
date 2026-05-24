import type { Quote } from "@/types/quote";
import {
  discountAmountQuote,
  netSubtotalQuote,
  subtotalQuote,
  tvaAmountQuote,
  totalQuote,
  TVA_RATE,
} from "@/types/quote";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { formatDateSwiss } from "@/lib/dateFormat";
import { richHtmlForDisplay } from "@/lib/sanitizeRichHtml";

function formatCurrency(value: number, lang: "fr" | "en"): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CH" : "en-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

interface QuotePreviewProps {
  quote: Omit<Quote, "id" | "createdAt"> | Quote;
  className?: string;
}

export function QuotePreview({ quote, className = "" }: QuotePreviewProps) {
  const { settings: co } = useCompanySettings();
  const lang = quote.lang;
  const isFr = lang === "fr";
  const isInvoice = (quote as { docType?: string }).docType === "invoice";

  const title = isFr
    ? (isInvoice ? "Facture" : "Devis")
    : (isInvoice ? "Invoice" : "Quote");

  // Use hardcoded colors for print/PDF reliability (CSS variables may not resolve in iframe print)
  // Quote = navy (primary), Invoice = teal (saturated so it doesn't print as grey)
  const baseColor   = isInvoice ? "15, 109, 122" : "42, 74, 107";
  const accentColor = `rgb(${baseColor})`;
  const accentFaint = `rgba(${baseColor}, 0.15)`;
  const accentMid   = `rgba(${baseColor}, 0.4)`;
  const accentBg    = `rgba(${baseColor}, 0.08)`;
  const accentLight = `rgba(${baseColor}, 0.2)`;

  const subtotal = subtotalQuote(quote);
  const discount = discountAmountQuote(quote);
  const netSubtotal = netSubtotalQuote(quote);
  const tva = tvaAmountQuote(quote);
  const total = totalQuote(quote);

  const discountLabel =
    quote.discountLabel?.trim() ||
    (isFr ? "Remise" : "Discount");

  // Quote line descriptions are rich-text HTML (with legacy markdown auto-converted).
  // We sanitize before injecting so user-edited content can't smuggle scripts/styles.
  const renderRichDescription = (text: string) => (
    <span
      className="quote-rich-content leading-relaxed"
      dangerouslySetInnerHTML={{ __html: richHtmlForDisplay(text) }}
    />
  );

  return (
    <div
      className={`quote-preview-document bg-white text-gray-900 shadow-lg overflow-hidden ${className}`}
      style={{
        maxWidth: "210mm",
        minHeight: "297mm",
        fontFamily: "Helvetica, Arial, sans-serif",
      }}
    >
      {/* Decorative top band */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />
      <div className="flex">
        {/* Left edge accent */}
        <div className="w-1 shrink-0" style={{ backgroundColor: accentFaint }} />
        <div className="flex-1 min-w-0 px-6 pb-8 pt-5 text-sm">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <div
                className="text-[22px] font-bold tracking-tight text-gray-900"
                style={{ letterSpacing: "-0.02em" }}
              >
                {co.companyName.includes(".")
                  ? <>{co.companyName.split(".")[0]}<span style={{ color: accentColor }}>.</span>{co.companyName.split(".").slice(1).join(".")}</>
                  : co.companyName}
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                <div>{co.ownerName}</div>
                {co.address.split(",").map((line, i) => (
                  <div key={i}>{line.trim()}</div>
                ))}
                <div className="mt-0.5">{co.email}</div>
                {co.ideNumber && <div className="text-gray-400 mt-0.5">IDE: {co.ideNumber}</div>}
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-xs font-semibold uppercase text-gray-500"
                style={{ letterSpacing: "0.15em" }}
              >
                {title}
              </div>
              <div
                className="mt-2 ml-auto w-8 h-px"
                style={{ backgroundColor: accentMid }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-b border-gray-200 mb-5" style={{ borderBottomWidth: "1px" }} />

          <div className="flex justify-between gap-8">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 mb-1">
                {isInvoice
                  ? (isFr ? "N° de facture" : "Invoice number")
                  : (isFr ? "N° de devis" : "Quote number")}: {quote.quoteNumber || "-"}
              </div>
              <div className="text-xs text-gray-600 mb-4">
                {isInvoice
                  ? (isFr ? "Date" : "Date")
                  : (isFr ? "Validité" : "Validity")}: {formatDateSwiss(quote.validityDate)}
              </div>
              {quote.projectTitle && (
                <div className="font-semibold mb-1 text-gray-900">{quote.projectTitle}</div>
              )}
              {quote.projectDescription && (
                <p className="text-gray-700 whitespace-pre-wrap mb-4 leading-relaxed">
                  {quote.projectDescription}
                </p>
              )}
            </div>
            <div className="w-32 sm:w-48 shrink-0 text-right">
              <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                {isFr ? "Client" : "Client"}
              </div>
              <div className="text-xs text-gray-800">{quote.clientName || "-"}</div>
              {quote.clientCompany && (
                <div className="text-xs text-gray-700">{quote.clientCompany}</div>
              )}
              <div className="text-xs text-gray-700">{quote.clientEmail || "-"}</div>
              {quote.clientAddress && (
                <div className="text-xs text-gray-600 whitespace-pre-wrap mt-1">
                  {quote.clientAddress}
                </div>
              )}
            </div>
          </div>

          {/* Table — horizontal scroll on phones so narrow viewports don't crush the columns */}
          <div className="mt-6 rounded-lg overflow-x-auto border border-gray-200 shadow-sm">
            <table className="w-full min-w-[420px] border-collapse text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr className="border-b border-gray-200" style={{ backgroundColor: accentBg }}>
                  <th className="border-r border-gray-200 p-3 text-left font-semibold text-gray-800">
                    {isFr ? "Prestation" : "Description"}
                  </th>
                  <th className="border-r border-gray-200 p-3 w-14 text-center font-semibold text-gray-800">
                    {isFr ? "Qté" : "Qty"}
                  </th>
                  <th className="border-r border-gray-200 p-3 w-24 text-right font-semibold text-gray-800">
                    {isFr ? "Prix unit. (CHF)" : "Unit price (CHF)"}
                  </th>
                  <th className="p-3 w-24 text-right font-semibold text-gray-800">
                    Total (CHF)
                  </th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((line) => (
                  <tr key={line.id} className="border-b border-gray-100 last:border-b-0 odd:bg-white even:bg-gray-50/50">
                    <td className="border-r border-gray-200 p-3 align-top text-gray-800">
                      {line.description ? renderRichDescription(line.description) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="border-r border-gray-200 p-3 text-center align-top">{line.quantity}</td>
                    <td className="border-r border-gray-200 p-3 text-right align-top">{formatCurrency(line.unitPrice, lang)}</td>
                    <td className="p-3 text-right align-top font-medium">{formatCurrency(line.quantity * line.unitPrice, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + Conditions side-by-side */}
          <div className="mt-6 border-t border-gray-200" style={{ borderTopWidth: "1px" }} />
          <div className="mt-4 flex items-start gap-8">

            {/* Left: payment terms takes the flex-1 slot whenever filled in;
                falls back to conditions otherwise. */}
            {quote.paymentTerms ? (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  {isFr ? "Modalités de paiement" : "Payment terms"}
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {quote.paymentTerms}
                </p>
              </div>
            ) : quote.conditions ? (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  {isFr ? "Conditions" : "Terms and conditions"}:
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {quote.conditions}
                </p>
              </div>
            ) : null}

            {/* Right: Totals */}
            <div className={`w-52 shrink-0 space-y-2 text-xs${(quote.paymentTerms || quote.conditions) ? "" : " ml-auto"}`}>
              <div className="flex justify-between text-gray-700">
                <span>{isFr ? "Sous-total" : "Subtotal"}:</span>
                <span>{formatCurrency(subtotal, lang)}</span>
              </div>
              {quote.discountEnabled && discount > 0 && (
                <>
                  <div className="flex justify-between text-gray-700">
                    <span>
                      {discountLabel}
                      {quote.discountType === "percent" && quote.discountValue
                        ? ` (${quote.discountValue}%)`
                        : ""}:
                    </span>
                    <span className="text-gray-600">-{formatCurrency(discount, lang)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>{isFr ? "Sous-total net" : "Net subtotal"}:</span>
                    <span>{formatCurrency(netSubtotal, lang)}</span>
                  </div>
                </>
              )}
              {quote.applyTva && (
                <div className="flex justify-between text-gray-700">
                  <span>TVA {TVA_RATE}%:</span>
                  <span>{formatCurrency(tva, lang)}</span>
                </div>
              )}
              <div
                className="flex justify-between font-bold pt-3 mt-1 text-gray-900"
                style={{ fontSize: "13px" }}
              >
                <span>
                  {isInvoice
                    ? (isFr ? "Total à payer" : "Total due")
                    : quote.applyTva
                      ? (isFr ? "Total TTC" : "Total (incl. VAT)")
                      : "Total"}
                </span>
                <span>{formatCurrency(total, lang)}</span>
              </div>
            </div>

          </div>

          {/* Conditions (below, when both payment terms and conditions are filled in). */}
          {quote.paymentTerms && quote.conditions && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${accentFaint}` }}>
              <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                {isFr ? "Conditions" : "Terms and conditions"}
              </div>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {quote.conditions}
              </p>
            </div>
          )}

          {/* Bank details (invoices) — only when IBAN is configured in admin settings */}
          {isInvoice && !!co.bankIban && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${accentFaint}` }}>
              <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                {isFr ? "Coordonnées bancaires" : "Bank details"}
              </div>
              <div className="text-xs text-gray-700 leading-relaxed grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                <span className="text-gray-500">{isFr ? "Titulaire" : "Account holder"}:</span>
                <span>{co.bankAccountHolder || "-"}</span>
                <span className="text-gray-500">IBAN:</span>
                <span className="font-mono">{co.bankIban || "-"}</span>
                {co.bankBic && (<>
                  <span className="text-gray-500">BIC/SWIFT:</span>
                  <span className="font-mono">{co.bankBic}</span>
                </>)}
                {co.bankName && (<>
                  <span className="text-gray-500">{isFr ? "Banque" : "Bank"}:</span>
                  <span>{co.bankName}</span>
                </>)}
              </div>
            </div>
          )}

        </div>
        {/* Right edge accent */}
        <div className="w-1 shrink-0" style={{ backgroundColor: accentFaint }} />
      </div>
    </div>
  );
}
