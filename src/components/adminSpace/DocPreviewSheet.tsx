import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { ExternalLink } from "lucide-react";

interface DocPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  viewUrl: string;
}

/**
 * In-app PDF viewer. Keeps the user inside the PWA standalone shell instead of
 * bouncing them to the system browser. Drawer on mobile (slides up almost
 * full-screen), centered dialog on desktop. iOS Safari is flaky with PDF
 * iframes, so a prominent "Onglet" link is always available in the header as a
 * fallback.
 */
export function DocPreviewSheet({ open, onOpenChange, title, viewUrl }: DocPreviewSheetProps) {
  const isMobile = useIsMobile();

  const header = (
    // pr-12 keeps the dialog's built-in close X (top-right corner) from
    // overlapping the "Onglet" link.
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-background/95 shrink-0 pr-12">
      <p className="font-body text-sm font-medium flex-1 truncate">{title}</p>
      <a
        href={viewUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-body text-primary hover:underline inline-flex items-center gap-1 shrink-0"
      >
        <ExternalLink size={12} /> Onglet
      </a>
    </div>
  );

  // No `sandbox` attribute on purpose: Chrome's built-in PDF viewer is wired
  // up as a sub-process that refuses to load inside any sandboxed frame
  // (net::ERR_BLOCKED_BY_CLIENT, even with allow-scripts allow-same-origin).
  // Defense-in-depth instead lives server-side: admin_files.php only serves
  // files matching `^UUID\.pdf$` and admin_docs.php validates PDF magic
  // bytes on upload, so an HTML payload can't be smuggled into this iframe.
  const iframe = (
    <iframe
      src={viewUrl}
      className="flex-1 w-full bg-muted/30 border-0"
      title={title}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[94vh] font-body p-0">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <div className="flex flex-col h-full">
            {header}
            {iframe}
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
        {iframe}
      </DialogContent>
    </Dialog>
  );
}
