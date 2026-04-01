import { useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Wraps route content with a simple fade-in on navigation.
 * No exit animation = no white flash between pages.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
