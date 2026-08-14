import { apiFetch } from "./client";

export interface NotificationPrefs {
  /** Send the once-daily admin pulse push. */
  adminPulseEnabled: boolean;
  /** Local hour (0-23) from which the daily pulse may fire. */
  pulseHour: number;
  /** Quiet-hours window (local hours): no pushed notifications in [quietStart, quietEnd). */
  quietStart: number;
  quietEnd: number;
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
