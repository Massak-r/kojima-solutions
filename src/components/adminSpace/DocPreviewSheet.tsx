import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExternalLink, Download, FileText, AlertTriangle } from "lucide-react";

interface DocPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  viewUrl: string;
}

/** iOS Safari (UA includes iPad/iPhone but NOT FxiOS/CriOS in standalone PWA)
 *  refuses to render PDFs inline in iframes. Detected here so we can skip the
 *  iframe and show a tap-to-open button instead. */
function isIOSStandalone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (!ios) return false;
  const standalone = (navigator as { standalone?: boolean }).standalone === true
    || (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches);
  return !!standalone;
}

/** Generic "iframe PDF won't work here" detector. iOS Safari + iOS PWA need
 *  the OS PDF viewer, not the broken in-page renderer. */
function shouldSkipIframe(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isIOSStandalone()) return true;
  // Plain iOS Safari (non-standalone) also struggles — opt out too.
  const ua = navigator.userAgent;
  const iosSafari = /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iosSafari;
}

/**
 * In-app PDF viewer. Drawer on mobile (slides up almost full-screen),
 * centered dialog on desktop. iOS Safari + standalone PWAs get a
 * tap-to-open card instead of the iframe — the in-app viewer is broken
 * there and the previous version showed a blank white area.
 */
export function DocPreviewSheet({ open, onOpenChange, title, viewUrl }: DocPreviewSheetProps) {
  const isMobile = useIsMobile();
  const [skipIframe] = useState<boolean>(() => shouldSkipIframe());
  const [iframeFailed, setIframeFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watchdog: if the iframe hasn't fired onLoad within 6s, assume the
  // browser blocked it (CSP, plugin missing, network drop mid-PDF, etc.)
  // and surface the fallback button.
  useEffect(() => {
    if (!open || skipIframe) return;
    setLoaded(false);
    setIframeFailed(false);
    watchdog.current = setTimeout(() => {
      setIframeFailed((prev) => prev || !loaded);
    }, 6000);
    return () => {
      if (watchdog.current) clearTimeout(watchdog.current);
    };
  // We deliberately don't depend on `loaded` — the timer is set once per
  // open. onLoad clears it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewUrl, skipIframe]);

  function handleIframeLoad() {
    setLoaded(true);
    setIframeFailed(false);
    if (watchdog.current) clearTimeout(watchdog.current);
  }

  function handleIframeError() {
    setIframeFailed(true);
  }

  const header = (
    // pr-12 keeps the dialog's built-in close X from overlapping the link.
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-background/95 shrink-0 pr-12">
      <p className="font-body text-sm font-medium flex-1 truncate">{title}</p>
      <a
        href={viewUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-body text-primary hover:underline inline-flex items-center gap-1 shrink-0"
      >
        <ExternalLink size={12} /> Ouvrir
      </a>
    </div>
  );

  const fallback = (
    <div className="flex-1 flex items-center justify-center p-6 bg-muted/20">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <FileText size={26} className="text-primary" />
        </div>
        {iframeFailed ? (
          <>
            <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-body">
              <AlertTriangle size={12} /> Aperçu inline indisponible
            </div>
            <p className="text-sm font-body text-muted-foreground leading-snug">
              Le navigateur n'arrive pas à afficher le PDF dans l'app. Tap pour l'ouvrir dans un nouvel onglet.
            </p>
          </>
        ) : (
          <p className="text-sm font-body text-muted-foreground leading-snug">
            iOS gère mieux les PDFs hors de l'app. Tape pour l'ouvrir avec le lecteur du système.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch">
          <Button asChild className="flex-1">
            <a href={viewUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} className="mr-1.5" />
              Ouvrir le PDF
            </a>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <a href={viewUrl} download>
              <Download size={14} className="mr-1.5" />
              Télécharger
            </a>
          </Button>
        </div>
      </div>
    </div>
  );

  // No `sandbox` attribute on purpose: Chrome's built-in PDF viewer is wired
  // up as a sub-process that refuses to load inside any sandboxed frame
  // (net::ERR_BLOCKED_BY_CLIENT, even with allow-scripts allow-same-origin).
  const iframe = (
    <iframe
      key={viewUrl}
      src={viewUrl}
      className="flex-1 w-full bg-muted/30 border-0"
      title={title}
      onLoad={handleIframeLoad}
      onError={handleIframeError}
    />
  );

  const body = skipIframe || iframeFailed ? fallback : iframe;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[94vh] font-body p-0">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <div className="flex flex-col h-full">
            {header}
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[88vh] p-0 font-body gap-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {header}
        {body}
      </DialogContent>
    </Dialog>
  );
}
