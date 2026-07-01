/**
 * Silently prints a URL via a hidden iframe.
 * No new tab is opened — the system print dialog appears directly.
 *
 * `filename` (without extension) becomes the suggested "Save as PDF" name.
 * When printing an iframe, Chrome names the PDF after the *top-level* document's
 * title, not the iframe's — so we set the parent title for the duration of the
 * dialog and restore it afterward.
 */
export function printViaIframe(url: string, filename?: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-10000px;left:-10000px;width:210mm;height:1px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const originalTitle = document.title;
  const cleanup = () => {
    if (filename) document.title = originalTitle;
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  iframe.onload = () => {
    setTimeout(() => {
      try {
        if (filename) document.title = filename;
        iframe.contentWindow?.addEventListener("afterprint", cleanup);
        iframe.contentWindow?.print();
      } catch {
        cleanup();
        // Fallback: open in new tab if iframe print fails
        window.open(url, "_blank");
      }
      // Safety cleanup after 10 min if afterprint never fires
      setTimeout(cleanup, 600_000);
    }, 700);
  };

  iframe.src = url;
}
