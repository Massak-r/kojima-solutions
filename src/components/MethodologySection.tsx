import { useLanguage } from "@/hooks/useLanguage";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion } from "framer-motion";
import { Coffee, Rocket, TrendingUp, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { DesignVoteDemo } from "@/components/home/DesignVoteDemo";

const steps = [
  {
    icon: Coffee,
    titleFr: "Séance autour d'un café",
    titleEn: "Coffee Session",
    descFr: "Une première heure offerte pour comprendre vos besoins et établir un plan d'action.",
    descEn: "A first free hour to understand your needs and establish an action plan.",
    badgeFr: "0 crédit",
    badgeEn: "0 credits",
    badgeClass: "text-primary bg-primary/10 border border-primary/20",
    deliverableFr: "Définition d'un cahier des charges clair",
    deliverableEn: "Clear requirements definition",
  },
  {
    icon: MousePointerClick,
    titleFr: "Validation à chaque étape",
    titleEn: "Validation at every step",
    descFr: "Notre outil permet à vos parties prenantes de voter directement sur les propositions de design, du plus large au plus précis.",
    descEn: "Our tool lets your stakeholders vote directly on design proposals, from broad strokes to fine details.",
    badgeFr: "Outil de décision",
    badgeEn: "Decision tool",
    badgeClass: "text-palette-violet bg-palette-violet/10 border border-palette-violet/20",
    deliverableFr: "Maquettes validées",
    deliverableEn: "Validated mockups",
  },
  {
    icon: Rocket,
    titleFr: "MVP : Le Cœur du Projet",
    titleEn: "Core MVP: Viability First",
    descFr: "Nous construisons les fonctionnalités essentielles pour valider votre concept rapidement.",
    descEn: "We build the essential features to validate your concept quickly.",
    badgeFr: "Must-haves",
    badgeEn: "Must-haves",
    badgeClass: "text-palette-amber bg-palette-amber/10 border border-palette-amber/20",
    deliverableFr: "Application fonctionnelle",
    deliverableEn: "Working application",
  },
  {
    icon: TrendingUp,
    titleFr: "Raffinement & Croissance",
    titleEn: "Refinement & Scaling",
    descFr: "Itérations et améliorations basées sur les retours réels. Les nice-to-haves viennent après.",
    descEn: "Iterations and improvements based on real feedback. Nice-to-haves come after.",
    badgeFr: "Nice-to-haves",
    badgeEn: "Nice-to-haves",
    badgeClass: "text-muted-foreground bg-secondary border border-border",
    deliverableFr: "Améliorations continues",
    deliverableEn: "Continuous improvements",
  },
];

const MethodologySection = () => {
  const { t } = useLanguage();
  const ref = useScrollReveal<HTMLElement>();

  return (
    <section ref={ref} data-reveal id="methodology" className="section-spacing">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            {t("Notre Approche", "Our Approach")}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver mb-4">
            {t("Une méthodologie transparente", "A transparent methodology")}
          </h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            {t(
              "Cette approche nous permet de livrer plus vite et à moindre coût qu'une agence traditionnelle.",
              "This approach lets us deliver faster and at a lower cost than a traditional agency."
            )}
          </p>
        </motion.div>

        <div className="relative">
          {/* Timeline connector line */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-border z-0" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className={cn(
                  "glass-card-hover p-6 text-center relative flex flex-col h-full",
                  i === 1 && "overflow-visible z-20",
                )}
              >
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground font-display z-10">
                  {i + 1}
                </div>

                {/* Card content */}
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-12 h-12 mx-auto mb-4 mt-2 rounded-lg bg-secondary flex items-center justify-center">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-foreground mb-3">
                    {t(step.titleFr, step.titleEn)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(step.descFr, step.descEn)}
                  </p>
                  {i === 1 && <DesignVoteDemo />}
                  <p className="text-xs text-primary/70 mt-2.5 italic font-body">
                    → {t(step.deliverableFr, step.deliverableEn)}
                  </p>
                </div>

                {/* Bottom-pinned process badge */}
                <div className="mt-6 pt-4 border-t border-primary/10 flex justify-center">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${step.badgeClass}`}>
                    <step.icon className="w-3 h-3" />
                    {t(step.badgeFr, step.badgeEn)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MethodologySection;
