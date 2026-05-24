import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuickCreate } from "@/contexts/QuickCreateContext";
import { CalendarWidget } from "@/components/calendar/CalendarWidget";
import { IntakeManager } from "@/components/IntakeManager";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { EmailQueue } from "@/components/EmailQueue";
import { CostsDueSoon } from "@/components/kojimaSpace/CostsDueSoon";
import { LatestProjects } from "@/components/kojimaSpace/LatestProjects";
import { RecentActivity } from "@/components/RecentActivity";
import { ObjectiveHealthCard } from "@/components/objective/ObjectiveHealthCard";
import { StatsBar } from "@/components/kojimaSpace/StatsBar";

/**
 * Comprehensive business overview tab. Absorbs what used to be the
 * standalone KojimaSpace page: stats, objective health, latest projects,
 * calendar, intakes, analytics, email queue, costs, recent activity.
 * Two-column layout on lg+ : actionable on left, ambient on right.
 */
export function OverviewTab() {
  const navigate = useNavigate();
  const { open: openQuickCreate } = useQuickCreate();
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
          <LatestProjects onNewProject={() => openQuickCreate("project")} />
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
