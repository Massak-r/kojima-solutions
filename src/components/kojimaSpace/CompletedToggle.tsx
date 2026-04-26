import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompletedToggle({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2 border-t border-border/20 mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 py-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
      >
        <CheckCircle2 size={13} className="text-emerald-500" />
        <span>{count} terminé{count > 1 ? "s" : ""}</span>
        <ChevronRight size={12} className={cn("transition-transform duration-200", open && "rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 mt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
