import { useState } from "react";
import { Plus, Trash2, ChevronDown, List, CheckCircle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PhaseTemplate, GateTemplate, GateType, Tier } from "@/api/funnels";

const TIER_OPTIONS: { key: Tier; label: string }[] = [
  { key: "essential", label: "Essentiel" },
  { key: "professional", label: "Professionnel" },
  { key: "custom", label: "Sur mesure" },
];

const GATE_TYPE_ICONS: Record<GateType, typeof List> = {
  choice: List,
  approval: CheckCircle,
  feedback: MessageSquare,
};

interface TemplateEditorProps {
  name: string;
  description: string;
  icon: string;
  defaultTier: Tier | null;
  budgetRangeMin: number | null;
  budgetRangeMax: number | null;
  phases: PhaseTemplate[];
  onSave: (data: {
    name: string;
    description: string;
    icon: string | null;
    defaultTier: Tier | null;
    budgetRangeMin: number | null;
    budgetRangeMax: number | null;
    phasesJson: PhaseTemplate[];
  }) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function TemplateEditor({
  name: initName, description: initDesc, icon: initIcon, defaultTier: initTier,
  budgetRangeMin: initMin, budgetRangeMax: initMax, phases: initPhases,
  onSave, onCancel, saving,
}: TemplateEditorProps) {
  const [name, setName] = useState(initName);
  const [description, setDescription] = useState(initDesc);
  const [icon, setIcon] = useState(initIcon);
  const [defaultTier, setDefaultTier] = useState<Tier | null>(initTier);
  const [budgetMin, setBudgetMin] = useState(initMin?.toString() ?? "");
  const [budgetMax, setBudgetMax] = useState(initMax?.toString() ?? "");
  const [phases, setPhases] = useState<PhaseTemplate[]>(initPhases.length > 0 ? initPhases : []);

  function addPhase() {
    setPhases([...phases, { title: "Nouvelle phase", gates: [] }]);
  }

  function removePhase(idx: number) {
    setPhases(phases.filter((_, i) => i !== idx));
  }

  function updatePhase(idx: number, update: Partial<PhaseTemplate>) {
    setPhases(phases.map((p, i) => i === idx ? { ...p, ...update } : p));
  }

  function addGate(phaseIdx: number) {
    const p = phases[phaseIdx];
    updatePhase(phaseIdx, { gates: [...p.gates, { title: "Nouvelle porte", gateType: "approval" }] });
  }

  function removeGate(phaseIdx: number, gateIdx: number) {
    const p = phases[phaseIdx];
    updatePhase(phaseIdx, { gates: p.gates.filter((_, i) => i !== gateIdx) });
  }

  function updateGate(phaseIdx: number, gateIdx: number, update: Partial<GateTemplate>) {
    const p = phases[phaseIdx];
    updatePhase(phaseIdx, {
      gates: p.gates.map((g, i) => i === gateIdx ? { ...g, ...update } : g),
    });
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim() || null,
      defaultTier,
      budgetRangeMin: budgetMin ? parseFloat(budgetMin) : null,
      budgetRangeMax: budgetMax ? parseFloat(budgetMax) : null,
      phasesJson: phases,
    });
  }

  return (
    <div className="space-y-4">
      {/* Meta fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex gap-2">
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🏠"
            className="w-12 text-center text-lg bg-secondary/30 border border-border/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du template..."
            className="flex-1 text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description..."
          rows={2}
          className="sm:col-span-2 text-xs font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/30"
        />
        <div>
          <label className="text-[10px] text-muted-foreground/50 font-body block mb-1">Forfait par défaut</label>
          <div className="flex gap-1">
            {TIER_OPTIONS.map((t) => (
              <button
                key={t.key}
                onClick={() => setDefaultTier(defaultTier === t.key ? null : t.key)}
                className={cn(
                  "text-xs font-body px-2.5 py-1 rounded-full border transition-all",
                  defaultTier === t.key
                    ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                    : "border-transparent text-muted-foreground/40 hover:text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground/50 font-body block mb-1">Budget min (CHF)</label>
            <input
              type="number"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="2000"
              className="w-full text-xs font-body bg-secondary/30 border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground/50 font-body block mb-1">Budget max (CHF)</label>
            <input
              type="number"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="10000"
              className="w-full text-xs font-body bg-secondary/30 border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-3">
        <h4 className="text-xs font-display font-semibold text-muted-foreground/70 uppercase tracking-wider">
          Phases ({phases.length})
        </h4>

        {phases.map((phase, pIdx) => (
          <div key={pIdx} className="border border-border/50 rounded-lg bg-background/50 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
              <ChevronDown size={12} className="text-muted-foreground/30" />
              <input
                type="text"
                value={phase.title}
                onChange={(e) => updatePhase(pIdx, { title: e.target.value })}
                className="flex-1 text-sm font-body font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
              />
              <input
                type="number"
                value={phase.budget ?? ""}
                onChange={(e) => updatePhase(pIdx, { budget: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Budget"
                className="w-20 text-xs font-body text-right bg-secondary/30 border border-border/30 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              <button onClick={() => removePhase(pIdx)} className="p-1 text-muted-foreground/30 hover:text-destructive transition-colors">
                <Trash2 size={12} />
              </button>
            </div>

            {/* Gates within this phase */}
            <div className="px-3 pb-2 pt-1 space-y-1.5">
              {phase.gates.map((gate, gIdx) => {
                const GIcon = GATE_TYPE_ICONS[gate.gateType];
                return (
                  <div key={gIdx} className="flex items-center gap-2 py-1">
                    <GIcon size={11} className="text-muted-foreground/40 shrink-0" />
                    <input
                      type="text"
                      value={gate.title}
                      onChange={(e) => updateGate(pIdx, gIdx, { title: e.target.value })}
                      className="flex-1 text-xs font-body bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
                    />
                    <div className="flex gap-0.5">
                      {(["choice", "approval", "feedback"] as GateType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateGate(pIdx, gIdx, { gateType: t })}
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full transition-all",
                            gate.gateType === t
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground/30 hover:text-muted-foreground/60",
                          )}
                        >
                          {t === "choice" ? "C" : t === "approval" ? "A" : "F"}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => removeGate(pIdx, gIdx)} className="p-0.5 text-muted-foreground/20 hover:text-destructive transition-colors">
                      <Trash2 size={10} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => addGate(pIdx)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-primary transition-colors py-0.5"
              >
                <Plus size={10} /> Ajouter porte
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addPhase}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-primary transition-colors py-1"
        >
          <Plus size={12} /> Ajouter une phase
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border/30">
        <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <button onClick={onCancel} className="text-sm text-muted-foreground font-body">Annuler</button>
      </div>
    </div>
  );
}
