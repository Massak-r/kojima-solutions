import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/contexts/ProjectsContext";
import { AlertsZone } from "@/components/home/AlertsZone";
import { SprintSummary } from "@/components/home/SprintSummary";
import { StreamsList } from "@/components/home/StreamsList";
import { ProjectStatusKanban } from "@/components/home/ProjectStatusKanban";

type Tab = "streams" | "kanban";

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createProject } = useProjects();

  const initialTab: Tab = searchParams.get("tab") === "kanban" ? "kanban" : "streams";
  const [tab, setTab] = useState<Tab>(initialTab);

  // Keep URL in sync with tab
  useEffect(() => {
    const current = searchParams.get("tab");
    const target = tab === "kanban" ? "kanban" : null;
    if (current !== target) {
      const next = new URLSearchParams(searchParams);
      if (target) next.set("tab", target);
      else next.delete("tab");
      setSearchParams(next, { replace: true });
    }
  }, [tab, searchParams, setSearchParams]);

  const today = new Date().toLocaleDateString("fr-CH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  function handleNewProject() {
    const p = createProject();
    navigate(`/project/${p.id}/brief`);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-7 px-6">
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
                variant="outline"
                size="sm"
                onClick={() => navigate("/quotes/new")}
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-body text-xs gap-1.5"
              >
                <FileText size={13} />
                Nouveau devis
              </Button>
              <Button
                size="sm"
                onClick={handleNewProject}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-xs gap-1.5"
              >
                <Plus size={14} />
                Nouveau projet
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {/* Tabs */}
        <div className="flex gap-1 p-0.5 bg-muted/40 rounded-full w-fit mb-6">
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
        </div>

        {tab === "streams" ? (
          <div className="space-y-5">
            <AlertsZone />
            <SprintSummary />
            <StreamsList />
          </div>
        ) : (
          <ProjectStatusKanban />
        )}
      </main>
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
      onClick={onClick}
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
