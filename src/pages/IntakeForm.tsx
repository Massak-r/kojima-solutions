import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Loader2, Send, Mail,
  FileText, Image, MapPin, MessageCircle, CalendarCheck, BarChart3,
  ShoppingBag, CreditCard, Lock, Globe, Search, Settings, Server,
  UserCircle, CheckCircle2, ChevronDown, Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { submitIntake } from "@/api/funnels";
import {
  MODULE_CATALOG, MAINTENANCE_OPTIONS, PROJECT_TYPE_PRESETS,
  getModulePrice, getModuleYearlyFee,
} from "@/data/moduleCatalog";
import type { ModuleComplexity } from "@/types/module";
import { ConfettiBurst } from "@/utils/ConfettiBurst";

// ── Icon map ──────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Image, MapPin, Mail, CalendarCheck, Send, BarChart3,
  MessageCircle, UserCircle, ShoppingBag, CreditCard, Lock, Globe,
  Search, Settings, Server,
};

function ModuleIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} className={className} /> : null;
}

// ── Constants ──────────────────────────────────────────────

const TOTAL_STEPS = 5;
const DRAFT_KEY = "kojima-intake-draft-v2";
const BASE_PROJECT_COST = 1500;

const PROJECT_TYPES = [
  { emoji: "🖥️", label: "Web App / Outil interne", slug: "webapp" },
  { emoji: "🏢", label: "PME / Corporate", slug: "pme-corporate" },
  { emoji: "🍽️", label: "Restaurant / Hôtellerie", slug: "restaurant" },
  { emoji: "📅", label: "Événementiel", slug: "evenementiel" },
  { emoji: "📄", label: "Landing page", slug: "landing-page" },
  { emoji: "❓", label: "Autre", slug: "autre" },
];

const TIMELINE_OPTIONS = [
  { emoji: "⚡", label: "Urgent", sub: "Moins d'1 mois", value: "urgent" },
  { emoji: "📅", label: "Normal", sub: "1 à 3 mois", value: "normal" },
  { emoji: "🌿", label: "Flexible", sub: "3 mois ou plus", value: "flexible" },
];

const HOSTING_OPTIONS = [
  { value: "simple" as const, label: "Hébergement inclus", sub: "360 CHF/an", yearly: 360 },
  { value: "custom" as const, label: "J'ai déjà un hébergement", sub: "0 CHF/an", yearly: 0 },
];

const PAGE_COUNT_OPTIONS = [
  { value: "single", label: "Page unique", sub: "Landing page, one-pager", extra: 0 },
  { value: "multi", label: "Multi-pages", sub: "3 à 10 pages", extra: 500 },
  { value: "large", label: "Site étendu", sub: "Plus de 10 pages", extra: 1500 },
];

const POPULAR_MODULES = new Set(["contact-form", "gallery", "seo", "blog"]);

const COMPLEXITY_LABELS: Record<ModuleComplexity, string> = {
  simple: "Simple",
  advanced: "Avancé",
  custom: "Sur mesure",
};

const CATEGORY_LABELS: Record<string, string> = {
  content: "Contenu",
  interaction: "Interaction",
  commerce: "Commerce",
  system: "Système",
};

const CTA_LABELS: Record<number, { text: string; icon: React.ElementType }> = {
  1: { text: "C'est parti !", icon: ArrowRight },
  2: { text: "Continuer", icon: ArrowRight },
  3: { text: "Voir mon estimation", icon: ArrowRight },
  4: { text: "Dernière étape", icon: ArrowRight },
  5: { text: "Envoyer ma demande", icon: Send },
};

// ── Animation variants ────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

const slideTransition = {
  duration: 0.3,
  ease: [0.25, 0.46, 0.45, 0.94],
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ── Hooks ─────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (target === prevTarget.current && current !== 0) return;
    prevTarget.current = target;

    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(Math.round((eased * target) / 100) * 100);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}

// ── Types ──────────────────────────────────────────────────

interface SelectedModule {
  id: string;
  complexity: ModuleComplexity;
}

// ── Pricing logic ─────────────────────────────────────────

