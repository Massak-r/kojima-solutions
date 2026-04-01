import { useState } from "react";
import { ChevronDown, GripVertical, List, CheckCircle, MessageSquare, Trash2, Lock, Unlock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateGate, deleteGate } from "@/api/funnels";
import type { FunnelGate, GateType } from "@/api/funnels";
import { GateOptionEditor } from "./GateOptionEditor";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const GATE_TYPES: { key: GateType; label: string; icon: typeof List }[] = [
  { key: "choice", label: "Choix", icon: List },
  { key: "approval", label: "Approbation", icon: CheckCircle },
  { key: "feedback", label: "Feedback", icon: MessageSquare },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  locked:   { bg: "bg-gray-100", text: "text-gray-600", label: "Verrouillé" },
  open:     { bg: "bg-blue-100", text: "text-blue-700", label: "Ouvert" },
  approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Validé" },
  revision: { bg: "bg-amber-100", text: "text-amber-700", label: "Révision" },
};

interface GateCardProps {
  gate: FunnelGate;
  onUpdate: () => void;
  handleProps?: Record<string, unknown>;
}

export function GateCard({ gate, onUpdate, handleProps }: GateCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(gate.title);
  const [description, setDescription] = useState(gate.description);
  const [gateType, setGateType] = useState<GateType>(gate.gateType);
  const [deadline, setDeadline] = useState(gate.deadline ?? "");
  const [revisionLimit, setRevisionLimit] = useState(gate.revisionLimit);
  const [deleting, setDeleting] = useState(false);

  const TypeIcon = GATE_TYPES.find((t) => t.key === gate.gateType)?.icon ?? CheckCircle;
  const statusStyle = STATUS_STYLES[gate.status] ?? STATUS_STYLES.locked;

  async function handleSave() {
    try {
      await updateGate(gate.id, {
        title: title.trim() || gate.title,
        description,
        gateType,
        deadline: deadline || undefined,
        revisionLimit,
      });
      setEditing(false);
      onUpdate();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteGate(gate.id);
      onUpdate();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function toggleStatus() {
    const nextStatus = gate.status === "locked" ? "open" : gate.status === "open" ? "locked" : gate.status;
    if (nextStatus === gate.status) return;
    try {
      await updateGate(gate.id, { status: nextStatus });
      onUpdate();
    } catch {}
  }

  return (
    <div className={cn(
      "border rounded-lg bg-background/60 transition-all",
      gate.status === "approved" && "opacity-60",
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button {...handleProps} className="p-1 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-manipulation">
          <GripVertical size={14} />
        </button>

        <TypeIcon size={14} className="text-muted-foreground/50 shrink-0" />

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-sm font-body font-medium text-foreground/80 min-w-0"
        >
          {gate.title}
        </button>

        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusStyle.bg, statusStyle.text)}>
          {statusStyle.label}
        </Badge>

        {gate.gateType === "choice" && (
          <span className="text-[10px] text-muted-foreground/40">{gate.options.length} opt.</span>
        )}

        {gate.revisionCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
            <RefreshCw size={9} /> {gate.revisionCount}/{gate.revisionLimit}
          </span>
        )}

        <button
          onClick={toggleStatus}
          className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors"
          title={gate.status === "locked" ? "Ouvrir" : "Verrouiller"}
        >
          {gate.status === "locked" ? <Unlock size={12} /> : <Lock size={12} />}
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors"
        >
          <ChevronDown size={13} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre..."
                className="w-full text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <div className="flex gap-1">
                {GATE_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setGateType(t.key)}
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-full transition-all",
                      gateType === t.key
                        ? "bg-primary/10 text-primary font-semibold"
                        : "bg-secondary/40 text-muted-foreground/50 hover:text-muted-foreground",
                    )}
                  >
                    <t.icon size={11} /> {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (ce qui est décidé ici)..."
                rows={2}
                className="w-full text-xs font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/30"
              />

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground/50 font-body">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full text-xs font-body bg-secondary/30 border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
                <div className="w-24">
                  <label className="text-[10px] text-muted-foreground/50 font-body">Révisions max</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={revisionLimit}
                    onChange={(e) => setRevisionLimit(Number(e.target.value))}
                    className="w-full text-xs font-body bg-secondary/30 border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} className="text-xs text-primary font-medium">Enregistrer</button>
                <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground">Annuler</button>
              </div>
            </div>
          ) : (
            <>
              {gate.description && (
                <p className="text-xs text-muted-foreground/60 font-body">{gate.description}</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40 font-body">
                <span>Type: {GATE_TYPES.find((t) => t.key === gate.gateType)?.label}</span>
                {gate.deadline && <span>Deadline: {gate.deadline}</span>}
                <span>Révisions: {gate.revisionLimit}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="text-xs text-primary/70 hover:text-primary transition-colors">Modifier</button>
                {deleting ? (
                  <>
                    <button onClick={handleDelete} className="text-xs text-destructive font-medium">Confirmer</button>
                    <button onClick={() => setDeleting(false)} className="text-xs text-muted-foreground">Annuler</button>
                  </>
                ) : (
                  <button onClick={() => setDeleting(true)} className="text-xs text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </>
          )}

          {/* Options editor for choice gates */}
          {gate.gateType === "choice" && (
            <GateOptionEditor gateId={gate.id} options={gate.options} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
}
