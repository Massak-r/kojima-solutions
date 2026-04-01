import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, X, Check, Zap } from "lucide-react";

const BEFORE = [
  { fr: "Saisie manuelle", en: "Manual entry", icon: "📝" },
  { fr: "Vérification", en: "Verification", icon: "🔍" },
  { fr: "Double saisie", en: "Duplicate entry", icon: "📋" },
  { fr: "Export Excel", en: "Excel export", icon: "📊" },
  { fr: "Envoi email", en: "Send email", icon: "📧" },
];

const AFTER = [
  { fr: "Formulaire auto", en: "Auto form", icon: "⚡" },
  { fr: "Validation IA", en: "AI validation", icon: "🤖" },
  { fr: "Sync & notif", en: "Sync & notify", icon: "🔄" },
];

export function ProcessOptDemo() {
  const { t } = useLanguage();
  const [showOptimized, setShowOptimized] = useState(false);

  return (
    <div className="space-y-2.5">
      {/* Context label */}
      <p className="text-xs font-display font-semibold text-muted-foreground text-center">
        {t("Exemple : processus actuel", "Example: current process")}
      </p>

      {/* Side by side with divider */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
        {/* Before */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-body font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              {t("Avant", "Before")}
            </span>
            <span className="text-[10px] font-mono text-amber-600/50">5</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            {BEFORE.map((step, i) => (
              <motion.div
                key={step.fr}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.2 }}
                className="w-full flex flex-col items-center"
              >
                <div className={cn(
                  "w-full px-2 py-1.5 rounded border text-[10px] font-body font-medium text-center flex items-center justify-center gap-1 transition-all duration-500 relative",
                  showOptimized
                    ? "bg-red-50/50 border-red-200/50 text-red-400"
                    : "bg-amber-50 border-amber-200 text-amber-700",
                )}>
                  {showOptimized && (
                    <X className="w-2.5 h-2.5 text-red-400 shrink-0 absolute left-1.5" />
                  )}
                  <span className={cn(showOptimized && "line-through opacity-60")}>
                    {t(step.fr, step.en)}
                  </span>
                </div>
                {i < BEFORE.length - 1 && (
                  <ArrowDown className={cn(
                    "w-2.5 h-2.5 my-0.5 shrink-0 transition-colors duration-300",
                    showOptimized ? "text-red-200" : "text-amber-300",
                  )} />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Center divider with toggle */}
        <div className="flex flex-col items-center pt-8 gap-2">
          <div className="w-px h-6 bg-border/40" />
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowOptimized(o => !o)}
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-300 shadow-sm border",
              showOptimized
                ? "bg-emerald-500 border-emerald-400 text-white"
                : "bg-secondary border-border text-muted-foreground hover:bg-primary/10",
            )}
          >
            <Zap className="w-3.5 h-3.5" />
          </motion.button>
          <div className="w-px flex-1 bg-border/40" />
        </div>

        {/* After */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={cn(
              "text-[11px] font-body font-semibold px-2 py-0.5 rounded transition-colors duration-300",
              showOptimized
                ? "text-emerald-700 bg-emerald-100"
                : "text-muted-foreground bg-secondary/60",
            )}>
              {t("Après", "After")}
            </span>
            <span className="text-[10px] font-mono text-emerald-600/50">3</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            {AFTER.map((step, i) => (
              <motion.div
                key={step.fr}
                initial={{ opacity: 0, x: 6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.2 }}
                className="w-full flex flex-col items-center"
              >
                <div className={cn(
                  "w-full px-2 py-1.5 rounded border text-[10px] font-body font-medium text-center flex items-center justify-center gap-1 transition-all duration-500 relative",
                  showOptimized
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                    : "bg-emerald-50/50 border-emerald-200/50 text-emerald-600/60",
                )}>
                  {showOptimized && (
                    <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0 absolute left-1.5" />
                  )}
                  {t(step.fr, step.en)}
                </div>
                {i < AFTER.length - 1 && (
                  <ArrowDown className={cn(
                    "w-2.5 h-2.5 my-0.5 shrink-0 transition-colors duration-300",
                    showOptimized ? "text-emerald-400" : "text-emerald-200",
                  )} />
                )}
              </motion.div>
            ))}
          </div>

          {/* Impact badge */}
          <AnimatePresence>
            {showOptimized && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mt-2 flex items-center justify-center gap-1"
              >
                <ArrowRight className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-body text-emerald-600 font-semibold">
                  {t("-40% temps, 0 erreur", "-40% time, 0 errors")}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
