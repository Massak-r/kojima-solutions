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

/** Flag (or unflag) a note for Claude processing. Pass null/empty to clear.
 *  Atomic — doesn't touch title/content/date. */
export async function setMeetingNoteClaudeIntent(
  id: string,
  intent: string | null,
): Promise<MeetingNote> {
  return apiFetch<MeetingNote>(`meeting_notes.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify({ claudeIntent: intent }),
  });
}

export async function deleteMeetingNote(id: string): Promise<void> {
  await apiFetch(`meeting_notes.php?id=${id}`, { method: "DELETE" });
}
