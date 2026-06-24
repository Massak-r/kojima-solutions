import { apiFetch } from "./client";
import type { AdminComplianceSignal } from "@/lib/adminCompliance";

/**
 * Latest Soroban `admin_compliance` document (the Phase-2 signal), or null if
 * Soroban hasn't pushed a snapshot yet. The Centre admin cockpit degrades to
 * task-only gauges when this is null/unavailable.
 */
export function getAdminComplianceSignal() {
  return apiFetch<AdminComplianceSignal | null>("soroban/snapshot.php?type=admin_compliance");
}