function computeEstimate(
  modules: SelectedModule[],
  timeline: string,
  maintenance: string,
  hostingTier: string,
  pageCount: string,
) {
  let devTotal = modules.reduce((sum, m) => sum + getModulePrice(m.id, m.complexity), 0);
  devTotal += BASE_PROJECT_COST;

  // Page count surcharge
  const pageExtra = PAGE_COUNT_OPTIONS.find(p => p.value === pageCount)?.extra ?? 0;
  devTotal += pageExtra;

  if (modules.length >= 4) devTotal *= 0.90;
  if (timeline === "urgent") devTotal *= 1.20;

  const low = Math.round((devTotal * 0.90) / 100) * 100;
  const high = Math.round((devTotal * 1.10) / 100) * 100;

  let yearly = 0;
  const hosting = HOSTING_OPTIONS.find(h => h.value === hostingTier);
  yearly += hosting?.yearly ?? 360;
  const maint = MAINTENANCE_OPTIONS.find(m => m.tier === maintenance);
  yearly += maint?.price ?? 0;
  modules.forEach(m => { yearly += getModuleYearlyFee(m.id, m.complexity); });

  return { low, high, yearly, devTotal: Math.round(devTotal), pageExtra };
}

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH");
}

// ── Component ──────────────────────────────────────────────

