import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { openForRender, renderThumbnail } from "./pdfPages";

interface PdfThumbnailProps {
  /** Same-origin, cookie-authenticated URL the PDF bytes are fetched from. */
  viewUrl: string;
  /** Canvas render width in px — display size is driven by the parent box. */
  renderWidth?: number;
  className?: string;
  /** Accessible label for the rendered page image. */
  label?: string;
}

/**
 * Inline first-page preview of a server-stored PDF. The bytes are fetched
 * lazily once the element scrolls near the viewport, rendered to an image with
 * pdfjs, then the pdfjs document is torn down so memory stays bounded even with
 * a long queue of cards. The browser HTTP cache means a later full-screen
 * preview of the same file reuses these bytes. Falls back to a document icon
 * while loading or if the render fails (offline, encrypted, corrupt…).
 */
export function PdfThumbnail({ viewUrl, renderWidth = 200, className, label }: PdfThumbnailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Defer all work until the card is near the viewport.
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let doc: Awaited<ReturnType<typeof openForRender>> | null = null;
    (async () => {
      try {
        const res = await fetch(viewUrl, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        if (cancelled) return;
        doc = await openForRender(bytes);
        const thumb = await renderThumbnail(doc, 1, renderWidth);
        if (!cancelled) setSrc(thumb);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (doc) void doc.destroy().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, viewUrl, renderWidth]);

  return (
    <div ref={ref} className={cn("flex items-center justify-center bg-secondary/40", className)}>
      {src ? (
        <img
          src={src}
          alt={label ?? "Aperçu du document"}
          draggable={false}
          className="w-full h-full object-cover object-top"
        />
      ) : failed ? (
        <FileText size={20} className="text-muted-foreground/50" />
      ) : (
        <Loader2 size={16} className="animate-spin text-muted-foreground/40" />
      )}
    </div>
  );
}
