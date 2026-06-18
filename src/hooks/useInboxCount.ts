import { useQuery } from "@tanstack/react-query";
import { listInboxCaptures, type InboxList } from "@/api/inboxCaptures";

/** Shared query key for the pending admin inbox-captures cache. Identical to
 *  the key InboxPanel uses, so the panel list and the nav badge dedupe one
 *  fetch and stay in sync through the same invalidations. */
export const INBOX_PENDING_KEY = ["inbox-captures", "admin", "pending"] as const;

/**
 * Shared pending-captures count. One fetch powers both the InboxPanel list and
 * the bottom-nav badge — react-query dedupes the request and keeps both in
 * sync. Pass `enabled: false` on surfaces that mount on non-admin pages (e.g.
 * the global bottom nav) so the request only fires on authenticated pages.
 */
export function useInboxCount(options: { enabled?: boolean } = {}) {
  const query = useQuery<InboxList>({
    queryKey: INBOX_PENDING_KEY,
    queryFn: () => listInboxCaptures({ status: "pending", source: "admin", limit: 50 }),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  });

  return {
    ...query,
    pendingCount: query.data?.pendingCount ?? 0,
  };
}
