import { apiFetch } from "./client";

export interface NotificationPrefs {
  /** Send the once-daily admin pulse push. */
  adminPulseEnabled: boolean;
  /** Local hour (0-23) from which the daily pulse may fire. */
  pulseHour: number;
  /** Quiet-hours window (local hours): no pushed notifications in [quietStart, quietEnd). */
  quietStart: number;
  quietEnd: number;
  /** How many days before its due date an obligation starts being announced. */
  pulseLeadDays: number;
  /** `digest` = one grouped push; `per_task` = one push per obligation (max 5). */
  pulseStyle: "digest" | "per_task";
  /** Dedicated push for a big outgoing payment, outside the pulse's 5-item cap. */
  paymentAlertEnabled: boolean;
  /** CHF floor above which a payable earns its own alert. 0 = every committed one. */
  paymentAlertMinAmount: number;
  /** Days before the due date the "à préparer" alert fires. */
  paymentAlertLeadDays: number;
}

export function getNotificationPrefs() {
  return apiFetch<NotificationPrefs>("notification_prefs.php");
}

export function updateNotificationPrefs(patch: Partial<NotificationPrefs>) {
  return apiFetch<NotificationPrefs>("notification_prefs.php", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export interface PushSendResult {
  /** Subscriptions the push was accepted for. 0 = no device is listening. */
  sent: number;
  failed: number;
  expired: number;
}

/** Send one push right now, so a broken subscription shows up immediately. */
export function sendTestPush() {
  return apiFetch<PushSendResult>("push_test.php", { method: "POST" });
}

export interface PushLogEntry {
  title: string;
  body: string | null;
  url: string | null;
  /** Devices the push service accepted it for. 0 = it reached nobody. */
  sent: number;
  failed: number;
  expired: number;
  createdAt: string;
}

export interface PushHealth {
  vapidConfigured: boolean;
  subscriptions: number;
  lastPush: PushLogEntry | null;
  recent: PushLogEntry[];
  /** One entry per day the daily pulse fired, most recent first. */
  pulseDays: { date: string; firedAt: string }[];
  lastReminder: { title: string; scheduledAt: string; sentAt: string } | null;
}

/** History of what actually left the server — the answer to "did it send?". */
export function getPushHealth() {
  return apiFetch<PushHealth>("push_health.php");
}

export interface PulsePreview {
  style: "digest" | "per_task";
  /** Everything the pulse would announce right now. 0 = it would stay silent. */
  count: number;
  title: string | null;
  body: string | null;
  /** One formatted line per obligation, in the order the pulse would use. */
  lines: string[];
  enabled: boolean;
  nextHour: number;
}

/** Compose the next pulse without sending it — a pulse is otherwise only
 *  observable once a day, at 8am, on a phone. */
export function getPulsePreview() {
  return apiFetch<PulsePreview>("digest.php?preview=pulse");
}
