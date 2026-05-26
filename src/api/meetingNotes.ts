import { apiFetch } from "./client";

export interface MeetingNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  meetingDate: string;
  createdAt: string;
  /** Free-form intent string set when the operator sends this note to
   *  Claude Code via MCP ("Extract todos", "Summarize", etc.). Cleared
   *  to null once Claude finishes processing. */
  claudeIntent: string | null;
  claudeRequestedAt: string | null;
  /** Pre-picked target for the conversion: the objective under which
   *  the subtasks/decisions should land. Null when intent doesn't need
   *  a target (e.g. "summarize for client") or when the operator skipped
   *  the picker. */
  claudeTargetObjectiveId: string | null;
}

export async function listMeetingNotes(projectId: string): Promise<MeetingNote[]> {
  return apiFetch<MeetingNote[]>(`meeting_notes.php?project_id=${projectId}`);
}

/** Every meeting note flagged for Claude processing, across all projects.
 *  Powers the /process-meeting-notes skill via the MCP server. */
export async function listMeetingNotesPendingClaude(): Promise<MeetingNote[]> {
  return apiFetch<MeetingNote[]>("meeting_notes.php?pending_claude=1");
}

export async function createMeetingNote(data: {
  projectId: string;
  title: string;
  content: string;
  meetingDate: string;
}): Promise<MeetingNote> {
  return apiFetch<MeetingNote>("meeting_notes.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMeetingNote(
  id: string,
  data: { title?: string; content?: string; meetingDate?: string }
): Promise<MeetingNote> {
  return apiFetch<MeetingNote>(`meeting_notes.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Flag (or unflag) a note for Claude processing. Pass null/empty for the
 *  intent to clear (target is wiped server-side at the same time). The
 *  target objective is optional — set it when the intent needs a
 *  destination (extract actions, extract decisions). Atomic — doesn't
 *  touch title/content/date. */
export async function setMeetingNoteClaudeIntent(
  id: string,
  intent: string | null,
  targetObjectiveId: string | null = null,
): Promise<MeetingNote> {
  return apiFetch<MeetingNote>(`meeting_notes.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify({
      claudeIntent: intent,
      claudeTargetObjectiveId: targetObjectiveId,
    }),
  });
}

export async function deleteMeetingNote(id: string): Promise<void> {
  await apiFetch(`meeting_notes.php?id=${id}`, { method: "DELETE" });
}
