import type { ModuleComplexity } from "@/types/module";
import { getModuleById } from "@/data/moduleCatalog";
import { ModuleIcon } from "./moduleIcons";
import { motion } from "framer-motion";

const blockAnim = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
};

const COMPLEXITY_LABELS: Record<ModuleComplexity, string> = {
  simple: "Simple",
  advanced: "Avance",
  custom: "Sur mesure",
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; accent: string }> = {
  content:     { bg: "bg-blue-50/70",    border: "border-l-blue-400",    accent: "text-blue-600" },
  interaction: { bg: "bg-violet-50/70",  border: "border-l-violet-400",  accent: "text-violet-600" },
  commerce:    { bg: "bg-rose-50/70",    border: "border-l-rose-400",    accent: "text-rose-600" },
  system:      { bg: "bg-emerald-50/70", border: "border-l-emerald-400", accent: "text-emerald-600" },
};

const COMPLEXITY_LEVEL: Record<ModuleComplexity, number> = {
  simple: 1,
  advanced: 2,
  custom: 3,
};

// Special modules rendered in nav/footer/overlay — not as section bands
const SPECIAL_MODULES = new Set(["i18n", "seo", "chat", "hosting"]);

function ComplexityBars({ complexity, accent }: { complexity: ModuleComplexity; accent: string }) {
  const level = COMPLEXITY_LEVEL[complexity];
  return (
    <div className="flex items-end gap-[2px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-sm transition-colors ${i <= level ? accent.replace("text-", "bg-") : "bg-gray-200"}`}
          style={{ height: `${6 + i * 2}px` }}
        />
      ))}
    </div>
  );
}

interface BandProps {
  moduleId: string;
  complexity: ModuleComplexity;
}

export function ModulePreviewBand({ moduleId, complexity }: BandProps) {
  if (SPECIAL_MODULES.has(moduleId)) return null;

  const mod = getModuleById(moduleId);
  if (!mod) return null;

  const style = CATEGORY_STYLES[mod.category] ?? CATEGORY_STYLES.content;

  return (
    <motion.div
      {...blockAnim}
      className={`flex items-center gap-2.5 px-3 py-2 border-t border-gray-100 border-l-2 ${style.border} ${style.bg}`}
    >
      <ModuleIcon name={mod.icon} size={14} className={`shrink-0 ${style.accent}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium text-gray-700 truncate leading-tight">{mod.name}</div>
        <div className={`text-[8px] leading-tight ${style.accent} opacity-80`}>{COMPLEXITY_LABELS[complexity]}</div>
      </div>
      <ComplexityBars complexity={complexity} accent={style.accent} />
    </motion.div>
  );
}
