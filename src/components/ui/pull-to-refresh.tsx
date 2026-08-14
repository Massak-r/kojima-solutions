import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

/**
 * Pull down to refresh — the gesture that, more than any styling, tells a
 * finger it is holding an app rather than a page.
 *
 * Touch-only by construction, so desktop is untouched. It arms only when the
 * window is already scrolled to the top, and calls preventDefault once the
 * pull is real, which keeps normal scrolling and the browser's own overscroll
 * out of the way. Drag distance is halved so the sheet feels weighted instead
 * of sticking to the thumb.
 */

const THRESHOLD = 72;
const MAX_PULL = 110;
/** Keeps the spinner on screen long enough to read as an answer, not a flicker. */
const MIN_SPIN_MS = 450;

interface Props {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reduceMotion = useReducedMotion();

  // Handlers are attached natively (touchmove must be non-passive to be able to
  // preventDefault), so they read live values through refs rather than state.
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const buzzed = useRef(false);

  const setPullBoth = useCallback((v: number) => {
    pullRef.current = v;
    setPull(v);
  }, []);

  const run = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    setPullBoth(52);
    haptic("success");
    const started = Date.now();
    try {
      await onRefresh();
    } catch {
      /* a failed refresh should still release the gesture */
    } finally {
      const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started));
      setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullBoth(0);
      }, wait);
    }
  }, [onRefresh, setPullBoth]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) { armed.current = false; return; }
      // Only from the very top — otherwise this would hijack a normal scroll.
      armed.current = window.scrollY <= 0;
      startY.current = armed.current ? e.touches[0].clientY : null;
      buzzed.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed.current || startY.current === null || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        if (pullRef.current !== 0) setPullBoth(0);
        return;
      }
      const next = Math.min(MAX_PULL, delta * 0.5);
      if (next > 4) e.preventDefault(); // suppress native overscroll / rubber-band
      setPullBoth(next);
      if (next >= THRESHOLD && !buzzed.current) { buzzed.current = true; haptic("tap"); }
      if (next < THRESHOLD) buzzed.current = false;
    };

    const onEnd = () => {
      if (!armed.current || refreshingRef.current) return;
      armed.current = false;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) void run();
      else setPullBoth(0);
    };

    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd, { passive: true });
    node.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, [run, setPullBoth]);

  const ready = pull >= THRESHOLD;
  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Indicator, revealed by the pull itself */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
        style={{ height: pull, opacity: progress }}
        aria-hidden={!refreshing}
      >
        <div
          className={cn(
            "mt-2 flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-sm transition-colors",
            ready || refreshing ? "border-primary/40 text-primary" : "border-border text-muted-foreground",
          )}
          style={{ transform: `scale(${0.7 + progress * 0.3})` }}
        >
          {refreshing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowDown
              size={16}
              className="transition-transform duration-200"
              style={{ transform: ready ? "rotate(180deg)" : "none" }}
            />
          )}
        </div>
      </div>

      <motion.div
        animate={{ y: pull }}
        transition={
          // While the finger drives it, follow instantly; on release, spring back.
          pull === 0 || refreshing
            ? (reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 })
            : { duration: 0 }
        }
      >
        {children}
      </motion.div>

      <span role="status" aria-live="polite" className="sr-only">
        {refreshing ? "Actualisation en cours" : ""}
      </span>
    </div>
  );
}
