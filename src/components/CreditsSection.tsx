import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { Clock, CreditCard, CheckCircle } from "lucide-react";

const CreditsSection = () => {
  const { t } = useLanguage();

  return (
    <section id="credits" className="section-spacing">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
            {t("Simple & Transparent", "Simple & Transparent")}
          </p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver">
            {t("Le système de crédits", "The credit system")}
          </h2>
        </motion.div>

        {/* Big statement */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card-hover p-12 text-center mb-12"
        >
          <p className="font-display text-5xl md:text-7xl font-bold text-gradient-primary mb-4">
            1 {t("Crédit", "Credit")} = 1 {t("Heure", "Hour")}
          </p>
          <p className="text-muted-foreground text-lg">
            {t("Pas de frais cachés. Pas de surprise.", "No hidden fees. No surprises.")}
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: CreditCard,
              fr: "Achetez un pack de crédits",
              en: "Buy a credit pack",
            },
            {
              icon: Clock,
              fr: "Soumettez une tâche",
              en: "Submit a task",
            },
            {
              icon: CheckCircle,
              fr: "On déduit le temps passé",
              en: "We deduct time spent",
            },
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="glass-card p-6 text-center"
            >
              <step.icon className="w-8 h-8 text-primary mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">{t(step.fr, step.en)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CreditsSection;
