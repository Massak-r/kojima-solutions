import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { motion } from "framer-motion";
import { ConfettiBurst } from "@/utils/ConfettiBurst";
import { formatCHF } from "./constants";
import type { SelectedModule } from "./pricing";

interface SuccessScreenProps {
  contactName: string;
  contactEmail: string;
  projectType: string;
  estimate: { low: number; high: number; yearly: number };
  selectedModules: SelectedModule[];
}

export function SuccessScreen({ contactName, contactEmail, projectType, estimate, selectedModules }: SuccessScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6 relative">
        <ConfettiBurst count={30} spread={320} />

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto"
        >
          <svg viewBox="0 0 50 50" className="w-16 h-16 mx-auto">
            <motion.circle
              cx="25" cy="25" r="22"
              fill="none"
              stroke="hsl(145 20% 44%)"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            />
            <motion.path
              d="M14 27l7 7 15-15"
              fill="none"
              stroke="hsl(145 20% 44%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.7 }}
            />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-display text-2xl font-semibold"
        >
          Merci {contactName.split(" ")[0]} !
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="text-muted-foreground font-body text-sm"
        >
          Votre demande pour un projet « {projectType} » a bien été enregistrée.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-secondary/30 rounded-xl p-5 space-y-2"
        >
          <p className="font-display text-lg font-semibold">
            CHF {formatCHF(estimate.low)} – {formatCHF(estimate.high)}
          </p>
          <p className="text-xs text-muted-foreground font-body">
            Estimation indicative · {selectedModules.length} module{selectedModules.length !== 1 ? "s" : ""} sélectionné{selectedModules.length !== 1 ? "s" : ""}
          </p>
          {estimate.yearly > 0 && (
            <p className="text-xs text-muted-foreground/60 font-body">
              + CHF {formatCHF(estimate.yearly)}/an (hébergement & maintenance)
            </p>
          )}
        </motion.div>

        {contactEmail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60 font-body"
          >
            <Mail size={12} />
            <span>Nous vous répondrons sous 24-48h</span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <Link to="/" className="text-xs text-primary hover:underline font-body inline-block mt-4">
            ← Retour au site
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
