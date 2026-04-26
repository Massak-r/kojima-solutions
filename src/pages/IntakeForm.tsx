import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { submitIntake } from "@/api/funnels";
import { MODULE_CATALOG, PROJECT_TYPE_PRESETS } from "@/data/moduleCatalog";
import type { ModuleComplexity } from "@/types/module";
import { TOTAL_STEPS, DRAFT_KEY } from "@/components/intakeForm/constants";
import { slideVariants, slideTransition } from "@/components/intakeForm/animations";
import { useCountUp } from "@/components/intakeForm/useCountUp";
import { computeEstimate, type SelectedModule } from "@/components/intakeForm/pricing";
import { SuccessScreen } from "@/components/intakeForm/SuccessScreen";
import { Step1ProjectType } from "@/components/intakeForm/Step1ProjectType";
import { Step2Modules } from "@/components/intakeForm/Step2Modules";
import { Step3Options } from "@/components/intakeForm/Step3Options";
import { Step4Estimate } from "@/components/intakeForm/Step4Estimate";
import { Step5Contact } from "@/components/intakeForm/Step5Contact";

const CTA_LABELS: Record<number, { text: string; icon: React.ElementType }> = {
  1: { text: "C'est parti !", icon: ArrowRight },
  2: { text: "Continuer", icon: ArrowRight },
  3: { text: "Voir mon estimation", icon: ArrowRight },
  4: { text: "Dernière étape", icon: ArrowRight },
  5: { text: "Envoyer ma demande", icon: Send },
};

const STEP_TITLES = [
  "Quel type de projet ?",
  "De quelles fonctionnalités avez-vous besoin ?",
  "Options & délais",
  "Votre estimation",
  "Vos coordonnées",
];

const STEP_SUBTITLES = [
  "Sélectionnez la catégorie qui correspond le mieux à votre projet.",
  "Activez les modules dont vous avez besoin. Nous avons pré-sélectionné les plus courants.",
  "Choisissez vos préférences de délai, taille du site, hébergement et maintenance.",
  "Voici une estimation basée sur vos choix. Les prix finaux dépendent de la complexité exacte.",
  "Recevez votre estimation détaillée et une proposition personnalisée.",
];

