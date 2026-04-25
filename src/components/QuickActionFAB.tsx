import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, FolderKanban, FileText, Building2, Target, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Action {
  label: string;
  icon: typeof Plus;
  color: string;
  to?: string;
  action?: () => void;
}

const NAV_ACTIONS: Action[] = [
  { label: "Nouveau projet", icon: FolderKanban, to: "/projects", color: "bg-blue-500" },
  { label: "Nouveau devis", icon: FileText, to: "/quotes/new", color: "bg-emerald-500" },
  { label: "Nouveau client", icon: Building2, to: "/clients", color: "bg-amber-500" },
];

export function QuickActionFAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isOnSpace = location.pathname === "/space";

  const ACTIONS: Action[] = [
    ...(isOnSpace
      ? [
          {
            label: "Nouvel objectif",
            icon: Target,
            color: "bg-violet-500",
            action: () => {
              const input = document.getElementById("new-objective-input");
              if (input) {
                input.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => input.focus(), 400);
              }
            },
          },
        ]
      : []),
    ...NAV_ACTIONS,
  ];

  return (
    <div className="fixed bottom-24 sm:bottom-8 right-4 sm:right-6 z-40 flex flex-col-reverse items-end gap-2.5">
      {/* Action items */}
      <AnimatePresence>
        {open && ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            aria-label={action.label}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            onClick={() => {
              if (action.action) action.action();
              else if (action.to) navigate(action.to);
              setOpen(false);
            }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card border border-border shadow-lg hover:shadow-xl transition-shadow"
          >
            <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0", action.color)}>
              <action.icon size={14} />
            </span>
            <span className="text-sm font-body font-medium text-foreground whitespace-nowrap">
              {action.label}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le menu d'actions rapides" : "Ouvrir le menu d'actions rapides"}
        aria-expanded={open}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors",
          open ? "bg-muted-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
          {open ? <X size={22} /> : <Plus size={22} />}
        </motion.div>
      </motion.button>
    </div>
  );
}
