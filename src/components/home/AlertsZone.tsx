import { UnpaidInvoices } from "@/components/kojimaSpace/UnpaidInvoices";
import { UpcomingDeadlines } from "@/components/kojimaSpace/UpcomingDeadlines";
import { PendingFeedback } from "@/components/home/PendingFeedback";

/**
 * Alerts zone shown at the top of the Home Streams tab.
 * Each child component returns null if it has nothing to show — so the zone
 * collapses to nothing when there's no actionable signal.
 */
export function AlertsZone() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UnpaidInvoices />
      <UpcomingDeadlines />
      <PendingFeedback />
    </div>
  );
}
