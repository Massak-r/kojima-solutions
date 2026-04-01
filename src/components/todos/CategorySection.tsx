import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/objectiveCategories";
import { motion, AnimatePresence } from "framer-motion";

interface CategorySectionProps {
  category: string;
  count: number;        // total uncompleted
  completedCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CategorySection({ category, count, completedCount, children, defaultOpen = true }: CategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = getCategoryColor(category);

  return (
    <div className="mb-4">
      {/* Category header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors",
          "hover:bg-secondary/40 group",
        )}
      >
        <div className={cn("w-1 h-6 rounded-full shrink-0", colors.dot)} />
        <span className={cn("text-xs font-display font-bold uppercase tracking-wider", colors.text)}>
          {category}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/60 font-semibold">
          {count}
        </span>
        {completedCount > 0 && (
          <span className="text-[10px] font-mono text-emerald-600/50">
            +{completedCount} ✓
          </span>
        )}
        <div className="flex-1" />
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200",
          open && "rotate-180",
        )} />
      </button>

      {/* Content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={cn("pl-1.5 sm:pl-2 border-l-2 space-y-1.5 pt-1.5", colors.border.replace("border-l-", "border-"))}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
