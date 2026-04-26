import { Button } from "@/components/ui/button";
import { Sparkles, LayoutList, Plus } from "lucide-react";

interface HeroHeaderProps {
  today: string;
  onProjectsClick: () => void;
  onNewProject: () => void;
  onNewQuote: () => void;
}

export function HeroHeader({ today, onProjectsClick, onNewProject, onNewQuote }: HeroHeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-accent" />
          <span className="font-body text-xs font-semibold tracking-widest uppercase text-primary-foreground/50">
            Espace de travail
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              Kojima<span className="text-accent">.</span>Space
            </h1>
            <p className="font-body text-primary-foreground/55 mt-1 text-sm capitalize">{today}</p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Button
              onClick={onProjectsClick}
              variant="outline"
              className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-body text-sm gap-2"
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">Tous les </span>Projets
            </Button>
            <Button
              onClick={onNewProject}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-1.5"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nouveau </span>Projet
            </Button>
            <Button
              onClick={onNewQuote}
              className="bg-accent/70 text-accent-foreground hover:bg-accent/60 font-body text-sm gap-1.5"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Nouveau </span>Devis
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
