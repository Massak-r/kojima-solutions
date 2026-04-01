import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = [
  "hsl(215 45% 30%)",   // primary indigo
  "hsl(258 28% 48%)",   // violet
  "hsl(145 20% 44%)",   // sage
  "hsl(36 42% 48%)",    // amber
  "hsl(348 30% 52%)",   // rose
];

interface ConfettiBurstProps {
  /** Number of particles */
  count?: number;
  /** Spread radius in px */
  spread?: number;
}

export function ConfettiBurst({ count = 24, spread = 280 }: ConfettiBurstProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * spread,
        y: -(Math.random() * spread * 0.7 + 40),
        rotate: Math.random() * 720 - 360,
        scale: Math.random() * 0.6 + 0.5,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.25,
        width: Math.random() > 0.5 ? 8 : 6,
        height: Math.random() > 0.5 ? 6 : 8,
      })),
    [count, spread],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-sm"
          style={{
            backgroundColor: p.color,
            width: p.width,
            height: p.height,
          }}
          initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: p.scale,
            rotate: p.rotate,
            opacity: 0,
          }}
          transition={{
            duration: 1.4,
            delay: p.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}
    </div>
  );
}
