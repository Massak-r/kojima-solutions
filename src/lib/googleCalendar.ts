// One-click "Add to Google Calendar" link builder. Opens Google Calendar's
// event-compose screen (action=TEMPLATE) pre-filled — one tap on desktop or in
// the Android app, then Save. No OAuth, no setup; the event lands on the user's
// OWN calendar, so their normal notifications fire (a subscribed feed wouldn't
// ping).
//
// Limitation: the TEMPLATE URL has no reminder parameter, so the saved event
// uses the calendar's default notification timing. We create an all-day event
// on the due date and put the action + amount in the title so it reads at a
// glance. Custom lead-time reminders would need the Calendar API (OAuth) or an
// .ics with VALARM — deliberately out of scope for this lightweight version.

export interface CalendarEvent {
  title: string;
  /** All-day date, YYYY-MM-DD. */
  date: string;
  details?: string;
  location?: string;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD → YYYYMMDD, or null if the input isn't a valid ISO date. */
function compactDate(iso: string): string | null {
  const m = ISO_RE.exec(iso.trim());
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** All-day events are end-exclusive: an event "on" D spans D → D+1 (handles
 *  month/year rollover via UTC arithmetic). */
function endExclusive(iso: string): string | null {
  const m = ISO_RE.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Build the Google Calendar compose URL for an all-day event, or null if the
 *  date is missing/invalid (caller can then render nothing). */
export function buildGoogleCalendarUrl(event: CalendarEvent): string | null {
  const start = compactDate(event.date);
  const end = endExclusive(event.date);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.details) params.set("details", event.details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
