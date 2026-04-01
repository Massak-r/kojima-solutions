/**
 * Triggers the browser print dialog focused on the quote preview element.
 * The browser's "Save as PDF" option produces vector text (no rasterization).
 * Print CSS is defined in index.css under @media print.
 */
export function generateQuotePdfFromElement(_element: HTMLElement, _quote: { quoteNumber?: string }): Promise<void> {
  return new Promise((resolve) => {
    window.print();
    // Resolve after a short delay to allow print dialog to open
    setTimeout(resolve, 500);
  });
}
