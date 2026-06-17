import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, FileText, BarChart3, Target, Compass, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickCreate } from "@/contexts/QuickCreateContext";
import { OPEN_NEXT_ACTION_EVENT } from "@/components/now/NextActionDialog";
import { AlertsZone } from "@/components/home/AlertsZone";
import { SprintSummary } from "@/components/home/SprintSummary";
import { StreamsList } from "@/components/home/StreamsList";
import { ProjectStatusKanban } from "@/components/home/ProjectStatusKanban";
import { OverviewTab } from "@/components/home/OverviewTab";
import { ObjectivesSection } from "@/components/kojimaSpace/ObjectivesSection";
import { MondayBriefDialog } from "@/components/home/MondayBriefDialog";
import { QuickCaptureFab } from "@/components/home/QuickCaptureFab";
import { InboxPanel } from "@/components/home/InboxPanel";
import { AujourdhuiTab } from "@/components/home/AujourdhuiTab";
import { haptic } from "@/lib/haptics";
import { PendingDocsBanner } from "@/components/PendingDocsBanner";
import { isoWeekOf } from "@/lib/recurrencePeriod";
import { formatDateWithWeekday } from "@/lib/dateFormat";

type Tab = "today" | "streams" | "kanban" | "overview" | "objectives";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { open: openQuickCreate } = useQuickCreate();

  // Tab is URL-driven (single source of truth) so a deep link — e.g. the
  // notification dropdown navigating to ?tab=overview — switches the tab even
  // when we're already mounted on /home, with no effect ping-pong.
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam === "streams" ? "streams" :
    tabParam === "kanban" ? "kanban" :
    tabParam === "overview" ? "overview" :
    tabParam === "objectives" ? "objectives" :
    "today";
  const setTab = useCallback((t: Tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (t === "today") next.delete("tab");
      else next.set("tab", t);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // ?focus=new-objective: switch to the Objectifs tab, scroll the inline
  // AddObjectiveForm input into view and focus it. This is what the FAB +
  // SprintPage CTAs call when they want to send the user straight into
  // objective creation from anywhere in the app.
  useEffect(() => {
    if (searchParams.get("focus") !== "new-objective") return;
    // Switch to Objectifs and clear the focus flag in one URL update.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "objectives");
      next.delete("focus");
      return next;
    }, { replace: true });
    const t = setTimeout(() => {
      const input = document.getElementById("new-objective-input");
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => (input as HTMLElement).focus(), 350);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchParams, setSearchParams]);

  const today = formatDateWithWeekday(new Date());

  // Monday morning brief: pops once per ISO week on Mondays. localStorage key
  // is per-week so dismissing only mutes this week; next Monday it re-opens.
  const [mondayBriefOpen, setMondayBriefOpen] = useState(false);
  useEffect(() => {
    const now = new Date();
    if (now.getDay() !== 1) return; // 1 = Monday
    const { year, week } = isoWeekOf(now);
    const key = `monday-brief-${year}-${week}`;
    try {
      if (!localStorage.getItem(key)) {
        setMondayBriefOpen(true);
      }
    } catch { /* localStorage unavailable — skip the brief */ }
  }, []);
  function handleMondayBriefChange(next: boolean) {
    setMondayBriefOpen(next);
    if (!next) {
      const { year, week } = isoWeekOf(new Date());
      try { localStorage.setItem(`monday-brief-${year}-${week}`, "1"); } catch { /* ignore */ }
    }
  }

  function handleNewProject() {
    openQuickCreate("project");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="font-body text-xs font-semibold tracking-widest uppercase text-primary-foreground/60 mb-1">
                {today}
              </p>
              <h1 className="font-display text-2xl md:text-3xl leading-tight font-bold">
                Bonjour
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_NEXT_ACTION_EVENT))}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-xs gap-1.5"
              >
                <Compass size={14} />
                Et maintenant ?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/quotes/new")}
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-body text-xs gap-1.5"
              >
                <FileText size={13} />
                Nouveau devis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewProject}
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-body text-xs gap-1.5"
              >
                <Plus size={14} />
                Nouveau projet
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <PendingDocsBanner className="mb-5" />

        {/* Tabs */}
        <div className="flex gap-1 p-0.5 bg-muted/40 rounded-full w-fit mb-6">
          <TabButton
            label="Aujourd'hui"
            icon={Sun}
            active={tab === "today"}
            onClick={() => setTab("today")}
          />
          <TabButton
            label="Streams"
            icon={LayoutDashboard}
            active={tab === "streams"}
            onClick={() => setTab("streams")}
          />
          <TabButton
            label="Statut projets"
            icon={FolderKanban}
            active={tab === "kanban"}
            onClick={() => setTab("kanban")}
          />
          <TabButton
            label="Objectifs"
            icon={Target}
            active={tab === "objectives"}
            onClick={() => setTab("objectives")}
          />
          <TabButton
            label="Aperçu"
            icon={BarChart3}
            active={tab === "overview"}
            onClick={() => setTab("overview")}
          />
        </div>

        {tab === "today" && <AujourdhuiTab />}
        {tab === "streams" && (
          <div className="space-y-5">
            <AlertsZone />
            <InboxPanel />
            <SprintSummary />
            <StreamsList />
          </div>
        )}
        {tab === "kanban" && <ProjectStatusKanban />}
        {tab === "objectives" && <ObjectivesSection />}
        {tab === "overview" && <OverviewTab />}
      </main>

      <MondayBriefDialog open={mondayBriefOpen} onOpenChange={handleMondayBriefChange} />
      <QuickCaptureFab />
    </div>
  );
}

function TabButton({
  label, icon: Icon, active, onClick,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => { haptic("tap"); onClick(); }}
      className={`px-3 py-1.5 text-xs font-body font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
