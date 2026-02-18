import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { Coffee, Rocket, TrendingUp, MousePointerClick } from "lucide-react";

const steps = [
  {
    icon: Coffee,
    titleFr: "Séance autour d'un café",
    titleEn: "Coffee Session",
    descFr: "Une première heure offerte pour comprendre vos besoins et établir un devis précis en crédits.",
    descEn: "A first free hour to understand your needs and deliver a precise credit estimate.",
    creditFr: "0 crédit",
    creditEn: "0 credits",
  },
  {
    icon: MousePointerClick,
    titleFr: "Validation du Design en 1 clic",
    titleEn: "1-Click Design Validation",
    descFr: "Notre outil de feedback permet à votre équipe et vos parties prenantes de voter directement sur plusieurs propositions de design. Zéro friction, décision rapide.",
    descEn: "Our feedback tool lets your team and stakeholders vote directly on multiple design proposals. Zero friction, fast decisions.",
    creditFr: "Décision collective",
    creditEn: "Collective decision",
  },
  {
    icon: Rocket,
    titleFr: "MVP – Le Cœur du Projet",
    titleEn: "Core MVP – Viability First",
    descFr: "Nous construisons les fonctionnalités essentielles pour valider votre concept avant d'investir davantage.",
    descEn: "We build the essential features to validate your concept before investing further.",
    creditFr: "Must-haves d'abord",
    creditEn: "Must-haves first",
  },
  {
    icon: TrendingUp,
    titleFr: "Raffinement & Croissance",
    titleEn: "Refinement & Scaling",
    descFr: "Itérations et améliorations basées sur les retours réels. Les nice-to-have viennent ensuite.",
    descEn: "Iterations and improvements based on real feedback. Nice-to-haves come after.",
    creditFr: "Nice-to-haves ensuite",
    creditEn: "Nice-to-haves next",
  },
];

const MethodologySection = () => {
  const { t } = useLanguage();

  return (
    <section id="methodology" className="section-spacing">
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
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver">
            {t("Une méthodologie transparente", "A transparent methodology")}
          </h2>
        </motion.div>

        <div className="relative">
          {/* Timeline line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-border" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="glass-card-hover p-6 text-center relative"
              >
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground font-display">
                  {i + 1}
                </div>

                <div className="w-12 h-12 mx-auto mb-4 mt-2 rounded-lg bg-secondary flex items-center justify-center">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>

                <h3 className="font-display text-base font-semibold text-foreground mb-3">
                  {t(step.titleFr, step.titleEn)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {t(step.descFr, step.descEn)}
                </p>
                <span className="text-xs font-medium uppercase tracking-wider text-primary">
                  {t(step.creditFr, step.creditEn)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MethodologySection;
