/**
 * Silently prints a URL via a hidden iframe.
 * No new tab is opened — the system print dialog appears directly.
 */
export function printViaIframe(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:-10000px;left:-10000px;width:210mm;height:1px;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  iframe.onload = () => {
    setTimeout(() => {
      try {
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
