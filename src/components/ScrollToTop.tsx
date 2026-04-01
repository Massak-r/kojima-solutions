import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";

const ADMIN_PREFIXES = [
  "/space", "/projects", "/project/", "/quotes", "/quote/",
  "/clients", "/accounting", "/personal", "/admin",
];

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const isAdminPage = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isAdminPage) return;
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isAdminPage]);

  if (!isAdminPage) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 md:bottom-6 left-4 z-40 w-9 h-9 flex items-center justify-center rounded-full glass-card border border-border/50 shadow-md text-muted-foreground hover:text-foreground transition-colors no-print"
          aria-label="Scroll to top"
        >
          <ChevronUp size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
