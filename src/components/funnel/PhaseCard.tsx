import { useState, useCallback } from "react";
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updatePhase, deletePhase, createGate, updateGate } from "@/api/funnels";
import type { FunnelPhase } from "@/api/funnels";
import { GateCard } from "./GateCard";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const PHASE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pending:   { bg: "bg-gray-100", text: "text-gray-600", label: "En attente" },
  active:    { bg: "bg-blue-100", text: "text-blue-700", label: "En cours" },
  completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Terminé" },
  skipped:   { bg: "bg-gray-100", text: "text-gray-400", label: "Ignoré" },
};

function SortableGateItem({ id, children }: { id: string; children: (props: { handleProps: Record<string, unknown> }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: "relative" as const, zIndex: isDragging ? 50 : undefined };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ handleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

interface PhaseCardProps {
  phase: FunnelPhase;
  onUpdate: () => void;
  handleProps?: Record<string, unknown>;
}

export function PhaseCard({ phase, onUpdate, handleProps }: PhaseCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(phase.title);
  const [budget, setBudget] = useState(phase.budget?.toString() ?? "");
  const [deleting, setDeleting] = useState(false);
  const [addingGate, setAddingGate] = useState(false);
  const [newGateTitle, setNewGateTitle] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const statusStyle = PHASE_STATUS[phase.status] ?? PHASE_STATUS.pending;

  const gateIds = phase.gates.map((g) => g.id);
  const totalApproved = phase.gates.filter((g) => g.status === "approved").length;

  async function handleTitleBlur() {
    setEditingTitle(false);
    if (title.trim() && title !== phase.title) {
      try { await updatePhase(phase.id, { title: title.trim() }); onUpdate(); } catch {}
    }
  }

  async function handleBudgetBlur() {
    const val = budget ? parseFloat(budget) : null;
    if (val !== phase.budget) {
      try { await updatePhase(phase.id, { budget: val as any }); onUpdate(); } catch {}
    }
  }

  async function handleStatusCycle() {
    const order = ["pending", "active", "completed"] as const;
    const idx = order.indexOf(phase.status as any);
    const next = order[(idx + 1) % order.length];
    try { await updatePhase(phase.id, { status: next }); onUpdate(); } catch {}
  }

  async function handleDelete() {
    try { await deletePhase(phase.id); onUpdate(); }
    catch { toast({ title: "Erreur", variant: "destructive" }); }
  }

  async function handleAddGate() {
    if (!newGateTitle.trim()) return;
    try {
      await createGate({ phaseId: phase.id, title: newGateTitle.trim(), gateOrder: phase.gates.length });
      setNewGateTitle("");
      setAddingGate(false);
      onUpdate();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  const handleGateDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = phase.gates.findIndex((g) => g.id === active.id);
    const newIdx = phase.gates.findIndex((g) => g.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(phase.gates, oldIdx, newIdx);
    // Optimistic: update in parent via onUpdate after API calls
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].gateOrder !== i) {
        updateGate(reordered[i].id, { gateOrder: i }).catch(() => {});
      }
    }
    // Small delay then refresh
    setTimeout(onUpdate, 300);
  }, [phase.gates, onUpdate]);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent">
        <button {...handleProps} className="p-1 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-manipulation">
          <GripVertical size={14} />
        </button>

        {editingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
            className="flex-1 min-w-0 text-sm font-display font-bold bg-transparent border-b border-primary focus:outline-none py-0.5"
            autoFocus
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="flex-1 min-w-0 text-left text-sm font-display font-bold text-foreground/80 hover:text-foreground transition-colors">
            {phase.title}
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <input
            type="text"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            onBlur={handleBudgetBlur}
            placeholder="CHF"
            className="w-14 sm:w-20 text-xs font-body text-right bg-secondary/30 border border-border/30 rounded-md px-1.5 sm:px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/30"
          />
          <span className="text-[10px] text-muted-foreground/40 hidden sm:inline">CHF</span>
        </div>

        <button onClick={handleStatusCycle} className="shrink-0">
          <Badge variant="outline" className={cn("text-[9px] sm:text-[10px] px-1.5 py-0 cursor-pointer", statusStyle.bg, statusStyle.text)}>
            {statusStyle.label}
          </Badge>
        </button>

        <span className="text-[10px] text-muted-foreground/40 font-body shrink-0">
          {totalApproved}/{phase.gates.length}
        </span>

        {deleting ? (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleDelete} className="text-[10px] text-destructive font-medium">Supprimer</button>
            <button onClick={() => setDeleting(false)} className="text-[10px] text-muted-foreground">Annuler</button>
          </div>
        ) : (
          <button onClick={() => setDeleting(true)} className="p-1 text-muted-foreground/20 hover:text-destructive transition-colors shrink-0">
            <Trash2 size={13} />
          </button>
        )}

        <button onClick={() => setExpanded(!expanded)} className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors shrink-0">
          <ChevronDown size={14} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {/* Gates */}
      {expanded && (
        <div className="px-4 pb-3 pt-2 space-y-2">
          {phase.gates.length === 0 && !addingGate ? (
            <p className="text-xs text-muted-foreground/30 font-body py-2 text-center">Aucune porte de décision</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGateDragEnd}>
              <SortableContext items={gateIds} strategy={verticalListSortingStrategy}>
                {phase.gates.map((gate) => (
                  <SortableGateItem key={gate.id} id={gate.id}>
                    {({ handleProps: gateHandle }) => (
                      <GateCard gate={gate} onUpdate={onUpdate} handleProps={gateHandle} />
                    )}
                  </SortableGateItem>
                ))}
              </SortableContext>
            </DndContext>
          )}

          {addingGate ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGateTitle}
                onChange={(e) => setNewGateTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddGate()}
                placeholder="Titre de la porte..."
                className="flex-1 text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                autoFocus
              />
              <button onClick={handleAddGate} className="text-xs text-primary font-medium">Ajouter</button>
              <button onClick={() => { setAddingGate(false); setNewGateTitle(""); }} className="text-xs text-muted-foreground">Annuler</button>
            </div>
          ) : (
            <button
              onClick={() => setAddingGate(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-primary transition-colors py-1"
            >
              <Plus size={12} /> Ajouter une porte de décision
            </button>
          )}
        </div>
      )}
    </div>
  );
}
