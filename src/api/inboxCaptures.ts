import { apiFetch } from "./client";

/** Optional 1-tap capture type, set at capture time to pre-seed triage. */
export type CaptureKind = "idea" | "todo" | "note" | "urgent";

export interface InboxCapture {
  id: string;
  source: "admin" | "personal";
  text: string;
  kind: CaptureKind | null;
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

/** Add a quick capture. project_hint is a freeform tag, not a strict reference.
 *  kind is an optional capture type used to pre-seed triage. */
export function addInboxCapture(text: string, opts?: { projectHint?: string; source?: "admin" | "personal"; kind?: CaptureKind }): Promise<InboxCapture> {
  return apiFetch<InboxCapture>("inbox.php", {
    method: "POST",
    body: JSON.stringify({
      text,
      projectHint: opts?.projectHint,
      source: opts?.source ?? "admin",
      kind: opts?.kind,
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

/** Revert a triage: set the capture back to pending (triaged_at → NULL).
 *  Backs the inbox undo toast so a mis-routed capture returns immediately. */
export function untriageCapture(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`inbox.php?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ triaged: false }),
  });
}

/** Edit the capture text in place (rare — usually only to clean up a typo). */
export function updateCaptureText(id: string, text: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`inbox.php?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

export function deleteInboxCapture(id: string): Promise<void> {
  return apiFetch<void>(`inbox.php?id=${id}`, { method: "DELETE" });
}
