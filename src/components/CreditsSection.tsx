import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion } from "framer-motion";
import { Clock, CreditCard, CheckCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { AllocationBar } from "@/components/home/AllocationBar";
import { cn } from "@/lib/utils";

const packs = [
  { hours: 5, hFr: "5 heures", hEn: "5 hours", chf: "500" },
  { hours: 10, hFr: "10 heures", hEn: "10 hours", chf: "1 000" },
  { hours: 20, hFr: "20 heures", hEn: "20 hours", chf: "2 000" },
];

const CreditsSection = () => {
  const { t } = useLanguage();
  const ref = useScrollReveal<HTMLElement>();
  const [selectedPack, setSelectedPack] = useState(1); // default to 10h


  return (
    <section ref={ref} data-reveal id="credits" className="section-spacing">
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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card-hover p-10 text-center mb-10"
        >
          <p className="font-display text-4xl md:text-6xl font-bold text-gradient-primary mb-3">
            1 {t("Crédit", "Credit")} = 1h = 100 CHF
          </p>
        </motion.div>

        {/* Allocation visualizer */}
        <AllocationBar />

        {/* Selectable packs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3">
          {packs.map((pack, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              onClick={() => setSelectedPack(i)}
              className={cn(
                "glass-card p-7 text-center relative cursor-pointer transition-all duration-300",
                selectedPack === i
                  ? "ring-2 ring-primary/60 scale-[1.03] shadow-lg"
                  : "hover:ring-1 hover:ring-border/50",
                i === 1 && selectedPack !== 1 && "ring-1 ring-primary/20",
              )}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
                  {t("Le plus populaire", "Most popular")}
                </span>
              )}
              <p className="font-display text-base font-medium text-muted-foreground mb-2">
                {t(pack.hFr, pack.hEn)}
              </p>
              <p className="font-display text-3xl md:text-4xl font-bold text-gradient-primary mb-1">
                {pack.chf} CHF
              </p>
              <p className="text-xs text-muted-foreground">100 CHF / h</p>
            </motion.button>
          ))}
        </div>

        <div className="mb-10" />

        {/* 3-step process with numbers and connector */}
        <div className="relative mb-8">
          {/* Connector line */}
          <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-px bg-border z-0" />
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: CreditCard, fr: "Achetez un pack de crédits", en: "Buy a credit pack" },
              { icon: Clock,       fr: "Soumettez une tâche",        en: "Submit a task"    },
              { icon: CheckCircle, fr: "Suivi transparent en temps réel", en: "Transparent real-time tracking" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="glass-card p-6 text-center relative"
              >
                {/* Step number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground font-display z-10">
                  {i + 1}
                </div>
                <step.icon className="w-8 h-8 text-primary mx-auto mb-4 mt-1" />
                <p className="text-sm font-medium text-foreground">{t(step.fr, step.en)}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Budget section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card-hover p-8 mb-8 text-center border border-primary/10"
        >
          <p className="font-display text-lg font-semibold text-foreground mb-2">
            {t("Vous avez un budget précis ?", "Have a specific budget?")}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto mb-5">
            {t(
              "Dites-nous votre budget, et nous vous proposons un plan clair : fonctionnalités prioritaires, phases de livraison et un calendrier adapté.",
              "Tell us your budget, and we'll provide a clear plan: priority features, delivery phases, and a tailored timeline."
            )}
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 text-sm font-display font-semibold text-primary hover:text-primary/80 transition-colors group"
          >
            {t("Discuter de mon budget", "Discuss my budget")}
            <motion.span
              animate={{ x: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <ArrowRight className="w-4 h-4" />
            </motion.span>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <ShieldCheck size={16} className="text-primary shrink-0" />
          <span>
            {t(
              "Paiement par carte bancaire en ligne disponible, sécurisé et instantané.",
              "Online credit card payment available, secure and instant."
            )}
          </span>
        </motion.div>
      </div>
    </section>
  );
};

export default CreditsSection;
