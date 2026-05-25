import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideToConfirmProps {
  label: string;
  confirmingLabel?: string;
  confirmedLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Called once the user slides past the threshold. */
  onConfirm: () => void;
  className?: string;
}

/**
 * Slide-to-confirm gesture, à la iOS "slide to unlock". For destructive or
 * commitment-style actions (voting on a project direction, approving a
 * gate) — a deliberate horizontal drag instead of a tap makes the
 * "I really mean this" intent unambiguous and fits the thumb-natural
 * motion of holding a phone in one hand.
 *
 * - Tracks pointer drag on the handle. Past 70% of the track width, fires
 *   onConfirm; otherwise springs back.
 * - Subtle haptic at 30% (Vibration API where supported).
 * - Pointer/touch sensors both work (mobile + desktop).
 */
export function SlideToConfirm({
  label,
  confirmingLabel,
  confirmedLabel,
  loading = false,
  disabled = false,
  onConfirm,
  className,
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [completed, setCompleted] = useState(false);
  const buzzed = useRef(false);

  // Handle is 48 px wide; the draggable range ends 48 px before the right edge.
  const HANDLE = 48;
  const dragMax = Math.max(trackWidth - HANDLE - 8, 0);
  const threshold = dragMax * 0.7;

  // The label fades out + the success fill grows as the handle moves right.
  const labelOpacity = useTransform(x, [0, dragMax * 0.5], [1, 0]);
  const fillWidth = useTransform(x, (v) => `${Math.max(v + HANDLE, 0)}px`);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (disabled || loading || completed) return;
    if (info.offset.x >= threshold) {
      setCompleted(true);
      x.set(dragMax);
      onConfirm();
    } else {
      x.set(0);
      buzzed.current = false;
    }
  }

  function handleDrag(_e: unknown, info: PanInfo) {
    if (info.offset.x >= threshold * 0.5 && !buzzed.current) {
      buzzed.current = true;
      try { navigator.vibrate?.(8); } catch { /* ignore */ }
    }
  }

  const showConfirming = loading || completed;
  const displayLabel = showConfirming
    ? (loading ? (confirmingLabel ?? label) : (confirmedLabel ?? label))
    : label;

  return (
    <div
      ref={(el) => {
        trackRef.current = el;
        if (el && trackWidth !== el.offsetWidth) {
          setTrackWidth(el.offsetWidth);
        }
      }}
      className={cn(
        "relative h-12 rounded-full overflow-hidden select-none",
        "bg-secondary/60 border border-border/60",
        disabled && "opacity-40",
        className,
      )}
      aria-disabled={disabled}
    >
      {/* Green fill that grows behind the handle as it slides right. */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 bg-primary/90"
        style={{ width: fillWidth }}
      />

      {/* Label sits centred behind the handle; fades as drag progresses. */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: showConfirming ? 1 : labelOpacity }}
      >
        <span className={cn(
          "text-sm font-body font-medium",
          showConfirming ? "text-primary-foreground" : "text-muted-foreground",
        )}>
          {displayLabel}
        </span>
      </motion.div>

      {/* Confirmed/loading label that appears once the handle reaches the end. */}
      {showConfirming && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-body font-semibold text-primary-foreground inline-flex items-center gap-1.5">
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <Check size={14} />}
            {displayLabel}
          </span>
        </div>
      )}

      {/* The draggable handle. */}
      <motion.button
        type="button"
        drag={disabled || loading || completed ? false : "x"}
        dragConstraints={{ left: 0, right: dragMax }}
        dragElastic={0.05}
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "absolute left-1 top-1 h-10 w-10 rounded-full",
          "flex items-center justify-center",
          "bg-primary text-primary-foreground shadow-md",
          "touch-none cursor-grab active:cursor-grabbing",
          (disabled || loading || completed) && "cursor-default",
        )}
        aria-label={label}
      >
        {completed
          ? <Check size={18} />
          : loading
            ? <Loader2 size={18} className="animate-spin" />
            : <ArrowRight size={18} />}
      </motion.button>
    </div>
  );
}
