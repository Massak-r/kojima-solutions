import { useState, useRef } from "react";
import {
  ClipboardList, CheckCircle2, MessageSquare, Eye,
  ThumbsUp, RefreshCw, FileText, Sparkles, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WelcomeOnboardingProps {
  clientName?: string;
  projectTitle: string;
  onDismiss: () => void;
}

export function WelcomeOnboarding({ clientName, projectTitle, onDismiss }: WelcomeOnboardingProps) {
  const [step, setStep] = useState(0);
  const touchStartX = useRef(0);
  const TOTAL_STEPS = 3;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && step < TOTAL_STEPS - 1) setStep(step + 1);
      if (delta > 0 && step > 0) setStep(step - 1);
    }
  }

  const PROCESS_STEPS = [
    { icon: ClipboardList, title: "Etapes claires", desc: "Votre projet est divisé en étapes. Chaque étape nécessite votre validation avant de passer à la suite." },
    { icon: CheckCircle2, title: "Validation", desc: "Approuvez les livrables, choisissez parmi les options proposées, ou demandez une révision." },
    { icon: MessageSquare, title: "Communication", desc: "Ajoutez des commentaires sur chaque étape pour donner votre retour directement." },
    { icon: Eye, title: "Suivi en temps réel", desc: "Suivez l'avancement global et voyez exactement où en est votre projet." },
  ];

  const ACTION_CARDS = [
    { icon: ThumbsUp, title: "Valider une étape", desc: "Quand une étape est prête, cliquez sur Valider pour confirmer.", color: "text-emerald-600 bg-emerald-50" },
    { icon: RefreshCw, title: "Demander une révision", desc: "Pas satisfait ? Demandez une révision avec un commentaire.", color: "text-amber-600 bg-amber-50" },
    { icon: FileText, title: "Consulter les fichiers", desc: "Accédez aux documents, maquettes et livrables partagés.", color: "text-blue-600 bg-blue-50" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Carousel */}
        <div
          className="overflow-hidden rounded-2xl"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${step * 100}%)` }}
          >
            {/* Screen 1: Welcome */}
            <div className="w-full shrink-0 px-2">
              <div className="text-center space-y-5 py-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
                  <Sparkles size={28} className="text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                    Bienvenue{clientName ? `, ${clientName}` : ""} !
                  </h1>
                  <p className="font-body text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    Voici votre espace projet pour <strong>{projectTitle}</strong>.
                  </p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-left">
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
                    Ce portail vous permet de suivre chaque étape, valider les livrables et communiquer directement avec l'équipe.
                  </p>
                </div>
              </div>
            </div>

            {/* Screen 2: How it works */}
            <div className="w-full shrink-0 px-2">
              <div className="space-y-4 py-6">
                <h2 className="font-display text-lg font-bold text-foreground text-center">
                  Comment ça fonctionne
                </h2>
                <div className="space-y-3">
                  {PROCESS_STEPS.map((s, i) => (
                    <div key={i} className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <s.icon size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground">{s.title}</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Screen 3: Your actions */}
            <div className="w-full shrink-0 px-2">
              <div className="space-y-4 py-6">
                <h2 className="font-display text-lg font-bold text-foreground text-center">
                  Vos actions
                </h2>
                <div className="space-y-3">
                  {ACTION_CARDS.map((a, i) => (
                    <div key={i} className="flex gap-3 items-start bg-card border border-border rounded-xl p-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", a.color)}>
                        <a.icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-foreground">{a.title}</p>
                        <p className="font-body text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === step ? "bg-primary w-6" : "bg-border hover:bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 px-2">
          <button
            onClick={() => setStep(step - 1)}
            className={cn(
              "font-body text-sm text-muted-foreground hover:text-foreground transition-colors",
              step === 0 && "invisible",
            )}
          >
            <ChevronLeft size={14} className="inline -mt-0.5" /> Précédent
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="font-body text-sm text-primary font-medium hover:text-primary/80 transition-colors"
            >
              Suivant <ChevronRight size={14} className="inline -mt-0.5" />
            </button>
          ) : (
            <Button onClick={onDismiss} className="gap-2 h-10 px-6">
              Voir mon projet
            </Button>
          )}
        </div>

        {/* Skip link */}
        {step < TOTAL_STEPS - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={onDismiss}
              className="font-body text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Passer l'introduction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
