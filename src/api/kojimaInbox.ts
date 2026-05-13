import { apiFetch } from "./client";

export interface InboxStats {
  pendingLines: number;
  totalLines: number;
  mtime: string | null;
}

/** Lightweight stats on `.kojima-journal/inbox.md` — used by the Monday brief
 *  popup to surface "X captures en attente" without slurping the full file. */
export function getInboxStats(): Promise<InboxStats> {
  return apiFetch<InboxStats>("kojima_inbox.php");
}