export default function IntakeForm() {
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [projectType, setProjectType] = useState("");
  const [projectSlug, setProjectSlug] = useState("");

  // Step 2
  const [selectedModules, setSelectedModules] = useState<SelectedModule[]>([]);
  const [presetsApplied, setPresetsApplied] = useState("");

  // Step 3
  const [timeline, setTimeline] = useState("normal");
  const [maintenance, setMaintenance] = useState("none");
  const [hostingTier, setHostingTier] = useState("simple");
  const [pageCount, setPageCount] = useState("multi");

  // Step 2
  const [legendOpen, setLegendOpen] = useState(() => {
    try { return localStorage.getItem("kojima-legend-seen") !== "1"; } catch { return true; }
  });

  // Step 5
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  // Restore draft
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

  // Save draft
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

  // Apply presets when project type changes
  useEffect(() => {
    if (!projectSlug || presetsApplied === projectSlug) return;
    const presets = PROJECT_TYPE_PRESETS[projectSlug];
    if (presets) {
      setSelectedModules(presets.map(p => ({ id: p.id, complexity: p.complexity })));
      setPresetsApplied(projectSlug);
    }
  }, [projectSlug, presetsApplied]);

  // Estimate
  const estimate = useMemo(
    () => computeEstimate(selectedModules, timeline, maintenance, hostingTier, pageCount),
    [selectedModules, timeline, maintenance, hostingTier, pageCount],
  );

  // Module toggle
  const toggleModule = useCallback((moduleId: string) => {
    setSelectedModules(prev => {
      const exists = prev.find(m => m.id === moduleId);
      if (exists) return prev.filter(m => m.id !== moduleId);
      // Default to the first available tier (handles modules with only "custom" tier)
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

  // Validation
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

  // Submit
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

  // Keyboard shortcuts
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

  // Legend toggle
  function toggleLegend() {
    setLegendOpen(prev => {
      const next = !prev;
      if (!next) try { localStorage.setItem("kojima-legend-seen", "1"); } catch {}
      return next;
    });
  }

  // Inline validation
  const isEmailValid = contactEmail.includes("@") && contactEmail.includes(".");
  const isNameValid = contactName.trim().length > 0;

  // Count-up for price reveal (Step 4)
  const countLow = useCountUp(step === 4 ? estimate.low : 0);
  const countHigh = useCountUp(step === 4 ? estimate.high : 0);

  // ── Success screen ─────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 relative">
          <ConfettiBurst count={30} spread={320} />

          {/* Animated checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="mx-auto"
          >
            <svg viewBox="0 0 50 50" className="w-16 h-16 mx-auto">
              <motion.circle
                cx="25" cy="25" r="22"
                fill="none"
                stroke="hsl(145 20% 44%)"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              />
              <motion.path
                d="M14 27l7 7 15-15"
                fill="none"
                stroke="hsl(145 20% 44%)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.7 }}
              />
            </svg>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="font-display text-2xl font-semibold"
          >
            Merci {contactName.split(" ")[0]} !
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="text-muted-foreground font-body text-sm"
          >
            Votre demande pour un projet « {projectType} » a bien été enregistrée.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-secondary/30 rounded-xl p-5 space-y-2"
          >
            <p className="font-display text-lg font-semibold">
              CHF {formatCHF(estimate.low)} – {formatCHF(estimate.high)}
            </p>
            <p className="text-xs text-muted-foreground font-body">
              Estimation indicative · {selectedModules.length} module{selectedModules.length !== 1 ? "s" : ""} sélectionné{selectedModules.length !== 1 ? "s" : ""}
            </p>
            {estimate.yearly > 0 && (
              <p className="text-xs text-muted-foreground/60 font-body">
                + CHF {formatCHF(estimate.yearly)}/an (hébergement & maintenance)
              </p>
            )}
          </motion.div>

          {contactEmail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 font-body"
            >
              <Mail size={12} />
              <span>Nous vous répondrons sous 24-48h</span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            <Link to="/" className="text-xs text-primary hover:underline font-body inline-block mt-4">
              ← Retour au site
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Step content ───────────────────────────────────────

  const stepTitles = [
    "Quel type de projet ?",
    "De quelles fonctionnalités avez-vous besoin ?",
    "Options & délais",
    "Votre estimation",
    "Vos coordonnées",
  ];

  const stepSubtitles = [
    "Sélectionnez la catégorie qui correspond le mieux à votre projet.",
    "Activez les modules dont vous avez besoin. Nous avons pré-sélectionné les plus courants.",
    "Choisissez vos préférences de délai, taille du site, hébergement et maintenance.",
    "Voici une estimation basée sur vos choix. Les prix finaux dépendent de la complexité exacte.",
    "Recevez votre estimation détaillée et une proposition personnalisée.",
  ];

  const cta = CTA_LABELS[step];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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

      {/* Content */}
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
            {/* Step title */}
            <div className="mb-8">
              <h1 className="font-display text-xl sm:text-2xl font-semibold">{stepTitles[step - 1]}</h1>
              <p className="text-sm text-muted-foreground font-body mt-1">{stepSubtitles[step - 1]}</p>
            </div>

            {/* ── Step 1: Project Type ── */}
            {step === 1 && (
              <motion.div
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {PROJECT_TYPES.map(pt => (
                  <motion.button
                    key={pt.slug}
                    variants={staggerItem}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setProjectType(pt.label); setProjectSlug(pt.slug); }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                      projectSlug === pt.slug
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 hover:border-border hover:bg-secondary/20"
                    )}
                  >
                    <span className="text-2xl">{pt.emoji}</span>
                    <span className="text-xs font-body font-medium">{pt.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* ── Step 2: Module Picker ── */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Running total */}
                <div className="sticky top-[5.5rem] z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-2 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-body">
                      {selectedModules.length} module{selectedModules.length !== 1 ? "s" : ""} · Base projet incluse
                    </span>
                    <motion.span
                      key={estimate.devTotal}
                      initial={{ scale: 1.12, color: "hsl(215 45% 30%)" }}
                      animate={{ scale: 1, color: "hsl(220 30% 12%)" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="font-display text-sm font-semibold"
                    >
                      ~CHF {formatCHF(estimate.devTotal)}
                    </motion.span>
                  </div>
                </div>

                {/* Collapsible complexity legend */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={toggleLegend}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-xs font-display font-bold text-foreground">
                      Comment ça marche ?
                    </span>
                    <motion.div
                      animate={{ rotate: legendOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {legendOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-body">
                            <div className="bg-background/80 rounded-lg p-2.5">
                              <span className="font-semibold text-foreground block mb-0.5">Simple</span>
                              <span className="text-muted-foreground text-xs">L'essentiel, fonctionnel et efficace.</span>
                            </div>
                            <div className="bg-background/80 rounded-lg p-2.5">
                              <span className="font-semibold text-foreground block mb-0.5">Avancé</span>
                              <span className="text-muted-foreground text-xs">Plus de fonctionnalités et de personnalisation.</span>
                            </div>
                            <div className="bg-background/80 rounded-lg p-2.5">
                              <span className="font-semibold text-foreground block mb-0.5">Sur mesure</span>
                              <span className="text-muted-foreground text-xs">Solution 100% adaptée à vos besoins.</span>
                            </div>
                          </div>
                          <p className="text-xs text-foreground/70 font-body">
                            Activez ou désactivez chaque module avec le bouton à droite. Le niveau de complexité se règle en dessous.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Modules by category */}
                {(["content", "interaction", "commerce", "system"] as const).map(cat => {
                  const catModules = MODULE_CATALOG.filter(m => m.category === cat);
                  if (catModules.length === 0) return null;

                  return (
                    <motion.div
                      key={cat}
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                    >
                      <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-2">
                        {CATEGORY_LABELS[cat]}
                      </h3>
                      <div className="space-y-2">
                        {catModules.map(mod => {
                          const sel = selectedModules.find(s => s.id === mod.id);
                          const isOn = !!sel;
                          const price = isOn ? getModulePrice(mod.id, sel!.complexity) : getModulePrice(mod.id, "simple");

                          return (
                            <motion.div
                              key={mod.id}
                              variants={staggerItem}
                              layout
                              className={cn(
                                "rounded-xl border-2 transition-all overflow-hidden",
                                isOn
                                  ? "border-primary/60 bg-primary/[0.03]"
                                  : "border-border/40 hover:border-border/70"
                              )}
                            >
                              {/* Toggle row */}
                              <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => toggleModule(mod.id)}
                                className="w-full flex items-center gap-3 px-3 py-3 text-left"
                              >
                                <motion.div
                                  animate={{
                                    scale: isOn ? 1 : 0.92,
                                    backgroundColor: isOn ? "hsl(215 45% 30% / 0.1)" : "hsl(35 12% 88% / 0.6)",
                                  }}
                                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                    isOn ? "text-primary" : "text-muted-foreground"
                                  )}
                                >
                                  <ModuleIcon name={mod.icon} size={16} />
                                </motion.div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm font-body font-medium flex items-center gap-1.5",
                                    isOn ? "text-foreground" : "text-muted-foreground"
                                  )}>
                                    {mod.name}
                                    {POPULAR_MODULES.has(mod.id) && (
                                      <span className="text-[10px] font-body font-semibold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full leading-none">
                                        Populaire
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground/60 font-body">{mod.description}</p>
                                </div>
                                <span className={cn(
                                  "text-xs font-mono tabular-nums shrink-0 mr-2",
                                  isOn ? "text-primary font-semibold" : "text-muted-foreground/50"
                                )}>
                                  {price > 0 ? `${formatCHF(price)}` : "Nous évaluerons ensemble"}
                                </span>
                                {/* Toggle indicator */}
                                <div className={cn(
                                  "w-9 h-5 rounded-full shrink-0 relative transition-colors duration-200",
                                  isOn ? "bg-primary" : "bg-border"
                                )}>
                                  <motion.div
                                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                                    animate={{ left: isOn ? 18 : 2 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  />
                                </div>
                              </motion.button>

                              {/* Complexity selector (animated slide-down) */}
                              <AnimatePresence>
                                {isOn && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-3 pb-3 flex gap-1.5">
                                      {mod.tiers.map(tier => (
                                        <button
                                          key={tier.complexity}
                                          onClick={() => setModuleComplexity(mod.id, tier.complexity)}
                                          className={cn(
                                            "flex-1 px-2 py-1.5 rounded-lg text-xs font-body font-medium transition-all text-center",
                                            sel!.complexity === tier.complexity
                                              ? "bg-primary text-primary-foreground shadow-sm"
                                              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                                          )}
                                        >
                                          <span className="block">{COMPLEXITY_LABELS[tier.complexity]}</span>
                                          <span className="block font-mono opacity-70">{formatCHF(tier.price)}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── Step 3: Options ── */}
            {step === 3 && (
              <motion.div
                className="space-y-8"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {/* Timeline */}
                <motion.div variants={staggerItem}>
                  <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Délai souhaité
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {TIMELINE_OPTIONS.map(opt => (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setTimeline(opt.value)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                          timeline === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        )}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="text-xs font-body font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground/60 font-body">{opt.sub}</span>
                      </motion.button>
                    ))}
                  </div>
                  {timeline === "urgent" && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-amber-600 font-body mt-2"
                    >
                      ⚡ Un supplément de 20% s'applique pour les projets urgents.
                    </motion.p>
                  )}
                </motion.div>

                {/* Page count */}
                <motion.div variants={staggerItem}>
                  <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Nombre de pages
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {PAGE_COUNT_OPTIONS.map(opt => (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setPageCount(opt.value)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                          pageCount === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        )}
                      >
                        <FileText size={16} className={pageCount === opt.value ? "text-primary" : "text-muted-foreground"} />
                        <span className="text-xs font-body font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground/60 font-body">{opt.sub}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* Hosting */}
                <motion.div variants={staggerItem}>
                  <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Hébergement
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {HOSTING_OPTIONS.map(opt => (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setHostingTier(opt.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center",
                          hostingTier === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        )}
                      >
                        <Server size={16} className={hostingTier === opt.value ? "text-primary" : "text-muted-foreground"} />
                        <span className="text-xs font-body font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground/60 font-body">{opt.sub}</span>
                      </motion.button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/50 font-body mt-2">
                    Si vous ne savez pas, laissez « Hébergement inclus ». Nous configurons tout pour vous.
                  </p>
                </motion.div>

                {/* Maintenance */}
                <motion.div variants={staggerItem}>
                  <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Maintenance
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {MAINTENANCE_OPTIONS.map(opt => (
                      <motion.button
                        key={opt.tier}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setMaintenance(opt.tier)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center",
                          maintenance === opt.tier
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        )}
                      >
                        <Settings size={16} className={maintenance === opt.tier ? "text-primary" : "text-muted-foreground"} />
                        <span className="text-xs font-body font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground/60 font-body">{opt.description}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── Step 4: Price Estimate ── */}
            {step === 4 && (
              <div className="space-y-6">
                {/* Big price display */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative bg-gradient-to-br from-primary/5 to-primary/[0.02] border-2 border-primary/20 rounded-2xl p-6 text-center space-y-3 overflow-hidden"
                >
                  <ConfettiBurst count={20} spread={240} />
                  <p className="text-xs text-muted-foreground font-body uppercase tracking-widest">Estimation du projet</p>
                  <p className="font-display text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
                    <span className="inline-grid">
                      {/* Invisible placeholder reserves final width to prevent layout shift */}
                      <span className="col-start-1 row-start-1 invisible" aria-hidden="true">
                        CHF {formatCHF(estimate.low)} – {formatCHF(estimate.high)}
                      </span>
                      <span className="col-start-1 row-start-1">
                        CHF {formatCHF(countLow)} – {formatCHF(countHigh)}
                      </span>
                    </span>
                  </p>
                  {timeline === "urgent" && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="text-xs text-amber-600 font-body"
                    >
                      Inclut le supplément urgence (+20%)
                    </motion.p>
                  )}
                  {selectedModules.length >= 4 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.9 }}
                      className="text-xs text-emerald-600 font-body"
                    >
                      Remise multi-modules appliquée (-10%)
                    </motion.p>
                  )}
                </motion.div>

                {/* Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                  className="space-y-2"
                >
                  <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                    Détail du développement
                  </h3>

                  {/* Base cost */}
                  <div className="flex justify-between text-sm font-body py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground">Base projet (design, responsive, mise en ligne)</span>
                    <span className="font-mono tabular-nums">{formatCHF(BASE_PROJECT_COST)}</span>
                  </div>

                  {/* Selected modules */}
                  {selectedModules.map((sel, i) => {
                    const mod = MODULE_CATALOG.find(m => m.id === sel.id);
                    if (!mod) return null;
                    const price = getModulePrice(sel.id, sel.complexity);
                    return (
                      <motion.div
                        key={sel.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.04 }}
                        className="flex justify-between text-sm font-body py-1.5 border-b border-border/30"
                      >
                        <span>
                          {mod.name}
                          <span className="text-muted-foreground/50 ml-1.5 text-xs">
                            ({COMPLEXITY_LABELS[sel.complexity]})
                          </span>
                        </span>
                        <span className="font-mono tabular-nums">{formatCHF(price)}</span>
                      </motion.div>
                    );
                  })}

                  {/* Page count surcharge */}
                  {estimate.pageExtra > 0 && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + selectedModules.length * 0.04 }}
                      className="flex justify-between text-sm font-body py-1.5 border-b border-border/30"
                    >
                      <span className="text-muted-foreground">Pages supplémentaires ({PAGE_COUNT_OPTIONS.find(p => p.value === pageCount)?.label})</span>
                      <span className="font-mono tabular-nums">{formatCHF(estimate.pageExtra)}</span>
                    </motion.div>
                  )}

                  {selectedModules.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 font-body py-2 italic">
                      Aucun module sélectionné, projet de base uniquement.
                    </p>
                  )}
                </motion.div>

                {/* Yearly costs */}
                {estimate.yearly > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="bg-secondary/30 rounded-xl p-4 space-y-1"
                  >
                    <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                      Coûts annuels
                    </h3>
                    <p className="font-display text-lg font-semibold">
                      CHF {formatCHF(estimate.yearly)}/an
                    </p>
                    <p className="text-xs text-muted-foreground/60 font-body">
                      Hébergement, maintenance et frais récurrents inclus.
                    </p>
                  </motion.div>
                )}

                {/* Disclaimer */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-xs text-muted-foreground/50 font-body text-center leading-relaxed"
                >
                  Cette estimation est une base de travail indicative. Le devis final sera ajusté
                  en fonction de la complexité exacte de votre projet lors de notre échange.
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  className="text-xs text-emerald-600 font-body text-center font-medium"
                >
                  La première séance de cadrage est offerte.
                </motion.p>
              </div>
            )}

            {/* ── Step 5: Contact ── */}
            {step === 5 && (
              <motion.div
                className="space-y-4"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {/* Mini recap */}
                <motion.div variants={staggerItem} className="bg-secondary/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Votre estimation</p>
                    <p className="font-display text-lg font-semibold">
                      CHF {formatCHF(estimate.low)} – {formatCHF(estimate.high)}
                    </p>
                  </div>
                  <button
                    onClick={() => { setDirection(-1); setStep(4); }}
                    className="text-xs text-primary font-body hover:underline"
                  >
                    Voir le détail
                  </button>
                </motion.div>

                {/* Name with validation */}
                <motion.div variants={staggerItem} className="relative">
                  <Input
                    placeholder="Nom complet *"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    className={cn("h-11 pr-9", nameTouched && isNameValid && "border-emerald-400")}
                  />
                  {nameTouched && isNameValid && (
                    <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                </motion.div>

                {/* Email with validation */}
                <motion.div variants={staggerItem} className="relative">
                  <Input
                    placeholder="Email *"
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    className={cn(
                      "h-11 pr-9",
                      emailTouched && isEmailValid && "border-emerald-400",
                      emailTouched && contactEmail.length > 0 && !isEmailValid && "border-destructive"
                    )}
                  />
                  {emailTouched && isEmailValid && (
                    <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                  {emailTouched && contactEmail.length > 0 && !isEmailValid && (
                    <p className="text-xs text-destructive font-body mt-1">Veuillez entrer un email valide</p>
                  )}
                </motion.div>

                <motion.div variants={staggerItem}>
                  <Input
                    placeholder="Téléphone (optionnel)"
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="h-11"
                  />
                </motion.div>
                <motion.div variants={staggerItem}>
                  <Input
                    placeholder="Entreprise (optionnel)"
                    value={contactCompany}
                    onChange={e => setContactCompany(e.target.value)}
                    className="h-11"
                  />
                </motion.div>
                <motion.div variants={staggerItem}>
                  <textarea
                    placeholder="Ex: refonte de notre site actuel, ajout d'une boutique en ligne... (optionnel)"
                    value={contactMessage}
                    onChange={e => setContactMessage(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </motion.div>

                {/* Privacy note */}
                <motion.div variants={staggerItem} className="flex items-center gap-2 text-xs text-muted-foreground/60 font-body">
                  <Shield size={12} className="shrink-0" />
                  <span>Vos données restent confidentielles et ne seront jamais partagées.</span>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
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
