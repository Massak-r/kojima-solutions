import { apiFetch } from "./client";

export interface MeetingNote {
  id: string;
  projectId: string;
  title: string;
  content: string;
  meetingDate: string;
  createdAt: string;
}

export async function listMeetingNotes(projectId: string): Promise<MeetingNote[]> {
  return apiFetch<MeetingNote[]>(`meeting_notes.php?project_id=${projectId}`);
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

export async function deleteMeetingNote(id: string): Promise<void> {
  await apiFetch(`meeting_notes.php?id=${id}`, { method: "DELETE" });
}
