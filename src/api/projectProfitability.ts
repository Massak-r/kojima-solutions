import { apiFetch } from "./client";

export interface ProjectProfitabilityRow {
  id: string;
  title: string;
  client: string | null;
  clientId: string | null;
  kind: "client" | "internal" | "personal";
  status: string | null;
  paymentStatus: string | null;
  /** Raw quote strings as stored on the project (e.g. "5'000", "CHF 4500.-"). */
  initialQuote: string | null;
  revisedQuote: string | null;
  /** Per-client hourly-rate override; null → use the company default rate. */
  clientRate: number | null;
  /** Total tracked focus time on the project, in hours (billed + unbilled). */
  trackedHours: number;
  /** Sum of timeline-task estimates, in hours; null if none set. */
  estimatedHours: number | null;
}

export function listProjectProfitability() {
  return apiFetch<ProjectProfitabilityRow[]>("project_profitability.php");
}
