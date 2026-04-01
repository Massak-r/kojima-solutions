import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, ChevronDown, Copy, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  type ProjectTemplate, type PhaseTemplate, type Tier,
} from "@/api/funnels";
import { TemplateEditor } from "./TemplateEditor";

const TIER_LABELS: Record<Tier, string> = {
  essential: "Essentiel",
  professional: "Professionnel",
  custom: "Sur mesure",
};

const TIER_COLORS: Record<Tier, string> = {
  essential: "bg-gray-100 text-gray-700",
  professional: "bg-blue-100 text-blue-700",
  custom: "bg-violet-100 text-violet-700",
};

interface TemplateManagerProps {
  onApply?: (templateId: string) => void;
}

export function TemplateManager({ onApply }: TemplateManagerProps = {}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch {
      toast({ title: "Erreur de chargement", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleCreate() {
    setCreating(true);
    try {
      const tpl = await createTemplate({
        name: "Nouveau template",
        description: "",
        icon: "📋",
        phasesJson: [],
      });
      setTemplates([...templates, tpl]);
      setEditingId(tpl.id);
      setExpandedId(tpl.id);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(
    id: string,
    data: {
      name: string;
      description: string;
      icon: string | null;
      defaultTier: Tier | null;
      budgetRangeMin: number | null;
      budgetRangeMax: number | null;
      phasesJson: PhaseTemplate[];
    },
  ) {
    setSavingId(id);
    try {
      await updateTemplate(id, data);
      setEditingId(null);
      fetch();
      toast({ title: "Template enregistré" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDuplicate(tpl: ProjectTemplate) {
    try {
      const dup = await createTemplate({
        name: `${tpl.name} (copie)`,
        description: tpl.description,
        icon: tpl.icon,
        defaultTier: tpl.defaultTier,
        phasesJson: tpl.phasesJson,
        budgetRangeMin: tpl.budgetRangeMin,
        budgetRangeMax: tpl.budgetRangeMax,
      });
      setTemplates([...templates, dup]);
      toast({ title: "Template dupliqué" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
      setDeletingId(null);
      if (editingId === id) setEditingId(null);
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Template supprimé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground/50 font-body">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
          Nouveau template
        </Button>
      </div>

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground/40 font-body text-center py-8">
          Aucun template. Créez votre premier genome de projet.
        </p>
      )}

      {templates.map((tpl) => {
        const isExpanded = expandedId === tpl.id;
        const isEditing = editingId === tpl.id;
        const phaseCount = tpl.phasesJson?.length ?? 0;
        const gateCount = tpl.phasesJson?.reduce((sum, p) => sum + (p.gates?.length ?? 0), 0) ?? 0;

        return (
          <div key={tpl.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
              onClick={() => {
                if (!isEditing) setExpandedId(isExpanded ? null : tpl.id);
              }}
            >
              <span className="text-lg">{tpl.icon || "📋"}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-display font-bold text-foreground/80 truncate">{tpl.name}</h3>
                {tpl.description && (
                  <p className="text-xs text-muted-foreground/50 font-body truncate">{tpl.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {tpl.defaultTier && (
                  <span className={cn("text-[10px] font-body font-medium px-2 py-0.5 rounded-full", TIER_COLORS[tpl.defaultTier])}>
                    {TIER_LABELS[tpl.defaultTier]}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/40 font-body">
                  {phaseCount} phase{phaseCount !== 1 ? "s" : ""} · {gateCount} porte{gateCount !== 1 ? "s" : ""}
                </span>
                {tpl.budgetRangeMin != null && tpl.budgetRangeMax != null && (
                  <span className="text-[10px] text-muted-foreground/40 font-body">
                    {tpl.budgetRangeMin.toLocaleString("fr-CH")}–{tpl.budgetRangeMax.toLocaleString("fr-CH")} CHF
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {onApply && (
                  <button
                    onClick={() => onApply(tpl.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Appliquer au parcours"
                  >
                    <Play size={10} /> Appliquer
                  </button>
                )}
                <button
                  onClick={() => handleDuplicate(tpl)}
                  className="p-1.5 text-muted-foreground/30 hover:text-primary transition-colors"
                  title="Dupliquer"
                >
                  <Copy size={13} />
                </button>
                {deletingId === tpl.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(tpl.id)} className="text-[10px] text-destructive font-medium">
                      Supprimer
                    </button>
                    <button onClick={() => setDeletingId(null)} className="text-[10px] text-muted-foreground">
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(tpl.id)}
                    className="p-1.5 text-muted-foreground/30 hover:text-destructive transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <ChevronDown
                size={14}
                className={cn("text-muted-foreground/30 transition-transform shrink-0", isExpanded && "rotate-180")}
              />
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-border/30">
                {isEditing ? (
                  <TemplateEditor
                    name={tpl.name}
                    description={tpl.description}
                    icon={tpl.icon ?? ""}
                    defaultTier={tpl.defaultTier}
                    budgetRangeMin={tpl.budgetRangeMin}
                    budgetRangeMax={tpl.budgetRangeMax}
                    phases={tpl.phasesJson ?? []}
                    onSave={(data) => handleSave(tpl.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={savingId === tpl.id}
                  />
                ) : (
                  <div className="space-y-3">
                    {/* Read-only phase/gate summary */}
                    {(tpl.phasesJson ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground/30 font-body py-2">
                        Aucune phase définie.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {tpl.phasesJson.map((phase, pIdx) => (
                          <div key={pIdx} className="pl-3 border-l-2 border-primary/20">
                            <p className="text-sm font-body font-medium text-foreground/70">
                              {phase.title}
                              {phase.budget != null && (
                                <span className="text-xs text-muted-foreground/40 ml-2">
                                  {phase.budget.toLocaleString("fr-CH")} CHF
                                </span>
                              )}
                            </p>
                            {phase.gates.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {phase.gates.map((gate, gIdx) => (
                                  <p key={gIdx} className="text-xs text-muted-foreground/50 font-body flex items-center gap-1.5">
                                    <span className="inline-block w-3 text-center text-[9px] font-semibold text-primary/60">
                                      {gate.gateType === "choice" ? "C" : gate.gateType === "approval" ? "A" : "F"}
                                    </span>
                                    {gate.title}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setEditingId(tpl.id)}
                      className="text-xs text-primary/70 hover:text-primary font-medium transition-colors"
                    >
                      Modifier
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
