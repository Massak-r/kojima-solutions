import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { ChevronDown, Lightbulb } from "lucide-react";

interface Segment {
  labelFr: string;
  labelEn: string;
  descFr: string;
  descEn: string;
  units: number;
  color: string;
  bgClass: string;
}

const SEGMENTS: Segment[] = [
  {
    labelFr: "Cadrage", labelEn: "Scoping",
    descFr: "Analyse des besoins, cahier des charges", descEn: "Requirements analysis, specifications",
    units: 1, color: "hsl(145, 20%, 44%)", bgClass: "bg-[hsl(145,20%,44%)]",
  },
  {
    labelFr: "Design", labelEn: "Design",
    descFr: "Maquettes UI, validation visuelle", descEn: "UI mockups, visual validation",
    units: 2, color: "hsl(258, 28%, 48%)", bgClass: "bg-[hsl(258,28%,48%)]",
  },
  {
    labelFr: "Développement", labelEn: "Development",
    descFr: "Code, intégration, itérations", descEn: "Code, integration, iterations",
    units: 5, color: "hsl(215, 45%, 30%)", bgClass: "bg-primary",
  },
  {
    labelFr: "Tests & Déploiement", labelEn: "Testing & Deployment",
    descFr: "QA, corrections, mise en production", descEn: "QA, fixes, go-live",
    units: 2, color: "hsl(36, 42%, 48%)", bgClass: "bg-[hsl(36,42%,48%)]",
  },
];

const TOTAL = SEGMENTS.reduce((sum, s) => sum + s.units, 0);

interface Phase {
  titleFr: string;
  titleEn: string;
  tasks: { fr: string; en: string; hours: number }[];
  color: string;
}

const PROJECT_PHASES: Phase[] = [
  {
    titleFr: "Site internet", titleEn: "Website",
    color: "bg-[hsl(145,20%,44%)]",
    tasks: [
      { fr: "Design & intégration", en: "Design & integration", hours: 5 },
      { fr: "Pages & contenu", en: "Pages & content", hours: 4 },
      { fr: "Responsive & tests", en: "Responsive & testing", hours: 3 },
    ],
  },
  {
    titleFr: "Module inscription", titleEn: "Registration module",
    color: "bg-[hsl(258,28%,48%)]",
    tasks: [
      { fr: "Formulaire en ligne", en: "Online form", hours: 4 },
      { fr: "Emails auto & billets", en: "Auto emails & tickets", hours: 3 },
      { fr: "Paiement intégré", en: "Integrated payment", hours: 5 },
    ],
  },
  {
    titleFr: "Dashboard participants", titleEn: "Attendee dashboard",
    color: "bg-primary",
    tasks: [
      { fr: "Vue d'ensemble & stats", en: "Overview & stats", hours: 5 },
      { fr: "Gestion inscriptions", en: "Registration management", hours: 4 },
      { fr: "Export & filtres", en: "Export & filters", hours: 3 },
    ],
  },
  {
    titleFr: "Gestion de groupes", titleEn: "Group management",
    color: "bg-[hsl(36,42%,48%)]",
    tasks: [
      { fr: "Création de groupes", en: "Group creation", hours: 4 },
      { fr: "Attribution automatique", en: "Auto assignment", hours: 4 },
      { fr: "Notifications & rappels", en: "Notifications & reminders", hours: 4 },
    ],
  },
];

const PROJECT_TOTAL = PROJECT_PHASES.reduce((sum, p) => sum + p.tasks.reduce((s, t) => s + t.hours, 0), 0);

