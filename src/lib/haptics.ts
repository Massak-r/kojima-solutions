/**
 * Tiny haptic helper — `navigator.vibrate`, a no-op where unsupported
 * (desktop, iOS Safari). Haptics are seasoning: keep pulses short and reserve
 * them for committing actions (complete, add, swipe), not every tap.
 */
type HapticKind = "tap" | "success" | "warn";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: 14,
  warn: [10, 40, 10],
};

export function haptic(kind: HapticKind = "tap"): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch {
    /* vibration not available — silently ignore */
  }
}
