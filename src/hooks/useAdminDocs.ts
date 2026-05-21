import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listDocs, type AdminDocItem } from "@/api/adminDocs";

/** Shared query key for the admin-docs cache. */
export const ADMIN_DOCS_QUERY_KEY = ["admin-docs"] as const;

/**
 * Shared admin-documents cache. One fetch powers the triage tab, the
 * pending-docs banner and the bottom-nav badge — react-query dedupes the
 * request and keeps every consumer in sync. Pass `enabled: false` on surfaces
 * that mount on non-admin pages (e.g. the global bottom nav) so the request
 * only fires once the user is on an authenticated page.
 */
export function useAdminDocs(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: ADMIN_DOCS_QUERY_KEY,
    queryFn: listDocs,
    enabled: options.enabled ?? true,
  });

  const docs: AdminDocItem[] = query.data ?? [];
  const pendingDocs = docs.filter((d) => d.status === "to_sort");
  const urgentCount = pendingDocs.filter((d) => d.urgent).length;

  return {
    ...query,
    docs,
    pendingDocs,
    pendingCount: pendingDocs.length,
    urgentCount,
  };
}

/** Returns a function that refetches the shared admin-docs cache. */
export function useInvalidateAdminDocs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ADMIN_DOCS_QUERY_KEY });
}