export default function IntakeForm() {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [projectType, setProjectType] = useState("");
  const [projectSlug, setProjectSlug] = useState("");

  const [selectedModules, setSelectedModules] = useState<SelectedModule[]>([]);
  const [presetsApplied, setPresetsApplied] = useState("");

  const [timeline, setTimeline] = useState("normal");
  const [maintenance, setMaintenance] = useState("none");
  const [hostingTier, setHostingTier] = useState("simple");
  const [pageCount, setPageCount] = useState("multi");

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.projectType) setProjectType(d.projectType);
        if (d.projectSlug) { setProjectSlug(d.projectSlug); setPresetsApplied(d.projectSlug); }
        if (d.selectedModules) setSelectedModules(d.selectedModules);
        if (d.timeline) setTimeline(d.timeline);
        if (d.maintenance) setMaintenance(d.maintenance);
        if (d.hostingTier) setHostingTier(d.hostingTier);
        if (d.pageCount) setPageCount(d.pageCount);
        if (d.contactName) setContactName(d.contactName);
        if (d.contactEmail) setContactEmail(d.contactEmail);
        if (d.contactPhone) setContactPhone(d.contactPhone);
        if (d.contactCompany) setContactCompany(d.contactCompany);
        if (d.contactMessage) setContactMessage(d.contactMessage);
        if (d.step) setStep(d.step);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (submitted) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          projectType, projectSlug, selectedModules, timeline, maintenance, hostingTier, pageCount,
          contactName, contactEmail, contactPhone, contactCompany, contactMessage, step,
        }));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [projectType, projectSlug, selectedModules, timeline, maintenance, hostingTier, pageCount,
    contactName, contactEmail, contactPhone, contactCompany, contactMessage, step, submitted]);

  useEffect(() => {
    if (!projectSlug || presetsApplied === projectSlug) return;
    const presets = PROJECT_TYPE_PRESETS[projectSlug];
    if (presets) {
      setSelectedModules(presets.map(p => ({ id: p.id, complexity: p.complexity })));
      setPresetsApplied(projectSlug);
    }
  }, [projectSlug, presetsApplied]);

  const estimate = useMemo(
    () => computeEstimate(selectedModules, timeline, maintenance, hostingTier, pageCount),
    [selectedModules, timeline, maintenance, hostingTier, pageCount],
  );

  const toggleModule = useCallback((moduleId: string) => {
    setSelectedModules(prev => {
      const exists = prev.find(m => m.id === moduleId);
      if (exists) return prev.filter(m => m.id !== moduleId);
      const mod = MODULE_CATALOG.find(m => m.id === moduleId);
      const defaultComplexity = mod?.tiers[0]?.complexity ?? "simple";
      return [...prev, { id: moduleId, complexity: defaultComplexity as ModuleComplexity }];
    });
  }, []);

  const setModuleComplexity = useCallback((moduleId: string, complexity: ModuleComplexity) => {
    setSelectedModules(prev => prev.map(m =>
      m.id === moduleId ? { ...m, complexity } : m
    ));
  }, []);

  const canAdvance = useCallback((): boolean => {
    switch (step) {
      case 1: return !!projectType;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return !!contactName.trim() && !!contactEmail.trim() && contactEmail.includes("@");
      default: return true;
    }
  }, [step, projectType, contactName, contactEmail]);

  async function handleSubmit() {
    if (!canAdvance()) return;
    setSubmitting(true);
    try {
      await submitIntake({
        clientName: contactName.trim(),
        clientEmail: contactEmail.trim(),
        responses: {
          projectType,
          projectSlug,
          selectedModules,
          timeline,
          maintenance,
          hostingTier,
          pageCount,
          estimate: { low: estimate.low, high: estimate.high, yearly: estimate.yearly },
          phone: contactPhone.trim(),
          company: contactCompany.trim(),
          message: contactMessage.trim(),
        },
      });
      setSubmitted(true);
      window.plausible?.("Intake Complete", { props: { type: projectSlug, modules: selectedModules.length } });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (!canAdvance()) return;
    if (step === TOTAL_STEPS) handleSubmit();
    else {
      setDirection(1);
      const next = Math.min(step + 1, TOTAL_STEPS);
      setStep(next);
      window.plausible?.("Intake Step", { props: { step: next } });
    }
  }

  function handleBack() {
    setDirection(-1);
    setStep(s => Math.max(s - 1, 1));
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        handleNext();
      }
      if (e.key === "Escape" && step > 1) handleBack();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, canAdvance]);

  const countLow = useCountUp(step === 4 ? estimate.low : 0);
  const countHigh = useCountUp(step === 4 ? estimate.high : 0);

  if (submitted) {
    return (
      <SuccessScreen
        contactName={contactName}
        contactEmail={contactEmail}
        projectType={projectType}
        estimate={estimate}
        selectedModules={selectedModules}
      />
    );
  }

  const cta = CTA_LABELS[step];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground font-body">
            ← Site
          </Link>
          <div className="flex-1">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full progress-glow transition-[width] duration-500"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-body tabular-nums">
            {step}/{TOTAL_STEPS}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
          >
            <div className="mb-8">
              <h1 className="font-display text-xl sm:text-2xl font-semibold">{STEP_TITLES[step - 1]}</h1>
              <p className="text-sm text-muted-foreground font-body mt-1">{STEP_SUBTITLES[step - 1]}</p>
            </div>

            {step === 1 && (
              <Step1ProjectType
                projectSlug={projectSlug}
                onSelect={(label, slug) => { setProjectType(label); setProjectSlug(slug); }}
              />
            )}
            {step === 2 && (
              <Step2Modules
                selectedModules={selectedModules}
                toggleModule={toggleModule}
                setModuleComplexity={setModuleComplexity}
                estimate={estimate}
              />
            )}
            {step === 3 && (
              <Step3Options
                timeline={timeline} setTimeline={setTimeline}
                pageCount={pageCount} setPageCount={setPageCount}
                hostingTier={hostingTier} setHostingTier={setHostingTier}
                maintenance={maintenance} setMaintenance={setMaintenance}
              />
            )}
            {step === 4 && (
              <Step4Estimate
                estimate={estimate}
                selectedModules={selectedModules}
                timeline={timeline}
                pageCount={pageCount}
                countLow={countLow}
                countHigh={countHigh}
              />
            )}
            {step === 5 && (
              <Step5Contact
                estimate={estimate}
                contactName={contactName} setContactName={setContactName}
                contactEmail={contactEmail} setContactEmail={setContactEmail}
                contactPhone={contactPhone} setContactPhone={setContactPhone}
                contactCompany={contactCompany} setContactCompany={setContactCompany}
                contactMessage={contactMessage} setContactMessage={setContactMessage}
                emailTouched={emailTouched} setEmailTouched={setEmailTouched}
                nameTouched={nameTouched} setNameTouched={setNameTouched}
                goToEstimate={() => { setDirection(-1); setStep(4); }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
                <ArrowLeft size={14} /> Retour
              </Button>
            ) : (
              <div />
            )}
            <div className="flex-1" />
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canAdvance() || submitting}
              className="gap-1.5 min-w-[140px] justify-center"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  {step === 5 && <cta.icon size={14} />}
                  {cta.text}
                  {step !== 5 && <cta.icon size={14} />}
                </>
              )}
            </Button>
          </div>
          {step === 5 && (
            <p className="text-[11px] text-muted-foreground/50 font-body text-center">
              Gratuit et sans engagement
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