export function AllocationBarV3() {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState<number | null>(null);
  const [showExample, setShowExample] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="glass-card p-6 sm:p-8 mb-10 overflow-visible"
    >
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-display font-semibold text-foreground">
          {t("Projet type", "Typical project")}
        </p>
        <p className="text-xs font-mono text-primary font-semibold">{TOTAL} {t("unités", "units")}</p>
      </div>

      {/* Bar */}
      <div className="flex h-10 sm:h-12 rounded-xl gap-0.5 mb-4 relative">
        {SEGMENTS.map((seg, i) => {
          const tooltipAlign = i === 0
            ? "left-0"
            : i === SEGMENTS.length - 1
              ? "right-0"
              : "left-1/2 -translate-x-1/2";

          return (
            <motion.div
              key={i}
              className={cn(
                "relative flex items-center justify-center cursor-pointer",
                seg.bgClass,
                i === 0 && "rounded-l-xl",
                i === SEGMENTS.length - 1 && "rounded-r-xl",
              )}
              style={{ flex: seg.units }}
              onHoverStart={() => setHovered(i)}
              onHoverEnd={() => setHovered(null)}
              onTapStart={() => setHovered(prev => prev === i ? null : i)}
              animate={{
                scaleY: hovered === i ? 1.15 : 1,
                zIndex: hovered === i ? 10 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <span className={cn(
                "text-white font-body font-semibold text-[10px] sm:text-xs truncate px-1",
                seg.units < 2 && "hidden sm:inline",
              )}>
                {seg.units}u
              </span>

              {/* Tooltip */}
              {hovered === i && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("absolute -top-[72px] z-30 w-48 sm:w-52", tooltipAlign)}
                >
                  <div className="bg-background p-2.5 rounded-lg shadow-xl border border-border/60 text-center backdrop-blur-xl">
                    <p className="text-[11px] font-display font-semibold text-foreground mb-0.5">
                      {t(seg.labelFr, seg.labelEn)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-body leading-snug">
                      {t(seg.descFr, seg.descEn)}
                    </p>
                    <p className="text-[10px] font-mono text-primary font-semibold mt-0.5">
                      {seg.units} {t("unité" + (seg.units > 1 ? "s" : ""), "unit" + (seg.units > 1 ? "s" : ""))}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 sm:gap-x-5 gap-y-1.5 justify-center mb-4">
        {SEGMENTS.map((seg, i) => (
          <button
            key={i}
            onClick={() => setHovered(prev => prev === i ? null : i)}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-body transition-opacity cursor-pointer",
              hovered !== null && hovered !== i ? "opacity-40" : "opacity-100",
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", seg.bgClass)} />
            <span className="text-muted-foreground">{t(seg.labelFr, seg.labelEn)}</span>
            <span className="text-muted-foreground/50 font-mono">({seg.units}u)</span>
          </button>
        ))}
      </div>

      {/* Project phases breakdown — HIGHLIGHTED button */}
      <div className="border-t border-border/30 pt-4">
        <button
          onClick={() => setShowExample(v => !v)}
          className="flex items-center gap-2 w-full px-4 py-3 rounded-lg bg-primary/8 border border-primary/20 hover:bg-primary/12 transition-colors group"
        >
          <Lightbulb className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-display font-semibold text-primary">
            {t("Exemple de projet par étape", "Project example by phase")}
          </span>
          <ChevronDown className={cn("w-4 h-4 text-primary transition-transform duration-300 ml-auto", showExample && "rotate-180")} />
          <span className="font-mono text-xs text-primary/60 font-semibold">{PROJECT_TOTAL}u</span>
        </button>

        <AnimatePresence>
          {showExample && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-3">
                {PROJECT_PHASES.map((phase, pi) => {
                  const phaseTotal = phase.tasks.reduce((s, t) => s + t.hours, 0);
                  return (
                    <motion.div
                      key={pi}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: pi * 0.08, duration: 0.25 }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", phase.color)} />
                        <span className="text-xs font-display font-semibold text-foreground">
                          {t(phase.titleFr, phase.titleEn)}
                        </span>
                        <span className="ml-auto text-xs font-mono text-muted-foreground/60">{phaseTotal}u</span>
                      </div>
                      <div className="ml-5 pl-3 border-l-2 border-border/20 space-y-1">
                        {phase.tasks.map((task, ti) => (
                          <div key={ti} className="flex items-center justify-between text-[11px] font-body text-muted-foreground">
                            <span>{t(task.fr, task.en)}</span>
                            <span className="font-mono text-foreground/60 font-medium">{task.hours}u</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
                <div className="flex items-center justify-between pt-3 border-t border-border/30 text-sm font-body">
                  <span className="font-display font-semibold text-foreground">Total</span>
                  <span className="font-mono font-bold text-primary">{PROJECT_TOTAL}u = {(PROJECT_TOTAL * 100).toLocaleString("fr-CH")} CHF</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
