import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function UpdateBanner() {
  const { isAdmin } = useAuth();
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    function onUpdate(e: Event) {
      setReg((e as CustomEvent).detail?.registration ?? null);
      setShow(true);
    }
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  function handleUpdate() {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    // Wait for the new SW to take over, then reload
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    // Fallback: reload after 1s if controllerchange never fires
    setTimeout(() => window.location.reload(), 1000);
  }

  // Admins only — web users also benefit from knowing to refresh.
  if (!isAdmin) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-24 md:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-lg max-w-md mx-auto sm:mx-0"
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
