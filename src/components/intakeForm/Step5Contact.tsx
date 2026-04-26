import { motion } from "framer-motion";
import { CheckCircle2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatCHF } from "./constants";
import { staggerContainer, staggerItem } from "./animations";

interface Step5Props {
  estimate: { low: number; high: number };
  contactName: string; setContactName: (s: string) => void;
  contactEmail: string; setContactEmail: (s: string) => void;
  contactPhone: string; setContactPhone: (s: string) => void;
  contactCompany: string; setContactCompany: (s: string) => void;
  contactMessage: string; setContactMessage: (s: string) => void;
  emailTouched: boolean; setEmailTouched: (b: boolean) => void;
  nameTouched: boolean; setNameTouched: (b: boolean) => void;
  goToEstimate: () => void;
}

export function Step5Contact({
  estimate,
  contactName, setContactName,
  contactEmail, setContactEmail,
  contactPhone, setContactPhone,
  contactCompany, setContactCompany,
  contactMessage, setContactMessage,
  emailTouched, setEmailTouched,
  nameTouched, setNameTouched,
  goToEstimate,
}: Step5Props) {
  const isEmailValid = contactEmail.includes("@") && contactEmail.includes(".");
  const isNameValid = contactName.trim().length > 0;

  return (
    <motion.div
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={staggerItem} className="bg-secondary/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-body">Votre estimation</p>
          <p className="font-display text-lg font-semibold">
            CHF {formatCHF(estimate.low)} – {formatCHF(estimate.high)}
          </p>
        </div>
        <button
          onClick={goToEstimate}
          className="text-xs text-primary font-body hover:underline"
        >
          Voir le détail
        </button>
      </motion.div>

      <motion.div variants={staggerItem} className="relative">
        <Input
          placeholder="Nom complet *"
          value={contactName}
          onChange={e => setContactName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          className={cn("h-11 pr-9", nameTouched && isNameValid && "border-emerald-400")}
        />
        {nameTouched && isNameValid && (
          <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
        )}
      </motion.div>

      <motion.div variants={staggerItem} className="relative">
        <Input
          placeholder="Email *"
          type="email"
          value={contactEmail}
          onChange={e => setContactEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          className={cn(
            "h-11 pr-9",
            emailTouched && isEmailValid && "border-emerald-400",
            emailTouched && contactEmail.length > 0 && !isEmailValid && "border-destructive"
          )}
        />
        {emailTouched && isEmailValid && (
          <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
        )}
        {emailTouched && contactEmail.length > 0 && !isEmailValid && (
          <p className="text-xs text-destructive font-body mt-1">Veuillez entrer un email valide</p>
        )}
      </motion.div>

      <motion.div variants={staggerItem}>
        <Input
          placeholder="Téléphone (optionnel)"
          type="tel"
          value={contactPhone}
          onChange={e => setContactPhone(e.target.value)}
          className="h-11"
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <Input
          placeholder="Entreprise (optionnel)"
          value={contactCompany}
          onChange={e => setContactCompany(e.target.value)}
          className="h-11"
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <textarea
          placeholder="Ex: refonte de notre site actuel, ajout d'une boutique en ligne... (optionnel)"
          value={contactMessage}
          onChange={e => setContactMessage(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-body placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-2 text-xs text-muted-foreground/60 font-body">
        <Shield size={12} className="shrink-0" />
        <span>Vos données restent confidentielles et ne seront jamais partagées.</span>
      </motion.div>
    </motion.div>
  );
}
