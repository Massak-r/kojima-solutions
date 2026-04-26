import { motion } from "framer-motion";
import { ConfettiBurst } from "@/utils/ConfettiBurst";
import { MODULE_CATALOG, getModulePrice } from "@/data/moduleCatalog";
import {
  BASE_PROJECT_COST, PAGE_COUNT_OPTIONS, COMPLEXITY_LABELS, formatCHF,
} from "./constants";
import type { SelectedModule } from "./pricing";

interface Step4Props {
  estimate: { low: number; high: number; yearly: number; pageExtra: number };
  selectedModules: SelectedModule[];
  timeline: string;
  pageCount: string;
  countLow: number;
  countHigh: number;
}

export function Step4Estimate({ estimate, selectedModules, timeline, pageCount, countLow, countHigh }: Step4Props) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-gradient-to-br from-primary/5 to-primary/[0.02] border-2 border-primary/20 rounded-2xl p-6 text-center space-y-3 overflow-hidden"
      >
        <ConfettiBurst count={20} spread={240} />
        <p className="text-xs text-muted-foreground font-body uppercase tracking-widest">Estimation du projet</p>
        <p className="font-display text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
          <span className="inline-grid">
            <span className="col-start-1 row-start-1 invisible" aria-hidden="true">
              CHF {formatCHF(estimate.low)} – {formatCHF(estimate.high)}
            </span>
            <span className="col-start-1 row-start-1">
              CHF {formatCHF(countLow)} – {formatCHF(countHigh)}
            </span>
          </span>
        </p>
        {timeline === "urgent" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-amber-600 font-body"
          >
            Inclut le supplément urgence (+20%)
          </motion.p>
        )}
        {selectedModules.length >= 4 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-xs text-emerald-600 font-body"
          >
            Remise multi-modules appliquée (-10%)
          </motion.p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="space-y-2"
      >
        <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
          Détail du développement
        </h3>

        <div className="flex justify-between text-sm font-body py-1.5 border-b border-border/30">
          <span className="text-muted-foreground">Base projet (design, responsive, mise en ligne)</span>
          <span className="font-mono tabular-nums">{formatCHF(BASE_PROJECT_COST)}</span>
        </div>

        {selectedModules.map((sel, i) => {
          const mod = MODULE_CATALOG.find(m => m.id === sel.id);
          if (!mod) return null;
          const price = getModulePrice(sel.id, sel.complexity);
          return (
            <motion.div
              key={sel.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.04 }}
              className="flex justify-between text-sm font-body py-1.5 border-b border-border/30"
            >
              <span>
                {mod.name}
                <span className="text-muted-foreground/50 ml-1.5 text-xs">
                  ({COMPLEXITY_LABELS[sel.complexity]})
                </span>
              </span>
              <span className="font-mono tabular-nums">{formatCHF(price)}</span>
            </motion.div>
          );
        })}

        {estimate.pageExtra > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + selectedModules.length * 0.04 }}
            className="flex justify-between text-sm font-body py-1.5 border-b border-border/30"
          >
            <span className="text-muted-foreground">Pages supplémentaires ({PAGE_COUNT_OPTIONS.find(p => p.value === pageCount)?.label})</span>
            <span className="font-mono tabular-nums">{formatCHF(estimate.pageExtra)}</span>
          </motion.div>
        )}

        {selectedModules.length === 0 && (
          <p className="text-xs text-muted-foreground/50 font-body py-2 italic">
            Aucun module sélectionné, projet de base uniquement.
          </p>
        )}
      </motion.div>

      {estimate.yearly > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-secondary/30 rounded-xl p-4 space-y-1"
        >
          <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
            Coûts annuels
          </h3>
          <p className="font-display text-lg font-semibold">
            CHF {formatCHF(estimate.yearly)}/an
          </p>
          <p className="text-xs text-muted-foreground/60 font-body">
            Hébergement, maintenance et frais récurrents inclus.
          </p>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="text-xs text-muted-foreground/50 font-body text-center leading-relaxed"
      >
        Cette estimation est une base de travail indicative. Le devis final sera ajusté
        en fonction de la complexité exacte de votre projet lors de notre échange.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="text-xs text-emerald-600 font-body text-center font-medium"
      >
        La première séance de cadrage est offerte.
      </motion.p>
    </div>
  );
}
