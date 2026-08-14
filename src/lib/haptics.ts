/**
 * Tiny haptic helper — `navigator.vibrate`, a no-op where unsupported
 * (desktop, iOS Safari). Haptics are seasoning: keep pulses short and reserve
 * them for committing actions (complete, add, swipe), not every tap.
 *
 * Vibration is a physical interruption, so it stays opt-out: the preference
 * below is read on every call and honoured immediately, no reload needed.
 */
type HapticKind = "tap" | "success" | "warn";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: 14,
  warn: [10, 40, 10],
};

const PREF_KEY = "kojima-haptics";

/** Whether vibration is allowed. Defaults to on; only an explicit "off" mutes it. */
export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable — the default (on) stands for this session */
  }
}

/** True where the device can actually vibrate, so the setting can be hidden elsewhere. */
export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function haptic(kind: HapticKind = "tap"): void {
  try {
    if (hapticsSupported() && hapticsEnabled()) {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch {
    /* vibration not available — silently ignore */
  }
}
