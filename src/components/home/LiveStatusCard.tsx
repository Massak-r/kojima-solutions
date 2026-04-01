import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";

const BARS = [3, 5, 7, 10, 14, 11, 8, 5, 9];

function Sparkline() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {BARS.map((h, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 1.8 + i * 0.06, duration: 0.4, ease: "easeOut" }}
          className="w-[3px] rounded-full bg-primary/40 origin-bottom"
          style={{ height: `${h * 1.4}px` }}
        />
      ))}
    </div>
  );
}

export function LiveStatusCard() {
  const { t } = useLanguage();

  const cardContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-xs font-display font-semibold text-foreground tracking-tight">
          Kojima.Solutions
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mb-3 text-[11px] font-body text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">5</span>{" "}
          {t("projets livrés cette année", "projects delivered this year")}
        </span>
        <span className="text-muted-foreground/30">·</span>
        <span>
          <span className="font-semibold text-emerald-600">3</span>{" "}
          {t("en cours", "in progress")}
        </span>
      </div>

      {/* Sparkline */}
      <div className="flex items-center gap-2.5">
        <Sparkline />
        <span className="text-[10px] text-muted-foreground/50 font-body">
          {t("activité", "activity")}
        </span>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: absolute positioned, top-left below content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="hidden lg:block absolute bottom-24 left-8 xl:left-16 z-20"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="glass-card p-5 rounded-2xl w-[260px] shadow-lg border border-border/50"
        >
          {cardContent}
        </motion.div>
      </motion.div>

    </>
  );
}
