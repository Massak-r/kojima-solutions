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
