import { apiFetch } from "./client";

/** Optional 1-tap capture type, set at capture time to pre-seed triage. */
export type CaptureKind = "idea" | "todo" | "note" | "urgent";

export interface InboxCapture {
  id: string;
  source: "admin" | "personal";
  text: string;
  kind: CaptureKind | null;
  /** Friendly label of the app section the capture was made from (e.g.
   *  "Trésorerie"). Null when captured from /home or a project page (the
   *  latter carries project_hint instead). */
  context: string | null;
  project_hint: string | null;
  /** UTC datetime until which the capture is hidden from the pending list, or
   *  null. While set in the future the capture appears only in the snoozed view. */
  snoozed_until: string | null;
  created_at: string;
  triaged_at: string | null;
  triaged_destination: string | null;
}

export interface InboxList {
  pendingCount: number;
  items: InboxCapture[];
}

export type InboxStatus = "pending" | "triaged" | "snoozed" | "all";

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
export function addInboxCapture(text: string, opts?: { projectHint?: string; source?: "admin" | "personal"; kind?: CaptureKind; context?: string }): Promise<InboxCapture> {
  return apiFetch<InboxCapture>("inbox.php", {
    method: "POST",
    body: JSON.stringify({
      text,
      projectHint: opts?.projectHint,
      source: opts?.source ?? "admin",
      kind: opts?.kind,
      context: opts?.context,
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

/** Snooze a capture: hide it from the pending list until `untilISO` (an ISO
 *  datetime). digest.php fires a push and brings it back when the time passes. */
export function snoozeCapture(id: string, untilISO: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`inbox.php?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ snoozedUntil: untilISO }),
  });
}

/** Cancel a snooze — bring the capture straight back to the pending list. */
export function unsnoozeCapture(id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`inbox.php?id=${id}`, {
    method: "PATCH",
    body: JSON.stringify({ snoozedUntil: null }),
  });
}

export function deleteInboxCapture(id: string): Promise<void> {
  return apiFetch<void>(`inbox.php?id=${id}`, { method: "DELETE" });
}
