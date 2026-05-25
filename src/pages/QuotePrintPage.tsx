import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuotes } from "@/hooks/useQuotes";
import { QuotePreview } from "@/components/quotes/QuotePreview";
import { buildQuoteFilename } from "@/types/quote";

const SUPPORT_EMAIL = "massaki@kojima-solutions.ch";

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { getQuote } = useQuotes();
  const quote = id ? getQuote(id) : undefined;

  useEffect(() => {
    if (!quote) return;
    // Set document.title so the browser's "Save as PDF" suggests a clean,
    // client-facing filename like "Devis_DEV-2026-001_Acme-SA.pdf".
    const originalTitle = document.title;
    document.title = buildQuoteFilename(quote);

    // Inject @page rule + html/body height reset for clean single-page output
    const style = document.createElement("style");
    style.id = "quote-print-page-style";
    style.textContent =
      "@page { size: A4; margin: 0; } @media print { html, body { height: auto !important; overflow: visible !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }";
    document.head.appendChild(style);
    document.body.classList.add("quote-print-mode");

    // When loaded inside a hidden iframe, the parent calls contentWindow.print() —
    // skip auto-print to avoid a double dialog.
    const isInIframe = window.self !== window.top;
    const timer = isInIframe ? undefined : setTimeout(() => window.print(), 400);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (document.head.contains(style)) document.head.removeChild(style);
      document.body.classList.remove("quote-print-mode");
      document.title = originalTitle;
    };
  }, [quote]);

  if (!id || !quote) {
    const subject = encodeURIComponent(`Lien devis introuvable (ref: ${id ?? "n/a"})`);
    const body = encodeURIComponent(
      `Bonjour,\n\nLe lien que j'ai reçu pour le devis ${id ?? "(identifiant manquant)"} ne fonctionne pas.\n\nMerci de me transmettre une nouvelle version.\n\nCordialement,`,
    );
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <h1 className="font-display text-2xl font-semibold text-gray-900">
            Lien indisponible
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Ce devis n'est plus accessible. Il a peut-être été supprimé ou le lien est incorrect.
          </p>
          <div className="space-y-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
              className="inline-block w-full sm:w-auto px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              Contacter Kojima Solutions
            </a>
            <p className="text-xs text-gray-400">
              ou écrivez à {SUPPORT_EMAIL}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <QuotePreview quote={quote} />
    </div>
  );
}
