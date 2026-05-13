import { apiFetch } from "./client";

export interface WeeklyRecap {
  exists: boolean;
  id?: string;
  iso_year: number;
  iso_week: number;
  content_md?: string;
  generated_at?: string;
  dismissed_at?: string | null;
}

/** Fetch the recap for the current ISO week (or a specific year/week). */
export function getWeeklyRecap(opts?: { isoYear: number; isoWeek: number }): Promise<WeeklyRecap> {
  const q = opts
    ? `?year=${opts.isoYear}&week=${opts.isoWeek}`
    : "?week=current";
  return apiFetch<WeeklyRecap>(`weekly_recap.php${q}`);
}

/** Mark the current week's recap as dismissed so it won't auto-pop next session. */
export function dismissCurrentRecap(): Promise<{ dismissed: boolean }> {
  return apiFetch<{ dismissed: boolean }>("weekly_recap.php?week=current&dismiss=1", {
    method: "PATCH",
  });
}
