import { motion } from "framer-motion";
import { FileText, Server, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAINTENANCE_OPTIONS } from "@/data/moduleCatalog";
import { TIMELINE_OPTIONS, PAGE_COUNT_OPTIONS, HOSTING_OPTIONS } from "./constants";
import { staggerContainer, staggerItem } from "./animations";

interface Step3Props {
  timeline: string;
  setTimeline: (v: string) => void;
  pageCount: string;
  setPageCount: (v: string) => void;
  hostingTier: string;
  setHostingTier: (v: string) => void;
  maintenance: string;
  setMaintenance: (v: string) => void;
}

export function Step3Options({
  timeline, setTimeline,
  pageCount, setPageCount,
  hostingTier, setHostingTier,
  maintenance, setMaintenance,
}: Step3Props) {
  return (
    <motion.div
      className="space-y-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={staggerItem}>
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Délai souhaité
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {TIMELINE_OPTIONS.map(opt => (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTimeline(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                timeline === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <span className="text-lg">{opt.emoji}</span>
              <span className="text-xs font-body font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground/60 font-body">{opt.sub}</span>
            </motion.button>
          ))}
        </div>
        {timeline === "urgent" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-amber-600 font-body mt-2"
          >
            ⚡ Un supplément de 20% s'applique pour les projets urgents.
          </motion.p>
        )}
      </motion.div>

      <motion.div variants={staggerItem}>
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Nombre de pages
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {PAGE_COUNT_OPTIONS.map(opt => (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.97 }}
              onClick={() => setPageCount(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                pageCount === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <FileText size={16} className={pageCount === opt.value ? "text-primary" : "text-muted-foreground"} />
              <span className="text-xs font-body font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground/60 font-body">{opt.sub}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={staggerItem}>
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Hébergement
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {HOSTING_OPTIONS.map(opt => (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.97 }}
              onClick={() => setHostingTier(opt.value)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center",
                hostingTier === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <Server size={16} className={hostingTier === opt.value ? "text-primary" : "text-muted-foreground"} />
              <span className="text-xs font-body font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground/60 font-body">{opt.sub}</span>
            </motion.button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground/50 font-body mt-2">
          Si vous ne savez pas, laissez « Hébergement inclus ». Nous configurons tout pour vous.
        </p>
      </motion.div>

      <motion.div variants={staggerItem}>
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
          Maintenance
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {MAINTENANCE_OPTIONS.map(opt => (
            <motion.button
              key={opt.tier}
              whileTap={{ scale: 0.97 }}
              onClick={() => setMaintenance(opt.tier)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center",
                maintenance === opt.tier
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-border"
              )}
            >
              <Settings size={16} className={maintenance === opt.tier ? "text-primary" : "text-muted-foreground"} />
              <span className="text-xs font-body font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground/60 font-body">{opt.description}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
