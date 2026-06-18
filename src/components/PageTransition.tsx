import { useLocation } from "react-router-dom";
import { ReactNode, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Wraps route content with a simple fade-in on navigation.
 * No exit animation = no white flash between pages.
 *
 * A keyed motion.div (NOT AnimatePresence) is deliberate: with no exit
 * animation, AnimatePresence had nothing to wait on, and when the routed
 * page re-rendered frequently (e.g. QuoteForm's ResizeObserver), it failed
 * to drop the exiting copy — stacking a stale clone of the whole page per
 * navigation. Changing the key remounts the page and fades it in cleanly.
 *
 * Moves focus to the page region on route change so screen readers
 * announce the new page. outline is none so mouse users see nothing.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const regionRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Defer to next frame so the transition has started before we move focus.
    const id = requestAnimationFrame(() => {
      regionRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <motion.div
      ref={regionRef}
      key={pathname}
      id="page-main"
      role="main"
      tabIndex={-1}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="outline-none"
    >
      {children}
    </motion.div>
  );
}
