import { apiFetch } from "./client";

export interface InboxCapture {
  id: string;
  source: "admin" | "personal";
  text: string;
  project_hint: string | null;
  created_at: string;
  triaged_at: string | null;
  triaged_destination: string | null;
}

export interface InboxList {
  pendingCount: number;
  items: InboxCapture[];
}

export type InboxStatus = "pending" | "triaged" | "all";

/** Fetch captures plus the live pending count. Default = admin / pending. */
export function listInboxCaptures(opts?: { status?: InboxStatus; source?: "admin" | "personal"; limit?: number }): Promise<InboxList> {
  const params = new URLSearchParams({
    status: opts?.status ?? "pending",
    source: opts?.source ?? "admin",
    limit:  String(opts?.limit ?? 100),
  });
  return apiFetch<InboxList>(`inbox.php?${params}`);
}

/** Add a quick capture. project_hint is a freeform tag, not a strict reference. */
export function addInboxCapture(text: string, opts?: { projectHint?: string; source?: "admin" | "personal" }): Promise<InboxCapture> {
  return apiFetch<InboxCapture>("inbox.php", {
    method: "POST",
    body: JSON.stringify({
      text,
      projectHint: opts?.projectHint,
      source: opts?.source ?? "admin",
    }),
  });
}

/** Mark a capture as triaged. `destination` is a free-form audit label like
 *  "subtask:PASC 2026 / Email send 16 mai". */
export function markCaptureTriaged(id: string, destination: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`inbox.php?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ triaged: true, destination }),
  });
}

export function deleteInboxCapture(id: string): Promise<void> {
  return apiFetch<void>(`inbox.php?id=${id}`, { method: "DELETE" });
}
