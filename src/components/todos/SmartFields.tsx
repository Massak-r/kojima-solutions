import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SmartFieldsProps {
  specific?:   string | null;
  measurable?: string | null;
  achievable?: string | null;
  relevant?:   string | null;
  dueDate?:    string;
  onSave: (field: string, value: string) => void;
}

const FIELDS = [
  { key: "smartSpecific",   letter: "S", label: "Spécifique",  color: "bg-blue-500",    placeholder: "Que voulez-vous accomplir exactement ?" },
  { key: "smartMeasurable", letter: "M", label: "Mesurable",   color: "bg-emerald-500", placeholder: "Comment saurez-vous que c'est atteint ?" },
  { key: "smartAchievable", letter: "A", label: "Atteignable", color: "bg-amber-500",   placeholder: "Est-ce réaliste avec vos ressources ?" },
  { key: "smartRelevant",   letter: "R", label: "Relevant",    color: "bg-violet-500",  placeholder: "Pourquoi est-ce important maintenant ?" },
  { key: "timebound",       letter: "T", label: "Temporel",    color: "bg-rose-500",    placeholder: "" },
];

export function SmartFields({ specific, measurable, achievable, relevant, dueDate, onSave }: SmartFieldsProps) {
  const values: Record<string, string | null | undefined> = {
    smartSpecific: specific,
    smartMeasurable: measurable,
    smartAchievable: achievable,
    smartRelevant: relevant,
    timebound: dueDate || null,
  };

  const filledCount = [specific, measurable, achievable, relevant, dueDate].filter(Boolean).length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4">
      {/* SMART dots indicator + toggle */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="flex items-center gap-2.5 mb-2 group w-full"
      >
        <div className="flex items-center gap-1.5">
          {FIELDS.map(f => (
            <div
              key={f.key}
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white transition-all shadow-sm",
                values[f.key] ? f.color : "bg-muted-foreground/20",
              )}
              title={f.label}
            >
              {f.letter}
            </div>
          ))}
        </div>
        <span className="text-xs font-display font-semibold text-foreground/60 uppercase tracking-wider">
          SMART {filledCount}/5
        </span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ml-auto",
          expanded && "rotate-180",
        )} />
      </button>

      {/* Expandable fields */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pl-1 bg-secondary/20 rounded-xl p-3 border border-border/30">
              {FIELDS.map(f => (
                <SmartFieldRow
                  key={f.key}
                  field={f}
                  value={values[f.key] || ""}
                  isTimebound={f.key === "timebound"}
                  onSave={(val) => onSave(f.key, val)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SmartFieldRow({
  field,
  value,
  isTimebound,
  onSave,
}: {
  field: typeof FIELDS[0];
  value: string;
  isTimebound: boolean;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function save() {
    onSave(draft.trim());
    setEditing(false);
  }

  if (isTimebound) {
    return (
      <div className="flex items-center gap-3">
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 shadow-sm", value ? field.color : "bg-muted-foreground/20")}>
          {field.letter}
        </div>
        <span className="text-xs font-display font-semibold text-foreground/70 w-20 shrink-0">{field.label}</span>
        <input
          type="date"
          value={value}
          onChange={e => onSave(e.target.value)}
          className="text-sm font-body bg-transparent border-b border-border/40 focus:border-primary focus:outline-none px-1 py-1 text-foreground"
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5 shadow-sm", value ? field.color : "bg-muted-foreground/20")}>
        {field.letter}
      </div>
      <span className="text-xs font-display font-semibold text-foreground/70 w-20 shrink-0 mt-1">{field.label}</span>
      {editing ? (
        <div className="flex-1 flex items-start gap-1.5">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            autoFocus
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }}
            className="flex-1 text-sm font-body bg-white/60 border border-border/40 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
          />
          <button onClick={save} className="text-xs font-body font-bold text-primary hover:text-primary/80 px-2 py-1.5">OK</button>
        </div>
      ) : value ? (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="flex-1 text-sm font-body text-foreground text-left hover:text-primary transition-colors leading-snug"
        >
          {value}
        </button>
      ) : (
        <button
          onClick={() => { setDraft(""); setEditing(true); }}
          className="flex-1 text-sm font-body text-muted-foreground/50 italic text-left hover:text-muted-foreground transition-colors"
        >
          {field.placeholder}
        </button>
      )}
    </div>
  );
}

// Compact SMART dots for use in list headers
export function SmartDots({ specific, measurable, achievable, relevant, dueDate }: {
  specific?: string | null;
  measurable?: string | null;
  achievable?: string | null;
  relevant?: string | null;
  dueDate?: string;
}) {
  const vals = [specific, measurable, achievable, relevant, dueDate];
  // Hide entirely when all fields are empty
  if (!vals.some(Boolean)) return null;
  return (
    <div className="flex items-center gap-1">
      {FIELDS.map((f, i) => (
        <div
          key={f.key}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            vals[i] ? f.color : "bg-muted-foreground/20",
          )}
          title={`${f.label}: ${vals[i] ? "Rempli" : "Vide"}`}
        />
      ))}
    </div>
  );
}
