import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { WebsitePreview } from "@/components/modules/WebsitePreview";
import { getProjectModules, saveProjectModules } from "@/api/modules";
import {
  MODULE_CATALOG,
  MODULE_CATEGORIES,
  MAINTENANCE_OPTIONS,
  COMPLEXITY_LABELS,
  getModuleById,
  getModulePrice,
  getModuleYearlyFee,
} from "@/data/moduleCatalog";
import type { SelectedModule, ModuleComplexity, MaintenanceTier } from "@/types/module";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, GripVertical, X, Plus, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleIcon } from "@/components/modules/moduleIcons";

// ── Catalog draggable card ─────────────────────────────
function CatalogCard({ moduleId, disabled, onAdd }: { moduleId: string; disabled: boolean; onAdd: () => void }) {
  const mod = getModuleById(moduleId)!;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `catalog-${moduleId}`,
    data: { type: "catalog", moduleId },
    disabled,
  });

  const priceRange = `${mod.tiers[0].price.toLocaleString("fr-CH")} - ${mod.tiers[2].price.toLocaleString("fr-CH")} CHF`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => { if (!disabled) onAdd(); }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all select-none ${
        disabled
          ? "border-border/30 bg-muted/30 opacity-40 cursor-not-allowed"
          : isDragging
          ? "border-primary/40 bg-primary/5 opacity-50 shadow-md cursor-grabbing"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm cursor-pointer"
      }`}
    >
      <ModuleIcon name={mod.icon} size={16} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{mod.name}</div>
        <div className="text-[10px] text-muted-foreground">{priceRange}</div>
      </div>
      {!disabled && <Plus size={14} className="text-muted-foreground shrink-0" />}
    </div>
  );
}

// ── Selected module sortable card ──────────────────────
function SelectedCard({
  sel,
  onChangeComplexity,
  onRemove,
}: {
  sel: SelectedModule;
  onChangeComplexity: (c: ModuleComplexity) => void;
  onRemove: () => void;
}) {
  const mod = getModuleById(sel.moduleId)!;
  const tier = mod.tiers.find((t) => t.complexity === sel.complexity) ?? mod.tiers[0];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sel.moduleId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <div className="flex items-start gap-2 p-3">
        <button {...attributes} {...listeners} className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical size={14} />
        </button>
        <ModuleIcon name={mod.icon} size={16} className="mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{mod.name}</span>
            <button onClick={onRemove} className="text-muted-foreground hover:text-destructive shrink-0">
              <X size={14} />
            </button>
          </div>

          {/* Complexity toggle */}
          <div className="flex gap-0.5 mt-1.5 mb-1.5">
            {(["simple", "advanced", "custom"] as const).map((c) => (
              <button
                key={c}
                onClick={() => onChangeComplexity(c)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  sel.complexity === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {COMPLEXITY_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Price */}
          <div className="text-xs font-semibold text-primary">
            {tier.price.toLocaleString("fr-CH")} CHF
            {tier.yearlyFee ? (
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                + {tier.yearlyFee.toLocaleString("fr-CH")} CHF/an
              </span>
            ) : null}
          </div>

          {/* Features */}
          <div className="mt-1 space-y-0.5">
            {tier.features.slice(0, 3).map((f) => (
              <div key={f} className="text-[10px] text-muted-foreground flex gap-1 items-start">
                <span className="text-primary mt-px">&#x2022;</span>
                <span>{f}</span>
              </div>
            ))}
            {tier.features.length > 3 && (
              <div className="text-[10px] text-muted-foreground">+{tier.features.length - 3} de plus</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Drop zone ──────────────────────────────────────────
function DropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "selected-zone" });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : isEmpty ? "border-2 border-dashed border-border" : ""
      }`}
    >
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Plus size={20} className="mb-1" />
          <span className="text-xs">Glissez des modules ici</span>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────
