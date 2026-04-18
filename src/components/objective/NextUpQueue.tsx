import { useRef, useState } from "react";
import { Plus, Calendar, CornerDownLeft } from "lucide-react";
import { SubtaskList } from "@/components/todos/SubtaskList";
import type { SubtaskItem } from "@/api/todoSubtasks";

interface NextUpQueueProps {
  subtasks: SubtaskItem[];
  onToggle: (id: string) => void;
  onAdd:    (text: string, dueDate: string | undefined, parentSubtaskId: string | null) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<SubtaskItem>) => void;
  actualsMap?: Record<string, number>;
}

export function NextUpQueue({ subtasks, onToggle, onAdd, onDelete, onUpdate, actualsMap }: NextUpQueueProps) {
  const [draft, setDraft] = useState("");
  const [due,   setDue]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    onAdd(text, due || undefined, null);
    setDraft("");
    setDue("");
    inputRef.current?.focus();
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
          Next up
        </div>
        {subtasks.length > 0 && (
          <div className="text-[11px] font-mono text-muted-foreground tabular-nums">
            {subtasks.filter(s => !s.completed).length} en cours · {subtasks.filter(s => s.completed).length} terminée{subtasks.filter(s => s.completed).length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Prominent quick-add — Enter adds + keeps focus for chaining */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/[0.06] border border-primary/25 focus-within:border-primary/60 focus-within:bg-primary/[0.08] transition-all">
        <Plus size={16} className="text-primary/60 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          data-next-up-input
          placeholder="Ajouter la prochaine étape… (N)"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          className="flex-1 text-sm font-body font-medium bg-transparent border-none px-0 py-0.5 focus:outline-none placeholder:text-muted-foreground/40"
        />
        <div className="flex items-center gap-1 shrink-0">
          <Calendar size={12} className="text-muted-foreground/40" />
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            className="bg-transparent text-xs font-body text-muted-foreground/70 w-[110px] focus:outline-none"
          />
        </div>
        {draft.trim() && (
          <button
            onClick={submit}
            className="flex items-center gap-1 text-xs font-body font-semibold text-primary hover:text-primary-foreground hover:bg-primary px-2.5 py-1 rounded-lg transition-all shrink-0"
          >
            <CornerDownLeft size={12} />
            Enter
          </button>
        )}
      </div>

      {/* Existing SubtaskList — with its own add input hidden */}
      {subtasks.length > 0 ? (
        <SubtaskList
          subtasks={subtasks}
          onToggle={onToggle}
          onAdd={onAdd}
          onDelete={onDelete}
          onUpdate={onUpdate}
          actualsMap={actualsMap}
          hideAddInput
        />
      ) : (
        <p className="text-xs text-muted-foreground/60 font-body italic px-1 py-2">
          Aucune étape encore. Commencez par la prochaine action concrète.
        </p>
      )}
    </div>
  );
}
