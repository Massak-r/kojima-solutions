import { useState } from "react";
import {
  ChevronDown, GripVertical, List, CheckCircle2, MessageSquare,
  Trash2, Lock, Unlock, RefreshCw, CalendarDays, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateGate, deleteGate } from "@/api/funnels";
import type { FunnelGate, GateType } from "@/api/funnels";
import { GateOptionEditor } from "./GateOptionEditor";
import { useToast } from "@/hooks/use-toast";

const STEP_TYPES: { key: GateType; label: string; icon: typeof List }[] = [
  { key: "choice",   label: "Choix",      icon: List },
  { key: "approval", label: "Validation",  icon: CheckCircle2 },
  { key: "feedback", label: "Retour",      icon: MessageSquare },
];

const STATUS_CONFIG: Record<string, { dot: string; line: string; label: string; badge: string }> = {
  locked:   { dot: "bg-gray-300",   line: "border-gray-200",   label: "Verrouillé", badge: "bg-gray-100 text-gray-500" },
  open:     { dot: "bg-blue-500",   line: "border-blue-200",   label: "Ouvert",     badge: "bg-blue-50 text-blue-600" },
  approved: { dot: "bg-emerald-500", line: "border-emerald-200", label: "Validé",   badge: "bg-emerald-50 text-emerald-600" },
  revision: { dot: "bg-amber-500",  line: "border-amber-200",  label: "Révision",   badge: "bg-amber-50 text-amber-600" },
};

interface StepCardProps {
  gate: FunnelGate;
  onUpdate: () => void;
  isLast?: boolean;
  handleProps?: Record<string, unknown>;
}

export function StepCard({ gate, onUpdate, isLast, handleProps }: StepCardProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(gate.title);
  const [description, setDescription] = useState(gate.description);
  const [gateType, setGateType] = useState<GateType>(gate.gateType);
  const [deadline, setDeadline] = useState(gate.deadline ?? "");
  const [revisionLimit, setRevisionLimit] = useState(gate.revisionLimit);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  const TypeIcon = STEP_TYPES.find((t) => t.key === gate.gateType)?.icon ?? CheckCircle2;
  const status = STATUS_CONFIG[gate.status] ?? STATUS_CONFIG.locked;

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
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
    const next = gate.status === "locked" ? "open" : gate.status === "open" ? "locked" : gate.status;
    if (next === gate.status) return;
    try {
      await updateGate(gate.id, { status: next });
      onUpdate();
    } catch {}
  }

  return (
    <div className="flex gap-3 group min-w-0">
      {/* Timeline column */}
      <div className="flex flex-col items-center pt-3.5 shrink-0 w-6">
        <div className={cn("w-3 h-3 rounded-full shrink-0 ring-2 ring-background", status.dot)} />
        {!isLast && <div className={cn("w-0 flex-1 border-l-2 mt-1", status.line)} />}
      </div>

      {/* Card */}
      <div className={cn(
        "flex-1 mb-2 rounded-xl border transition-all",
        gate.status === "approved" ? "bg-card/60 border-border/50" : "bg-card border-border shadow-sm",
        gate.status === "open" && "ring-1 ring-primary/20",
        saved && "ring-2 ring-emerald-400/50 border-emerald-300",
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
          <button
            {...handleProps}
            className="p-0.5 text-muted-foreground/20 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation"
          >
            <GripVertical size={13} />
          </button>

          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", status.badge)}>
            <TypeIcon size={12} />
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 text-left text-sm font-body font-medium text-foreground min-w-0"
          >
            <span className="block truncate">{gate.title}</span>
          </button>

          {/* Status badge */}
          <span className={cn("text-[11px] font-body font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:inline", status.badge)}>
            {status.label}
          </span>

          {/* Revision count */}
          {gate.revisionCount > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-amber-600 font-body shrink-0 hidden sm:flex">
              <RefreshCw size={9} /> {gate.revisionCount}/{gate.revisionLimit}
            </span>
          )}

          {/* Deadline */}
          {gate.deadline && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-body shrink-0 hidden sm:flex">
              <CalendarDays size={9} />
              {new Date(gate.deadline).toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}
            </span>
          )}

          {/* Toggle lock */}
          <button
            onClick={toggleStatus}
            className="p-1 text-muted-foreground/20 hover:text-foreground transition-colors shrink-0"
            title={gate.status === "locked" ? "Ouvrir" : "Verrouiller"}
          >
            {gate.status === "locked" ? <Unlock size={12} /> : <Lock size={12} />}
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors shrink-0"
          >
            <ChevronDown size={13} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
            {editing ? (
              <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre..."
                  className="w-full text-sm font-body bg-secondary/30 border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                <div className="flex gap-1">
                  {STEP_TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setGateType(t.key)}
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-body px-3 py-1.5 rounded-full transition-all",
                        gateType === t.key
                          ? "bg-primary/10 text-primary font-semibold"
                          : "bg-secondary/40 text-muted-foreground/50 hover:text-muted-foreground",
                      )}
                    >
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description..."
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
                  <button onClick={handleSave} className="text-xs text-primary font-medium hover:underline">Enregistrer</button>
                  <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:underline">Annuler</button>
                </div>
              </div>
            ) : (
              <>
                {gate.description && (
                  <p className="text-xs text-muted-foreground font-body">{gate.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50 font-body">
                  <span>{STEP_TYPES.find((t) => t.key === gate.gateType)?.label}</span>
                  {gate.deadline && <span>Deadline: {new Date(gate.deadline).toLocaleDateString("fr-CH")}</span>}
                  <span>Révisions max: {gate.revisionLimit}</span>
                  {gate.gateType === "choice" && <span>{gate.options.length} option{gate.options.length !== 1 ? "s" : ""}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setTitle(gate.title); setDescription(gate.description); setGateType(gate.gateType); setDeadline(gate.deadline ?? ""); setRevisionLimit(gate.revisionLimit); setEditing(true); }} className="text-xs text-primary/70 hover:text-primary transition-colors">
                    Modifier
                  </button>
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

            {/* Options editor for choice type */}
            {gate.gateType === "choice" && (
              <GateOptionEditor gateId={gate.id} options={gate.options} onUpdate={onUpdate} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
