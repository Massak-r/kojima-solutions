import { UnpaidInvoices } from "@/components/kojimaSpace/UnpaidInvoices";
import { UpcomingDeadlines } from "@/components/kojimaSpace/UpcomingDeadlines";
import { OverdueWork } from "@/components/home/OverdueWork";
import { RenewalRadar } from "@/components/home/RenewalRadar";
import { PendingFeedback } from "@/components/home/PendingFeedback";
import { QuotesToInvoice } from "@/components/home/QuotesToInvoice";
import { NewIntakes } from "@/components/home/NewIntakes";
import { OperatorInsights } from "@/components/home/OperatorInsights";

/**
 * Alerts zone shown at the top of the Home Streams tab — the "ball-in-court"
 * inbox. Each child component returns null if it has nothing to show, so the
 * zone auto-collapses when there's no actionable signal. Cards are ordered
 * left-to-right by typical urgency: new leads → unbilled revenue → unpaid
 * invoices → upcoming work → pending client replies. Below the live alerts,
 * the operator-side insights surface slower-moving signals (dormant quotes,
 * unbilled hours, runway warning).
 */
export function AlertsZone() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <OverdueWork />
        <NewIntakes />
        <QuotesToInvoice />
        <UnpaidInvoices />
        <UpcomingDeadlines />
        <RenewalRadar />
        <PendingFeedback />
      </div>
      <OperatorInsights />
    </div>
  );
}
