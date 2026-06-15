import { apiFetch } from "./client";

export interface PushReminder {
  id: string;
  title: string;
  body: string | null;
  url: string;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
}

/** Upcoming (not-yet-sent) reminders by default, soonest first. */
export function listReminders(status: "upcoming" | "all" = "upcoming"): Promise<{ items: PushReminder[] }> {
  return apiFetch<{ items: PushReminder[] }>(`push_reminders.php?status=${status}`);
}

/** Schedule a reminder. `scheduledAt` is an ISO datetime; the cron fires it
 *  (granularity ~20 min) once it's due, as a push notification. */
export function createReminder(data: { title: string; body?: string; url?: string; scheduledAt: string }): Promise<PushReminder> {
  return apiFetch<PushReminder>("push_reminders.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteReminder(id: string): Promise<void> {
  return apiFetch<void>(`push_reminders.php?id=${id}`, { method: "DELETE" });
}