export default function ProjectModules() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { toast } = useToast();

  const [modules, setModules] = useState<SelectedModule[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceTier>("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Load data
  useEffect(() => {
    if (!id) return;
    getProjectModules(id)
      .then((data) => {
        if (data) {
          setModules(Array.isArray(data.modules) ? data.modules : []);
          setMaintenance(data.maintenance || "none");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-save when dirty (debounced 1.5s)
  useEffect(() => {
    if (!dirty || !id) return;
    const timer = setTimeout(async () => {
      try {
        await saveProjectModules(id, modules, maintenance);
        setDirty(false);
      } catch {
        toast({ title: "Sauvegarde échouée", description: "Vérifiez votre connexion", variant: "destructive" });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [dirty, modules, maintenance, id]);

  // Helpers
  const selectedIds = useMemo(() => new Set((modules ?? []).map((m) => m.moduleId)), [modules]);

  const filteredCatalog = useMemo(
    () =>
      MODULE_CATALOG.filter(
        (m) => activeCategory === "all" || m.category === activeCategory,
      ),
    [activeCategory],
  );

  const totals = useMemo(() => {
    let oneTime = 0;
    let yearly = 0;
    for (const sel of modules ?? []) {
      oneTime += getModulePrice(sel.moduleId, sel.complexity);
      yearly += getModuleYearlyFee(sel.moduleId, sel.complexity);
    }
    const maint = MAINTENANCE_OPTIONS.find((o) => o.tier === maintenance);
    yearly += maint?.price ?? 0;
    return { oneTime, yearly };
  }, [modules, maintenance]);

  // Mutations
  const addModule = useCallback((moduleId: string) => {
    setModules((prev) => {
      if (prev.some((m) => m.moduleId === moduleId)) return prev;
      return [...prev, { moduleId, complexity: "simple" }];
    });
    setDirty(true);
  }, []);

  const removeModule = useCallback((moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.moduleId !== moduleId));
    setDirty(true);
  }, []);

  const changeComplexity = useCallback((moduleId: string, complexity: ModuleComplexity) => {
    setModules((prev) => prev.map((m) => (m.moduleId === moduleId ? { ...m, complexity } : m)));
    setDirty(true);
  }, []);

  // DnD handlers
  function handleDragStart(e: DragStartEvent) {
    setDragActiveId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as { type?: string; moduleId?: string } | undefined;

    // Catalog to drop zone
    if (activeData?.type === "catalog" && activeData.moduleId) {
      addModule(activeData.moduleId);
      return;
    }

    // Reorder within selected list
    if (active.id !== over.id && !String(active.id).startsWith("catalog-")) {
      setModules((prev) => {
        const oldIdx = prev.findIndex((m) => m.moduleId === active.id);
        const newIdx = prev.findIndex((m) => m.moduleId === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
      setDirty(true);
    }
  }

  // Save
  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await saveProjectModules(id, modules, maintenance);
      setDirty(false);
      toast({ title: "Modules sauvegardés" });
    } catch {
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-muted-foreground">
          Projet introuvable.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ProjectStepNav projectId={id!} currentStep="modules" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </div>
    );
  }

  // Overlay card for drag
  const draggedModule = dragActiveId?.startsWith("catalog-")
    ? getModuleById(dragActiveId.replace("catalog-", ""))
    : dragActiveId
    ? getModuleById(dragActiveId)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={id!} currentStep="modules" />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-heading font-semibold">{project.title}</h1>
              <p className="text-sm text-muted-foreground">Sélectionnez les modules fonctionnels du projet</p>
            </div>
            <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Sauvegarder
            </Button>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
            {/* LEFT: Catalog */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Catalogue</div>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-1">
                {MODULE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Module cards */}
              <div className="space-y-1.5">
                {filteredCatalog.map((mod) => (
                  <CatalogCard key={mod.id} moduleId={mod.id} disabled={selectedIds.has(mod.id)} onAdd={() => addModule(mod.id)} />
                ))}
              </div>
            </div>

            {/* RIGHT: Preview + Selected */}
            <div className="space-y-6">
              {/* Visual preview */}
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Aperçu</div>
                <WebsitePreview modules={modules} />
              </div>

              {/* Selected modules */}
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Modules sélectionnés ({modules.length})
                </div>
                <DropZone isEmpty={modules.length === 0}>
                  <SortableContext items={modules.map((m) => m.moduleId)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      <AnimatePresence>
                        {modules.map((sel) => (
                          <SelectedCard
                            key={sel.moduleId}
                            sel={sel}
                            onChangeComplexity={(c) => changeComplexity(sel.moduleId, c)}
                            onRemove={() => removeModule(sel.moduleId)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </SortableContext>
                </DropZone>
              </div>

              {/* Maintenance selector */}
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Maintenance annuelle</div>
                <div className="flex flex-wrap gap-2">
                  {MAINTENANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.tier}
                      onClick={() => { setMaintenance(opt.tier); setDirty(true); }}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                        maintenance === opt.tier
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing summary */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Setup (unique)</div>
                    <div className="text-xl font-heading font-bold">{totals.oneTime.toLocaleString("fr-CH")} CHF</div>
                  </div>
                  {totals.yearly > 0 && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Récurrent</div>
                      <div className="text-xl font-heading font-bold">{totals.yearly.toLocaleString("fr-CH")} CHF<span className="text-sm font-normal">/an</span></div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={async () => {
                      if (dirty && id) {
                        try { await saveProjectModules(id, modules, maintenance); setDirty(false); } catch {}
                      }
                      navigate(`/project/${id}/etapes`);
                    }}
                    variant="outline"
                    className="gap-1.5"
                  >
                    Continuer vers Etapes
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedModule ? (
            <div className="px-3 py-2 rounded-lg border border-primary/40 bg-card shadow-lg flex items-center gap-2 text-sm font-medium">
              <ModuleIcon name={draggedModule.icon} size={16} className="text-primary" />
              {draggedModule.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
