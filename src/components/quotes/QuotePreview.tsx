import type { Quote } from "@/types/quote";
import {
  discountAmountQuote,
  netSubtotalQuote,
  subtotalQuote,
  tvaAmountQuote,
  totalQuote,
  TVA_RATE,
} from "@/types/quote";

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
  const lang = quote.lang;
  const isFr = lang === "fr";
  const isInvoice = (quote as { docType?: string }).docType === "invoice";

  const title = isFr
    ? (isInvoice ? "Facture" : "Devis")
    : (isInvoice ? "Invoice" : "Quote");

  const accentColor = isInvoice ? "hsl(var(--accent))" : "hsl(var(--primary))";
  const accentFaint  = isInvoice ? "hsl(var(--accent) / 0.15)" : "hsl(var(--primary) / 0.15)";
  const accentMid    = isInvoice ? "hsl(var(--accent) / 0.4)"  : "hsl(var(--primary) / 0.4)";
  const accentBg     = isInvoice ? "hsl(var(--accent) / 0.08)" : "hsl(var(--primary) / 0.08)";
  const accentLight  = isInvoice ? "hsl(var(--accent) / 0.2)"  : "hsl(var(--primary) / 0.2)";

  const subtotal = subtotalQuote(quote);
  const discount = discountAmountQuote(quote);
  const netSubtotal = netSubtotalQuote(quote);
  const tva = tvaAmountQuote(quote);
  const total = totalQuote(quote);

  const discountLabel =
    quote.discountLabel?.trim() ||
    (isFr ? "Remise" : "Discount");

  const renderBoldMarkdown = (text: string) => {
    const parts = text.split("**");
    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold text-gray-900">
          {p}
        </strong>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };

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
                Kojima<span style={{ color: accentColor }}>.</span>Solutions
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                <div>Massaki Chraïti</div>
                <div>Rue de la Paix 4</div>
                <div>1020 Renens, Suisse</div>
                <div className="mt-0.5">massaki@kojima-solutions.ch</div>
                <div className="text-gray-400 mt-0.5">IDE: CHE-000.000.000</div>
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
                  : (isFr ? "Validité" : "Validity")}: {quote.validityDate || "-"}
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
            <div className="w-48 shrink-0 text-right">
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

          {/* Table */}
          <div className="mt-6 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <table className="w-full border-collapse text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
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
                      <span className="whitespace-pre-wrap leading-relaxed">
                        {line.description ? renderBoldMarkdown(line.description) : "-"}
                      </span>
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

            {/* Left: Conditions */}
            {quote.conditions && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                  {isFr ? "Conditions" : "Terms and conditions"}:
                </div>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {quote.conditions}
                </p>
              </div>
            )}

            {/* Right: Totals */}
            <div className={`w-52 shrink-0 space-y-2 text-xs${quote.conditions ? "" : " ml-auto"}`}>
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
                    : (isFr ? "Total TTC" : "Total (incl. VAT):")}
                </span>
                <span>{formatCurrency(total, lang)}</span>
              </div>
            </div>

          </div>

          {/* Payment terms (invoices) */}
          {isInvoice && quote.paymentTerms && (
            <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${accentFaint}` }}>
              <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                {isFr ? "Modalités de paiement" : "Payment terms"}
              </div>
              <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {quote.paymentTerms}
              </p>
            </div>
          )}

          {/* Bank details (invoices) */}
          {isInvoice && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${accentFaint}` }}>
              <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
                {isFr ? "Coordonnées bancaires" : "Bank details"}
              </div>
              <div className="text-xs text-gray-700 leading-relaxed grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                <span className="text-gray-500">{isFr ? "Titulaire" : "Account holder"}:</span>
                <span>Kojima Solutions — Massaki Chraïti</span>
                <span className="text-gray-500">IBAN:</span>
                <span className="font-mono">CH00 0000 0000 0000 0000 0</span>
                <span className="text-gray-500">BIC/SWIFT:</span>
                <span className="font-mono">XXXXXXXX</span>
                <span className="text-gray-500">{isFr ? "Banque" : "Bank"}:</span>
                <span>À compléter</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 h-px w-full" style={{ backgroundColor: accentLight }} />
          <div className="mt-3 text-center text-[9px] text-gray-400 leading-relaxed">
            <span>Kojima Solutions — Massaki Chraïti — Rue de la Paix 4, 1020 Renens, Suisse</span>
            <br />
            <span>IDE: CHE-000.000.000 — massaki@kojima-solutions.ch — kojima-solutions.ch</span>
          </div>
        </div>
        {/* Right edge accent */}
        <div className="w-1 shrink-0" style={{ backgroundColor: accentFaint }} />
      </div>
    </div>
  );
}
