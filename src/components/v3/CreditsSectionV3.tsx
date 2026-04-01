import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { motion, useSpring } from "framer-motion";
import { ShieldCheck, ArrowRight, Percent } from "lucide-react";
import { AllocationBarV3 } from "@/components/v3/AllocationBarV3";
import { cn } from "@/lib/utils";


// ─── Discount logic ──────────────────────────────────────
interface PriceResult {
  total: number;
  pricePerUnit: number;
  discount: number;
  tierFr: string;
  tierEn: string;
}

function calculatePrice(units: number): PriceResult {
  if (units >= 75)
    return { total: units * 85, pricePerUnit: 85, discount: 15, tierFr: "75+ unités", tierEn: "75+ units" };
  if (units >= 50)
    return { total: units * 90, pricePerUnit: 90, discount: 10, tierFr: "50–74 unités", tierEn: "50–74 units" };
  if (units >= 20)
    return { total: units * 95, pricePerUnit: 95, discount: 5, tierFr: "20–49 unités", tierEn: "20–49 units" };
  return { total: units * 100, pricePerUnit: 100, discount: 0, tierFr: "1–19 unités", tierEn: "1–19 units" };
}

const TIERS = [
  { minFr: "1–19", minEn: "1–19", price: 100, discount: 0 },
  { minFr: "20–49", minEn: "20–49", price: 95, discount: 5 },
  { minFr: "50–74", minEn: "50–74", price: 90, discount: 10 },
  { minFr: "75+", minEn: "75+", price: 85, discount: 15 },
];

// ─── Spring-animated counter ─────────────────────────────
function SpringCounter({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 80, damping: 25 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring]);

  return <>{display.toLocaleString("fr-CH")}</>;
}

// ─── Active tier index helper ────────────────────────────
function getActiveTier(units: number): number {
  if (units >= 75) return 3;
  if (units >= 50) return 2;
  if (units >= 20) return 1;
  return 0;
}

const CreditsSectionV3 = () => {
  const { t } = useLanguage();
  const ref = useScrollReveal<HTMLElement>();
  const [sliderUnits, setSliderUnits] = useState(10);


  const pricing = calculatePrice(sliderUnits);
  const activeTier = getActiveTier(sliderUnits);

  return (
    <section ref={ref} data-reveal id="credits" className="section-spacing">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
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
            {t("Unités de développement", "Development Units")}
          </h2>
        </motion.div>

        {/* Equation card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card-hover p-10 text-center mb-10"
        >
          <p className="font-display text-4xl md:text-6xl font-bold text-gradient-primary mb-3">
            1 {t("Unité", "Unit")} = 100 CHF
          </p>
        </motion.div>

        {/* Allocation bar */}
        <AllocationBarV3 />

        {/* ── Interactive Slider Calculator ────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card p-6 sm:p-8 mb-6"
        >
          <p className="text-sm font-display font-semibold text-foreground mb-6">
            {t("Calculateur de projet", "Project Calculator")}
          </p>

          {/* Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground">5</span>
              <span className="text-xs font-mono text-muted-foreground">100</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              value={sliderUnits}
              onChange={(e) => setSliderUnits(Number(e.target.value))}
              className="gradient-slider w-full"
            />
            {/* Tier markers */}
            <div className="relative h-4 mt-1">
              {[20, 50, 75].map((mark) => (
                <div
                  key={mark}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${((mark - 5) / 95) * 100}%` }}
                >
                  <div className="w-px h-2 bg-muted-foreground/30" />
                  <span className="text-[9px] font-mono text-muted-foreground/50">{mark}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Result display */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-secondary/40 rounded-xl">
            <div className="text-center sm:text-left">
              <p className="text-3xl sm:text-4xl font-display font-bold text-gradient-primary">
                <SpringCounter value={sliderUnits} /> {t("unités", "units")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {pricing.pricePerUnit} CHF / {t("unité", "unit")}
                {pricing.discount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
                    <Percent size={10} />
                    -{pricing.discount}%
                  </span>
                )}
              </p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-4xl sm:text-5xl font-display font-bold text-gradient-animated">
                <SpringCounter value={pricing.total} /> <span className="text-2xl">CHF</span>
              </p>
              {pricing.discount > 0 && (
                <p className="text-xs text-muted-foreground mt-1 line-through">
                  {(sliderUnits * 100).toLocaleString("fr-CH")} CHF
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Discount Tiers ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-10"
        >
          {TIERS.map((tier, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.03 }}
              className={cn(
                "text-center p-4 rounded-xl border transition-all duration-300",
                activeTier === i
                  ? "glass-card ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                  : "glass-card border-transparent opacity-60"
              )}
            >
              <p className="text-xs font-mono text-muted-foreground mb-1">
                {t(tier.minFr, tier.minEn)} {t("unités", "units")}
              </p>
              <p className="font-display text-xl font-bold text-foreground">
                {tier.price} <span className="text-sm font-normal text-muted-foreground">CHF</span>
              </p>
              {tier.discount > 0 ? (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold">
                  -{tier.discount}%
                </span>
              ) : (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold">
                  {t("Prix de base", "Base price")}
                </span>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Transparency message */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center text-sm text-muted-foreground italic font-body max-w-lg mx-auto mb-10"
        >
          {t(
            "Contactez-nous pour avoir une offre personnalisée.",
            "Contact us for a personalized offer."
          )}
        </motion.p>

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
            href="/intake"
            className="inline-flex items-center gap-2 text-sm font-display font-semibold text-primary hover:text-primary/80 transition-colors group"
          >
            {t("Estimer mon projet", "Estimate my project")}
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

export default CreditsSectionV3;
