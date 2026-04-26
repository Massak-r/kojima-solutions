import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useProjects } from "@/contexts/ProjectsContext";
import { QuickActionFAB } from "@/components/QuickActionFAB";
import { RecentActivity } from "@/components/RecentActivity";
import { CalendarWidget } from "@/components/calendar/CalendarWidget";
import { IntakeManager } from "@/components/IntakeManager";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { EmailQueue } from "@/components/EmailQueue";
import { ObjectiveHealthCard } from "@/components/objective/ObjectiveHealthCard";
import { HeroHeader } from "@/components/kojimaSpace/HeroHeader";
import { StatsBar } from "@/components/kojimaSpace/StatsBar";
import { LatestProjects } from "@/components/kojimaSpace/LatestProjects";
import { UnpaidInvoices } from "@/components/kojimaSpace/UnpaidInvoices";
import { UpcomingDeadlines } from "@/components/kojimaSpace/UpcomingDeadlines";
import { CostsDueSoon } from "@/components/kojimaSpace/CostsDueSoon";
import { ObjectivesSection } from "@/components/kojimaSpace/ObjectivesSection";

export default function KojimaSpace() {
  const navigate = useNavigate();
  const { createProject } = useProjects();

  function handleNewProject() {
    const p = createProject();
    navigate(`/project/${p.id}/brief`);
  }

  const today = new Date().toLocaleDateString("fr-CH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <HeroHeader
        today={today}
        onProjectsClick={() => navigate("/projects")}
        onNewProject={handleNewProject}
        onNewQuote={() => navigate("/quotes/new")}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
        <StatsBar />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <ObjectiveHealthCard />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-6"
        >
          <div className="lg:col-span-3 space-y-6">
            <LatestProjects onNewProject={handleNewProject} />
            <UnpaidInvoices />
            <IntakeManager />
            <AnalyticsWidget />
            <CalendarWidget />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <EmailQueue />
            <UpcomingDeadlines />
            <CostsDueSoon />
            <RecentActivity />
          </div>
        </motion.div>

        <QuickActionFAB />

        <ObjectivesSection />
      </main>
    </div>
  );
}
