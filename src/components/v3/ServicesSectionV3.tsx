import { useLanguage } from "@/hooks/useLanguage";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion } from "framer-motion";
import { MousePointer2 } from "lucide-react";
import { SmartFilterDemo } from "@/components/home/SmartFilterDemo";
import { SitePreviewDemo } from "@/components/home/SitePreviewDemo";

import { ProcessOptDemo } from "@/components/home/ProcessOptDemo";

const CARDS = [
  {
    delay: 0,
    titleFr: "Outils internes sur mesure",
    titleEn: "Custom internal tools",
    descFr: "Applications métier, dashboards, CRM : des interfaces qui rendent vos données exploitables.",
    descEn: "Business apps, dashboards, CRM: interfaces that make your data actionable.",
    Demo: SmartFilterDemo,
    accent: "border-l-indigo-500",
  },
  {
    delay: 0.15,
    titleFr: "Site internet",
    titleEn: "Websites",
    descFr: "Vitrine, site avancé ou portail client. Un design soigné et une expérience fluide.",
    descEn: "Showcase, advanced site or client portal. Polished design and seamless experience.",
    Demo: SitePreviewDemo,
    accent: "border-l-primary",
  },
  {
    delay: 0.3,
    titleFr: "Conseil & Accompagnement",
    titleEn: "Consulting & Support",
    descFr: "Stratégie et optimisation de vos processus internes pour maximiser votre efficacité digitale.",
    descEn: "Strategy and internal process optimization to maximize your digital efficiency.",
    Demo: ProcessOptDemo,
    accent: "border-l-amber-500",
  },
];

const ServicesSectionV3 = () => {
  const { t } = useLanguage();
  const ref = useScrollReveal<HTMLElement>();

  return (
    <section ref={ref} data-reveal id="services" className="section-spacing bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            {t("Ce que nous construisons", "What we build")}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver mb-4">
            {t("Des outils qui font la différence", "Tools that make a difference")}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs font-body font-medium text-primary">
              <MousePointer2 className="w-3.5 h-3.5" />
              {t("Interactif", "Interactive")}
            </span>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {CARDS.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: card.delay, duration: 0.6 }}
              className={`glass-card p-6 sm:p-8 rounded-2xl border-l-4 ${card.accent}`}
            >
              <card.Demo />
              <div className="mt-5 pt-5 border-t border-border/30">
                <h3 className="font-display text-lg font-semibold text-foreground mb-1.5">
                  {t(card.titleFr, card.titleEn)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-body">
                  {t(card.descFr, card.descEn)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center mt-12"
        >
          <a
            href="/intake"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-display font-medium transition-colors"
          >
            {t("Estimez votre projet en 2 minutes", "Estimate your project in 2 minutes")} →
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ServicesSectionV3;
