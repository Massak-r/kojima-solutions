import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PROJECT_TYPES } from "./constants";
import { staggerContainer, staggerItem } from "./animations";

interface Step1Props {
  projectSlug: string;
  onSelect: (label: string, slug: string) => void;
}

export function Step1ProjectType({ projectSlug, onSelect }: Step1Props) {
  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {PROJECT_TYPES.map(pt => (
        <motion.button
          key={pt.slug}
          variants={staggerItem}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(pt.label, pt.slug)}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
            projectSlug === pt.slug
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border/50 hover:border-border hover:bg-secondary/20"
          )}
        >
          <span className="text-2xl">{pt.emoji}</span>
          <span className="text-xs font-body font-medium">{pt.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
