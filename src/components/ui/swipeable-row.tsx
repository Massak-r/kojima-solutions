import { type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface SwipeableRowProps {
  children: ReactNode;
  /** Fires once the row is dragged past the threshold. */
  onSwipe: () => void;
  /** Gate the gesture (e.g. touch / mobile only). When false, renders children plain. */
  enabled?: boolean;
  /** Which way the content slides to reveal the action. */
  direction?: "left" | "right";
  actionLabel?: string;
  actionIcon?: ReactNode;
  /** Background + text colour of the revealed action panel. */
  actionClassName?: string;
  /** Opaque background of the sliding content (must hide the panel beneath). */
  contentClassName?: string;
  className?: string;
}

const THRESHOLD = 70;

/**
 * Touch-first swipeable row: drag the content sideways to reveal and trigger a
 * single action (complete, triage…). Pointer-drag based (framer-motion), so it
 * stays out of the way of taps and inner buttons. Desktop keeps its usual
 * click affordances — pass `enabled={isMobile}`.
 */
export function SwipeableRow({
  children,
  onSwipe,
  enabled = true,
  direction = "left",
  actionLabel,
  actionIcon,
  actionClassName = "bg-emerald-500 text-white",
  contentClassName = "bg-card",
  className,
}: SwipeableRowProps) {
  const x = useMotionValue(0);
  const toLeft = direction === "left";
  // Action panel fades in as the content clears it.
  const actionOpacity = useTransform(
    x,
    toLeft ? [-THRESHOLD, -8, 0] : [0, 8, THRESHOLD],
    toLeft ? [1, 0.35, 0] : [0, 0.35, 1],
  );

  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <motion.div
        aria-hidden
        style={{ opacity: actionOpacity }}
        className={cn(
          "absolute inset-y-0 flex items-center gap-1.5 px-4 text-xs font-body font-semibold",
          toLeft ? "right-0 justify-end" : "left-0 justify-start",
          actionClassName,
        )}
      >
        {actionIcon}
        {actionLabel}
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={toLeft ? { left: -110, right: 0 } : { left: 0, right: 110 }}
        dragElastic={0.06}
        style={{ x }}
        onDragEnd={(_e, info) => {
          const past = toLeft ? info.offset.x < -THRESHOLD : info.offset.x > THRESHOLD;
          if (past) {
            haptic("success");
            onSwipe();
            x.set(0); // reset in case the row stays mounted
          } else {
            animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
          }
        }}
        className={cn("relative", contentClassName)}
      >
        {children}
      </motion.div>
    </div>
  );
}
