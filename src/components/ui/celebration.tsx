import { useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

/**
 * A brief, on-brand celebration overlay — a blooming check + a soft particle
 * burst in the palette colours (not garish confetti). Earned reward moments:
 * clearing the day, finishing a project. Auto-dismisses; tap to skip.
 * Respects prefers-reduced-motion (drops the particle burst).
 */

const PARTICLE_COLORS = [
  "bg-primary", "bg-palette-sage", "bg-palette-amber", "bg-palette-violet", "bg-palette-rose",
];

interface CelebrationProps {
  show: boolean;
  title: string;
  subtitle?: string;
  onDone: () => void;
  durationMs?: number;
}

export function Celebration({ show, title, subtitle, onDone, durationMs = 2800 }: CelebrationProps) {
  const reduce = useReducedMotion();

  // Fresh particle field each time we celebrate.
  const particles = useMemo(() => {
    if (!show) return [];
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 90 + Math.random() * 80;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        size: 6 + Math.random() * 7,
        delay: Math.random() * 0.12,
      };
    });
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [show, durationMs, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/10 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="relative flex flex-col items-center text-center px-8"
            initial={{ scale: 0.9, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            {!reduce && particles.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden
                className={`absolute top-1/2 left-1/2 rounded-full ${p.color}`}
                style={{ width: p.size, height: p.size }}
                initial={{ x: -p.size / 2, y: -p.size / 2, opacity: 0, scale: 0 }}
                animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: [0, 1, 0.5] }}
                transition={{ duration: 1.15, delay: p.delay, ease: "easeOut" }}
              />
            ))}

            <motion.div
              className="w-20 h-20 rounded-full bg-card shadow-overlay flex items-center justify-center mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
            >
              <CheckCircle2 size={44} className="text-emerald-500" />
            </motion.div>

            <motion.h2
              className="font-display text-2xl font-bold text-foreground"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              {title}
            </motion.h2>
            {subtitle && (
              <motion.p
                className="mt-1 font-body text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.22 }}
              >
                {subtitle}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
