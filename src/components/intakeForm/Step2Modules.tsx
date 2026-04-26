import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { MODULE_CATALOG, getModulePrice } from "@/data/moduleCatalog";
import type { ModuleComplexity } from "@/types/module";
import { ModuleIcon } from "./ModuleIcon";
import {
  POPULAR_MODULES, COMPLEXITY_LABELS, INTAKE_COMPLEXITY_TIPS, CATEGORY_LABELS, formatCHF,
} from "./constants";
import { staggerContainer, staggerItem } from "./animations";
import type { SelectedModule } from "./pricing";

interface Step2Props {
  selectedModules: SelectedModule[];
  toggleModule: (id: string) => void;
  setModuleComplexity: (id: string, complexity: ModuleComplexity) => void;
  estimate: { devTotal: number };
}

export function Step2Modules({ selectedModules, toggleModule, setModuleComplexity, estimate }: Step2Props) {
  return (
    <div className="space-y-6">
      <div className="sticky top-[5.5rem] z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-2 border-b border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-body">
            {selectedModules.length} module{selectedModules.length !== 1 ? "s" : ""} · Base projet incluse
          </span>
          <motion.span
            key={estimate.devTotal}
            initial={{ scale: 1.12, color: "hsl(215 45% 30%)" }}
            animate={{ scale: 1, color: "hsl(220 30% 12%)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="font-display text-sm font-semibold"
          >
            ~CHF {formatCHF(estimate.devTotal)}
          </motion.span>
        </div>
      </div>

      {(["content", "interaction", "commerce", "system"] as const).map(cat => {
        const catModules = MODULE_CATALOG.filter(m => m.category === cat);
        if (catModules.length === 0) return null;

        return (
          <motion.div
            key={cat}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-2">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="space-y-2">
              {catModules.map(mod => {
                const sel = selectedModules.find(s => s.id === mod.id);
                const isOn = !!sel;
                const price = isOn ? getModulePrice(mod.id, sel!.complexity) : getModulePrice(mod.id, "simple");

                return (
                  <motion.div
                    key={mod.id}
                    variants={staggerItem}
                    layout
                    className={cn(
                      "rounded-xl border-2 transition-all overflow-hidden",
                      isOn
                        ? "border-primary/60 bg-primary/[0.03]"
                        : "border-border/40 hover:border-border/70"
                    )}
                  >
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 text-left"
                    >
                      <motion.div
                        animate={{
                          scale: isOn ? 1 : 0.92,
                          backgroundColor: isOn ? "hsl(215 45% 30% / 0.1)" : "hsl(35 12% 88% / 0.6)",
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isOn ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <ModuleIcon name={mod.icon} size={16} />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-body font-medium flex items-center gap-1.5",
                          isOn ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {mod.name}
                          {POPULAR_MODULES.has(mod.id) && (
                            <span className="text-[10px] font-body font-semibold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full leading-none">
                              Populaire
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground/60 font-body">{mod.description}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-mono tabular-nums shrink-0 mr-2",
                        isOn ? "text-primary font-semibold" : "text-muted-foreground/50"
                      )}>
                        {price > 0 ? `${formatCHF(price)}` : "Nous évaluerons ensemble"}
                      </span>
                      <div className={cn(
                        "w-9 h-5 rounded-full shrink-0 relative transition-colors duration-200",
                        isOn ? "bg-primary" : "bg-border"
                      )}>
                        <motion.div
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                          animate={{ left: isOn ? 18 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </div>
                    </motion.button>

                    <AnimatePresence>
                      {isOn && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 flex gap-1.5">
                            {mod.tiers.map(tier => (
                              <Tooltip key={tier.complexity}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setModuleComplexity(mod.id, tier.complexity)}
                                    className={cn(
                                      "flex-1 px-2 py-1.5 rounded-lg text-xs font-body font-medium transition-all text-center",
                                      sel!.complexity === tier.complexity
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                                    )}
                                  >
                                    <span className="block">{COMPLEXITY_LABELS[tier.complexity]}</span>
                                    <span className="block font-mono opacity-70">{formatCHF(tier.price)}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                                  {INTAKE_COMPLEXITY_TIPS[tier.complexity]}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
