import { motion } from "framer-motion";
import { CalendarWidget } from "@/components/calendar/CalendarWidget";
import { IntakeManager } from "@/components/IntakeManager";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { EmailQueue } from "@/components/EmailQueue";
import { CostsDueSoon } from "@/components/kojimaSpace/CostsDueSoon";
import { RecentActivity } from "@/components/RecentActivity";
import { ObjectiveHealthCard } from "@/components/objective/ObjectiveHealthCard";
import { StatsBar } from "@/components/kojimaSpace/StatsBar";

/**
 * Comprehensive business overview tab.
 * Reuses existing widgets from the original KojimaSpace dashboard.
 * Two-column layout on lg+ : actionable on left, ambient on right.
 */
export function OverviewTab() {
  return (
    <div className="space-y-6">
      <StatsBar />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ObjectiveHealthCard />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <CalendarWidget />
          <IntakeManager />
          <AnalyticsWidget />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <EmailQueue />
          <CostsDueSoon />
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
