import { useLanguage } from "@/hooks/useLanguage";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion, AnimatePresence } from "framer-motion";
import { useState, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "all" | "pricing" | "process" | "technical";

const CATEGORIES: { key: Category; fr: string; en: string }[] = [
  { key: "all", fr: "Tous", en: "All" },
  { key: "pricing", fr: "Tarifs", en: "Pricing" },
  { key: "process", fr: "Processus", en: "Process" },
  { key: "technical", fr: "Technique", en: "Technical" },
];

const faqs: { qFr: string; qEn: string; aFr: string; aEn: string; category: Category }[] = [
  {
    qFr: "C'est quoi exactement une unité de développement ?",
    qEn: "What exactly is a development unit?",
    aFr: "1 unité de développement = 100 CHF. Vous achetez un pack d'unités, vous soumettez des tâches, et on déduit le temps réel passé.",
    aEn: "1 development unit = 100 CHF. You buy a unit pack, submit tasks, and we deduct actual time spent.",
    category: "pricing",
  },
  {
    qFr: "Combien de temps prend un projet ?",
    qEn: "How long does a project take?",
    aFr: "Un MVP simple (site vitrine ou app basique) prend généralement 2 à 4 semaines. Des projets plus complexes peuvent prendre 6 à 12 semaines. Nous donnons toujours un délai réaliste dès la première séance.",
    aEn: "A simple MVP (landing page or basic app) typically takes 2 to 4 weeks. More complex projects can take 6 to 12 weeks. We always give a realistic timeline from the first session.",
    category: "process",
  },
  {
    qFr: "Je ne suis pas technique, est-ce un problème ?",
    qEn: "I'm not technical, is that a problem?",
    aFr: "Pas du tout. Nous travaillons avec des fondateurs, entrepreneurs et PME sans background tech. Nous traduisons vos besoins en solutions concrètes, et vous restez décisionnaire à chaque étape.",
    aEn: "Not at all. We work with founders, entrepreneurs and SMEs without a tech background. We translate your needs into concrete solutions, and you stay in control at every step.",
    category: "technical",
  },
  {
    qFr: "La première séance est vraiment gratuite ?",
    qEn: "Is the first session really free?",
    aFr: "Oui. Une heure autour d'un café (en personne ou en visio) pour comprendre votre projet, répondre à vos questions et établir un devis. Aucun engagement requis.",
    aEn: "Yes. One hour over coffee (in person or video call) to understand your project, answer your questions and put together a quote. No commitment required.",
    category: "pricing",
  },
  {
    qFr: "Quels types de projets prenez-vous ?",
    qEn: "What types of projects do you take on?",
    aFr: "Sites web (vitrines, portails clients), applications web MVP, automatisations et conseil. Chaque projet est différent, contactez-nous pour en discuter.",
    aEn: "Websites (showcase, client portals), web MVP applications, automations, and consulting. Every project is different, contact us to discuss yours.",
    category: "technical",
  },
];

const FAQItem = forwardRef<HTMLDivElement, { q: string; a: string; index: number; defaultOpen?: boolean }>(
  ({ q, a, index, defaultOpen }, ref) => {
    const [open, setOpen] = useState(defaultOpen || false);
    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="glass-card-hover overflow-hidden"
      >
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-secondary/20 transition-colors gap-4"
        >
          <span className="font-display font-medium text-foreground text-sm md:text-base">{q}</span>
          <ChevronDown
            className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300", open && "rotate-180")}
          />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.2, delay: 0.05 },
              }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-5">
                <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-4">{a}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
);
FAQItem.displayName = "FAQItem";

const FAQSection = () => {
  const { t } = useLanguage();
  const ref = useScrollReveal<HTMLElement>();
  const [category, setCategory] = useState<Category>("all");

  const filtered = category === "all" ? faqs : faqs.filter(f => f.category === category);

  return (
    <section ref={ref} data-reveal id="faq" className="section-spacing bg-secondary/20">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">FAQ</p>
          <h2 className="font-display text-3xl md:text-5xl font-semibold text-gradient-silver">
            {t("Questions fréquentes", "Frequently asked questions")}
          </h2>
        </motion.div>

        {/* Category pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-body font-semibold transition-all duration-200",
                category === cat.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {t(cat.fr, cat.en)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {filtered.map((faq, i) => (
              <FAQItem
                key={faq.qFr}
                index={i}
                q={t(faq.qFr, faq.qEn)}
                a={t(faq.aFr, faq.aEn)}
                defaultOpen={category !== "all" && i === 0}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
