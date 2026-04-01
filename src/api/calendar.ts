import { apiFetch } from "./client";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string | null;
  htmlLink?: string | null;
}

interface CreateEventData {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
}

const CACHE_KEY = "kojima-calendar-cache";

function cacheEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events, ts: Date.now() }));
  } catch {}
}

export function getCachedEvents(): { events: CalendarEvent[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listEvents(
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  try {
    const events = await apiFetch<CalendarEvent[]>(
      `calendar.php?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
    );
    cacheEvents(events);
    return events;
  } catch (err) {
    // Offline fallback: return cached events
    const cached = getCachedEvents();
    if (cached) return cached.events;
    throw err;
  }
}

export async function createEvent(data: CreateEventData): Promise<CalendarEvent> {
  const event = await apiFetch<CalendarEvent>("calendar.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
  // Invalidate cache
  localStorage.removeItem(CACHE_KEY);
  return event;
}

export async function updateEvent(
  id: string,
  data: Partial<CreateEventData>,
): Promise<CalendarEvent> {
  const event = await apiFetch<CalendarEvent>(`calendar.php?id=${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  localStorage.removeItem(CACHE_KEY);
  return event;
}

export async function deleteEvent(id: string): Promise<void> {
  await apiFetch<{ ok: true }>(`calendar.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  localStorage.removeItem(CACHE_KEY);
}
