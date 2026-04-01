import { useState, useEffect, useRef } from "react";
import { X, Plus, Bold, List, GitBranch, Clock } from "lucide-react";
import { TimelineTask } from "@/types/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface FunnelPhaseOption {
  id: string;
  title: string;
}

interface TaskFormPanelProps {
  onAdd: (task: Omit<TimelineTask, "id">) => void;
  onEdit?: (task: TimelineTask) => void;
  editingTask?: TimelineTask | null;
  onCancelEdit?: () => void;
  taskCount: number;
  funnelPhases?: FunnelPhaseOption[];
}

const COLOR_OPTIONS: Array<TimelineTask["color"]> = ["primary", "accent", "secondary", "rose", "sage", "amber", "violet"];
const COLOR_LABELS: Record<NonNullable<TimelineTask["color"]>, string> = {
  primary:  "Navy",
  accent:   "Steel",
  secondary:"Sand",
  rose:     "Rose",
  sage:     "Sage",
  amber:    "Amber",
  violet:   "Violet",
};
const COLOR_DOTS: Record<NonNullable<TimelineTask["color"]>, string> = {
  primary:   "bg-primary",
  accent:    "bg-accent",
  secondary: "bg-secondary border border-border",
  rose:      "bg-palette-rose",
  sage:      "bg-palette-sage",
  amber:     "bg-palette-amber",
  violet:    "bg-palette-violet",
};

export function TaskFormPanel({ onAdd, onEdit, editingTask, onCancelEdit, taskCount, funnelPhases }: TaskFormPanelProps) {
  const [order, setOrder] = useState<number>(taskCount + 1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [color, setColor] = useState<TimelineTask["color"]>("primary");
  const [phaseId, setPhaseId] = useState<string | undefined>(undefined);
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [actualHours, setActualHours] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const descRef = useRef<HTMLTextAreaElement>(null);

  function insertMarkdown(type: "bold" | "list") {
    const textarea = descRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.slice(start, end);

    let insert: string;
    if (type === "bold") {
      insert = selected ? `**${selected}**` : "**bold text**";
    } else {
      insert = selected
        ? selected.split("\n").map((l) => `- ${l}`).join("\n")
        : "- item";
    }

    const next = description.slice(0, start) + insert + description.slice(end);
    setDescription(next);
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + insert.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }

  useEffect(() => {
    if (editingTask) {
      setOrder(editingTask.order);
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setDateLabel(editingTask.dateLabel);
      setColor(editingTask.color ?? "primary");
      setPhaseId(editingTask.phaseId);
      setEstimatedHours(editingTask.estimatedHours != null ? String(editingTask.estimatedHours) : "");
      setActualHours(editingTask.actualHours != null ? String(editingTask.actualHours) : "");
    } else {
      setOrder(taskCount + 1);
      setTitle("");
      setDescription("");
      setDateLabel("");
      setColor("primary");
      setPhaseId(undefined);
      setEstimatedHours("");
      setActualHours("");
    }
    setErrors({});
  }, [editingTask, taskCount]);

  function validate() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (!dateLabel.trim()) e.dateLabel = "Date or week is required";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      order,
      title: title.trim(),
      description: description.trim(),
      date: dateLabel.trim(),
      dateLabel: dateLabel.trim(),
      color,
      phaseId,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      actualHours: actualHours ? parseFloat(actualHours) : undefined,
    };

    if (editingTask && onEdit) {
      onEdit({ ...payload, id: editingTask.id });
    } else {
      onAdd(payload);
    }

    if (!editingTask) {
      setOrder(taskCount + 2);
      setTitle("");
      setDescription("");
      setDateLabel("");
      setColor("primary");
      setPhaseId(undefined);
      setEstimatedHours("");
      setActualHours("");
    }
    setErrors({});
  }

  return (
    <div className="bg-primary rounded-xl p-6 flex flex-col gap-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-primary-foreground">
          {editingTask ? "Edit Task" : "Add Task"}
        </h2>
        {editingTask && onCancelEdit && (
          <button
            onClick={onCancelEdit}
            className="text-primary-foreground/60 hover:text-primary-foreground transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[64px_1fr] gap-3">
          {/* Order */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider">
              #
            </Label>
            <Input
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-accent"
            />
          </div>
          {/* Date / Week */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider">
              Date / Week
            </Label>
            <Input
              placeholder="e.g. Week 3 · Jan 2025"
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-accent"
            />
            {errors.dateLabel && <span className="text-red-300 text-xs">{errors.dateLabel}</span>}
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider">
            Task Title
          </Label>
          <Input
            placeholder="e.g. Design System"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-accent"
          />
          {errors.title && <span className="text-red-300 text-xs">{errors.title}</span>}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider">
            Description
          </Label>
          <div className="flex gap-1 mb-1">
            <button
              type="button"
              onClick={() => insertMarkdown("bold")}
              className="p-1.5 rounded bg-primary-foreground/10 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
              title="Bold (**text**)"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown("list")}
              className="p-1.5 rounded bg-primary-foreground/10 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/20 transition-colors"
              title="Bullet list (- item)"
            >
              <List size={13} />
            </button>
            <span className="text-primary-foreground/30 text-[10px] font-body self-center ml-1">
              **bold** &nbsp; - list
            </span>
          </div>
          <Textarea
            ref={descRef}
            placeholder="Brief description of this phase…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-accent resize-none font-mono text-xs"
          />
        </div>

        {/* Hours */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider flex items-center gap-1">
              <Clock size={11} /> Heures estimées
            </Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="ex. 8"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider flex items-center gap-1">
              <Clock size={11} /> Heures réelles
            </Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="ex. 6"
              value={actualHours}
              onChange={(e) => setActualHours(e.target.value)}
              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-accent"
            />
          </div>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider">
            Card Color
          </Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                title={COLOR_LABELS[c!]}
                onClick={() => setColor(c)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-body font-medium transition-all border ${
                  color === c
                    ? "border-primary-foreground bg-primary-foreground/20 text-primary-foreground"
                    : "border-primary-foreground/20 text-primary-foreground/50 hover:border-primary-foreground/50"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOTS[c!]}`} />
                {COLOR_LABELS[c!]}
              </button>
            ))}
          </div>
        </div>

        {/* Phase link */}
        {funnelPhases && funnelPhases.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-primary-foreground/70 text-xs font-body uppercase tracking-wider flex items-center gap-1">
              <GitBranch size={11} /> Phase liée
            </Label>
            <select
              value={phaseId ?? ""}
              onChange={(e) => setPhaseId(e.target.value || undefined)}
              className="bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground text-xs font-body rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="" className="text-foreground bg-background">Aucune</option>
              {funnelPhases.map((p) => (
                <option key={p.id} value={p.id} className="text-foreground bg-background">{p.title}</option>
              ))}
            </select>
          </div>
        )}

        <Button
          type="submit"
          className="mt-1 bg-accent hover:bg-accent/90 text-accent-foreground font-body font-semibold flex items-center gap-2"
        >
          {editingTask ? (
            "Save Changes"
          ) : (
            <>
              <Plus size={16} />
              Add to Timeline
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
