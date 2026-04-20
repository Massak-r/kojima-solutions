import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

const ADMIN_PREFIXES = [
  "/space", "/projects", "/project/", "/quotes", "/quote/",
  "/clients", "/accounting", "/tresorerie", "/documents",
];

const DISMISSED_KEY = "kojima-pwa-install-dismissed";

/**
 * Shows a non-intrusive install banner on mobile admin pages
 * when the PWA can be installed (Chrome/Edge beforeinstallprompt)
 * or on iOS (manual instructions).
 */
export default function InstallPrompt() {
  const { pathname } = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const isAdminPage = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isStandalone) return;
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Don't show again for 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Chrome/Edge: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show manual instructions after a delay
    if (ios) {
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  };

  if (!isAdminPage || isStandalone || !showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed bottom-20 left-3 right-3 z-40 md:hidden no-print"
      >
        <div className="glass-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Download size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-tight">
              Installer Kojima Space
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              {isIOS
                ? "Appuyer sur Partager puis « Sur l'écran d'accueil »"
                : "Accès rapide depuis l'écran d'accueil"}
            </p>
          </div>
          {!isIOS && deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium transition-colors hover:bg-primary/90"
            >
              Installer
            </button>
          ) : null}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
