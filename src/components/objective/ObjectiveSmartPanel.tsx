import { useState } from "react";
import { ChevronDown, Target, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SmartFields } from "@/components/todos/SmartFields";
import type { UnifiedObjective } from "@/api/objectiveSource";

interface ObjectiveSmartPanelProps {
  objective: UnifiedObjective;
  onSmartSave: (field: string, value: string) => void;
  onDefinitionOfDoneSave: (v: string) => void;
}

export function ObjectiveSmartPanel({ objective, onSmartSave, onDefinitionOfDoneSave }: ObjectiveSmartPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [editDod, setEditDod]   = useState(false);
  const [dodDraft, setDodDraft] = useState(objective.definitionOfDone ?? "");

  const dod = objective.definitionOfDone ?? "";

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-5">
      <button
        onClick={() => setExpanded(o => !o)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <Target size={15} className="text-primary shrink-0" />
        <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Cadrage SMART + Definition of Done
        </span>
        <ChevronDown
          size={14}
          className={cn("ml-auto text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              <SmartFields
                specific={objective.smartSpecific}
                measurable={objective.smartMeasurable}
                achievable={objective.smartAchievable}
                relevant={objective.smartRelevant}
                dueDate={objective.dueDate ?? undefined}
                onSave={onSmartSave}
              />

              {/* Definition of Done */}
              <div className="pt-2 border-t border-border/30">
                <div className="text-[11px] font-display font-bold text-foreground/60 uppercase tracking-wider mb-2">
                  Definition of Done
                </div>
                {editDod ? (
                  <div className="space-y-2">
                    <textarea
                      value={dodDraft}
                      onChange={e => setDodDraft(e.target.value)}
                      placeholder="Critères clairs pour considérer l'objectif comme terminé..."
                      className="w-full text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onDefinitionOfDoneSave(dodDraft.trim()); setEditDod(false); }}
                        className="text-xs font-body font-semibold text-primary px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => { setEditDod(false); setDodDraft(dod); }}
                        className="text-xs font-body text-muted-foreground px-3 py-1 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : dod ? (
                  <button
                    onClick={() => { setDodDraft(dod); setEditDod(true); }}
                    className="flex items-start gap-2 text-sm font-body text-foreground/80 hover:text-foreground transition-colors w-full text-left group/dod"
                  >
                    <span className="leading-relaxed whitespace-pre-wrap">{dod}</span>
                    <Pencil size={12} className="opacity-0 group-hover/dod:opacity-50 transition-opacity mt-1 shrink-0 text-muted-foreground" />
                  </button>
                ) : (
                  <button
                    onClick={() => { setDodDraft(""); setEditDod(true); }}
                    className="text-sm text-muted-foreground/50 hover:text-muted-foreground font-body italic transition-colors"
                  >
                    + Définir les critères d'achèvement...
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
