import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { BarChart3, Users, ClipboardList, Zap } from "lucide-react";

interface UseCase {
  key: string;
  icon: typeof BarChart3;
  labelFr: string;
  labelEn: string;
  items: { name: string; valueFr: string; valueEn: string; accent?: string }[];
}

const USE_CASES: UseCase[] = [
  {
    key: "dashboard",
    icon: BarChart3,
    labelFr: "Dashboard",
    labelEn: "Dashboard",
    items: [
      { name: "CA mensuel", valueFr: "12'450 CHF", valueEn: "12,450 CHF", accent: "text-emerald-600" },
      { name: "Taux conversion", valueFr: "3.2%  ↑", valueEn: "3.2%  ↑", accent: "text-emerald-600" },
      { name: "Visiteurs", valueFr: "1'842", valueEn: "1,842" },
      { name: "Tickets ouverts", valueFr: "7", valueEn: "7", accent: "text-amber-600" },
    ],
  },
  {
    key: "crm",
    icon: Users,
    labelFr: "CRM",
    labelEn: "CRM",
    items: [
      { name: "Marie Laurent", valueFr: "Devis envoyé", valueEn: "Quote sent", accent: "text-amber-600" },
      { name: "Julien Favre", valueFr: "Client actif", valueEn: "Active client", accent: "text-emerald-600" },
      { name: "Sophie Müller", valueFr: "Relance J+3", valueEn: "Follow-up D+3", accent: "text-violet-600" },
      { name: "Lucas Bonvin", valueFr: "Nouveau lead", valueEn: "New lead", accent: "text-primary" },
    ],
  },
  {
    key: "gestion",
    icon: ClipboardList,
    labelFr: "Gestion",
    labelEn: "Management",
    items: [
      { name: "Sprint 4", valueFr: "6/8 tâches", valueEn: "6/8 tasks", accent: "text-emerald-600" },
      { name: "Livraison", valueFr: "Ven. 21 mars", valueEn: "Fri. Mar 21" },
      { name: "Heures restantes", valueFr: "14h", valueEn: "14h", accent: "text-amber-600" },
      { name: "Budget utilisé", valueFr: "78%", valueEn: "78%" },
    ],
  },
  {
    key: "automatisation",
    icon: Zap,
    labelFr: "Automatisation",
    labelEn: "Automation",
    items: [
      { name: "Factures", valueFr: "Auto-générées", valueEn: "Auto-generated", accent: "text-emerald-600" },
      { name: "Emails", valueFr: "Relance auto J+7", valueEn: "Auto follow-up D+7" },
      { name: "Rapports", valueFr: "Chaque lundi", valueEn: "Every Monday" },
      { name: "Sync données", valueFr: "Temps réel", valueEn: "Real-time", accent: "text-emerald-600" },
    ],
  },
];

export function SmartFilterDemo() {
  const { t } = useLanguage();
  const [active, setActive] = useState("dashboard");

  const current = USE_CASES.find(u => u.key === active)!;

  return (
    <div className="space-y-4">
      {/* Use case tabs */}
      <div className="flex flex-wrap gap-1.5">
        {USE_CASES.map(uc => {
          const Icon = uc.icon;
          const isActive = active === uc.key;
          return (
            <button
              key={uc.key}
              onClick={() => setActive(uc.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-body font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="w-3 h-3" />
              {t(uc.labelFr, uc.labelEn)}
            </button>
          );
        })}
      </div>

      {/* Content panel */}
      <div className="min-h-[180px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-1.5"
          >
            {current.items.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-border/30"
              >
                <span className="text-sm font-body font-medium text-foreground">{item.name}</span>
                <span className={cn(
                  "text-xs font-body font-semibold",
                  item.accent || "text-muted-foreground",
                )}>
                  {t(item.valueFr, item.valueEn)}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
