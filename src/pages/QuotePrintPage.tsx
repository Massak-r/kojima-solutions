import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuotes } from "@/hooks/useQuotes";
import { QuotePreview } from "@/components/quotes/QuotePreview";

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const { getQuote } = useQuotes();
  const quote = id ? getQuote(id) : undefined;

  useEffect(() => {
    if (!quote) return;
    // Inject @page rule + html/body height reset for clean single-page output
    const style = document.createElement("style");
    style.id = "quote-print-page-style";
    style.textContent =
      "@page { size: A4; margin: 0; } @media print { html, body { height: auto !important; overflow: visible !important; } }";
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
    };
  }, [quote]);

  if (!id || !quote) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Document not found.</p>
          <Link to="/quotes" className="text-blue-600 hover:underline text-sm">
            Back to quotes
          </Link>
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
