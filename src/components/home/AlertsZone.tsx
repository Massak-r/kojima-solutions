import { UnpaidInvoices } from "@/components/kojimaSpace/UnpaidInvoices";
import { UpcomingDeadlines } from "@/components/kojimaSpace/UpcomingDeadlines";
import { PendingFeedback } from "@/components/home/PendingFeedback";
import { QuotesToInvoice } from "@/components/home/QuotesToInvoice";
import { NewIntakes } from "@/components/home/NewIntakes";

/**
 * Alerts zone shown at the top of the Home Streams tab — the "ball-in-court"
 * inbox. Each child component returns null if it has nothing to show, so the
 * zone auto-collapses when there's no actionable signal. Cards are ordered
 * left-to-right by typical urgency: new leads → unbilled revenue → unpaid
 * invoices → upcoming work → pending client replies.
 */
export function AlertsZone() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <NewIntakes />
      <QuotesToInvoice />
      <UnpaidInvoices />
      <UpcomingDeadlines />
      <PendingFeedback />
    </div>
  );
}
