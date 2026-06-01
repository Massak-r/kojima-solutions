import { apiFetch } from './client';
import type { ObjectiveSource } from './objectiveSource';

export type SessionAccuracy = 'faster' | 'on_target' | 'slower';

export interface ObjectiveSession {
  id:          string;
  source:      ObjectiveSource;
  objectiveId: string;
  subtaskId?:  string | null;
  /** All subtasks credited by this session. The first id matches subtaskId. */
  subtaskIds:  string[];
  startedAt:   string;
  endedAt?:    string | null;
  durationSec?: number | null;
  note?:       string | null;
  accuracy?:   SessionAccuracy | null;
  /** Set when the session has been attached to a quote/invoice via the
   *  "Importer le temps tracé" flow. Once billed, the session no longer
   *  surfaces in suggest_quote_lines. */
  billedAt?:      string | null;
  billedQuoteId?: string | null;
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
  /** Optional. If provided, populates the session-subtask pivot so several
   *  projects can be credited from the same session. subtaskId stays in
   *  sync with subtaskIds[0] for legacy consumers. */
  subtaskIds?: string[];
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

/** Replace the subtasks credited by a session. Driven by the post-stop retro. */
export function attributeSubtasks(id: string, subtaskIds: string[]) {
  return apiFetch<ObjectiveSession>(`objective_sessions.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ subtaskIds }),
  });
}

export function getWeekSummary(source: ObjectiveSource, objectiveId: string) {
  return apiFetch<WeekSummary>(`objective_sessions.php?source=${source}&objective_id=${objectiveId}&summary=week`);
}

/** Global focus summary across all objectives for the current ISO week. */
export function getGlobalWeekSummary() {
  return apiFetch<GlobalWeekSummary>('objective_sessions.php?summary=week&all=1');
}

export interface WeeksSummary {
  weeks: { weekStart: string; totalSec: number; sessionCount: number }[];
  byObjective: { source: ObjectiveSource; objectiveId: string; sec: number; sessionCount: number }[];
  rangeStart: string;
}

/** Per-week focus totals across all objectives for the last `n` ISO weeks. */
export function getWeeksSummary(n = 8) {
  return apiFetch<WeeksSummary>(`objective_sessions.php?summary=weeks&all=1&n=${n}`);
}

export interface UnbilledProjectRow {
  projectId:     string;
  projectTitle:  string;
  sessions:      number;
  durationSec:   number;
  hours:         number;
  lastSessionAt: string | null;
}

export interface UnbilledSummary {
  projects:     UnbilledProjectRow[];
  totalSec:     number;
  totalHours:   number;
  projectCount: number;
}

/** Aggregate unbilled focus time per linked project. Used by the
 *  "Heures non facturées" insight card on Home. */
export function getUnbilledSummary() {
  return apiFetch<UnbilledSummary>('objective_sessions.php?summary=unbilled');
}

/** Lock a batch of sessions against a quote so they stop surfacing in
 *  suggest_quote_lines. Called by the "Importer le temps tracé" flow. */
export function markSessionsBilled(sessionIds: string[], quoteId: string) {
  return apiFetch<{ ok: true; count: number }>(
    'objective_sessions.php?action=mark_billed',
    { method: 'POST', body: JSON.stringify({ sessionIds, quoteId }) },
  );
}

/** Reverse markSessionsBilled for all sessions previously attached to this
 *  quote. Triggered when a quote/invoice gets deleted, so the underlying
 *  focus time becomes billable again. */
export function unmarkSessionsBilled(quoteId: string) {
  return apiFetch<{ ok: true }>(
    'objective_sessions.php?action=unmark_billed',
    { method: 'POST', body: JSON.stringify({ quoteId }) },
  );
}
