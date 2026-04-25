import { useLocation } from "react-router-dom";
import { ReactNode, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Wraps route content with a simple fade-in on navigation.
 * No exit animation = no white flash between pages.
 *
 * Moves focus to the page region on route change so screen readers
 * announce the new page. outline is none so mouse users see nothing.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Defer to next frame so the transition has started before we move focus.
    const id = requestAnimationFrame(() => {
      regionRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <AnimatePresence>
      <motion.div
        ref={regionRef}
        key={pathname}
        id="page-main"
        role="main"
        tabIndex={-1}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="outline-none"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
