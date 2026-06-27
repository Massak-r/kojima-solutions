import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const reloadedRef = useRef(false);

  useEffect(() => {
    function onUpdate(e: Event) {
      setReg((e as CustomEvent).detail?.registration ?? null);
      setShow(true);
    }
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  function reloadOnce() {
    if (reloadedRef.current) return;
    reloadedRef.current = true;
    window.location.reload();
  }

  function handleUpdate() {
    if (reg?.waiting) {
      // Tell the waiting worker to take over. main.tsx already listens for the
      // resulting `controllerchange` and reloads — we keep a single fallback in
      // case that event never fires (no double reload thanks to reloadOnce).
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      setTimeout(reloadOnce, 1000);
    } else {
      // No worker waiting (edge case) — just reload to pull fresh assets.
      reloadOnce();
    }
  }

  // Shown to everyone — admins, clients, and anonymous visitors on the public
  // site all benefit from dropping a stale bundle. The service worker only
  // fires `sw-update-available` once a new build is actually waiting, so this
  // never nags without a real update behind it.

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          // Mobile: sits above the FAB (bottom-24) and above the BottomNav so
          // it never collides with either. Desktop: keep the small offset.
          className="fixed bottom-40 md:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-lg max-w-md mx-auto sm:mx-0"
        >
          <RefreshCw size={16} className="text-primary shrink-0" />
          <span className="text-sm font-body text-foreground">
            Nouvelle version disponible
          </span>
          <Button
            size="sm"
            className="text-xs h-8 px-4 rounded-lg shrink-0"
            onClick={handleUpdate}
          >
            Mettre à jour
          </Button>
          <button
            onClick={() => setShow(false)}
            className="text-muted-foreground/40 hover:text-foreground transition-colors text-xs ml-1"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
