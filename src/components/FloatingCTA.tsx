import { useLanguage } from "@/hooks/useLanguage";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

const FloatingCTA = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [showBadge, setShowBadge] = useState(true);

  // Show after scrolling 400px
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-hide badge after 5s
  useEffect(() => {
    if (visible && showBadge) {
      const timer = setTimeout(() => setShowBadge(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [visible, showBadge]);

  function scrollToContact() {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 80 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-1.5 no-print"
        >
          {/* Free session badge */}
          <AnimatePresence>
            {showBadge && (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-[10px] font-body font-semibold bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm"
              >
                {t("Séance gratuite", "Free session")}
              </motion.span>
            )}
          </AnimatePresence>

          <a
            href="/intake"
            className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-display font-medium rounded-full btn-primary-glow shadow-lg hover:scale-105 transition-transform text-sm"
          >
            <span className="text-xs sm:text-sm">{t("Estimer", "Estimate")}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={scrollToContact}
            className="text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("ou écrivez-nous", "or contact us")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingCTA;
