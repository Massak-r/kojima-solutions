import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export type SessionAccuracy = 'faster' | 'on_target' | 'slower';

export interface ObjectiveSession {
  id:          string;
  source:      ObjectiveSource;
  objectiveId: string;
  subtaskId?:  string | null;
  startedAt:   string;
  endedAt?:    string | null;
  durationSec?: number | null;
  note?:       string | null;
  accuracy?:   SessionAccuracy | null;
}

export interface WeekSummary {
  totalSec:     number;
  sessionCount: number;
  byDay:        { date: string; sec: number }[];
  weekStart:    string;
}

export interface GlobalWeekSummary extends WeekSummary {
  byObjective: {
    source:       ObjectiveSource;
    objectiveId:  string;
    sec:          number;
    sessionCount: number;
  }[];
}

export function listSessions(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<ObjectiveSession[]>(`objective_sessions.php?source=${source}&objective_id=${objectiveId}`);
}

export function startSession(data: {
  source: ObjectiveSource;
  objectiveId: string;
  subtaskId?: string | null;
}) {
  return apiFetch<ObjectiveSession>('objective_sessions.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function stopSession(id: string, note?: string) {
  return apiFetch<ObjectiveSession>(`objective_sessions.php?id=${id}&action=stop`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
}

export function deleteSession(id: string) {
  return apiFetch<void>(`objective_sessions.php?id=${id}`, { method: 'DELETE' });
}

/** Patch retro fields (accuracy, note) on an already-stopped session. */
export function patchSession(id: string, data: { accuracy?: SessionAccuracy | null; note?: string | null }) {
  return apiFetch<ObjectiveSession>(`objective_sessions.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getWeekSummary(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<WeekSummary>(`objective_sessions.php?source=${source}&objective_id=${objectiveId}&summary=week`);
}

/** Global focus summary across all objectives for the current ISO week. */
export function getGlobalWeekSummary() {
  return apiFetch<GlobalWeekSummary>('objective_sessions.php?summary=week&all=1');
}
