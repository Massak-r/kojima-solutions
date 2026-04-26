import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_CATEGORIES } from "@/lib/objectiveCategories";

interface AddObjectiveFormProps {
  onAdd: (text: string, isObjective: boolean, category: string) => void;
}

export function AddObjectiveForm({ onAdd }: AddObjectiveFormProps) {
  const [text, setText] = useState("");
  const [isObjective, setIsObjective] = useState(true);
  const [category, setCategory] = useState("Kojima-Solutions");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, isObjective, category);
    setText("");
    setIsObjective(false);
  }

  return (
    <div className="flex gap-1.5 pt-3 border-t border-border/30 mt-2">
      <Input
        id="new-objective-input"
        placeholder={isObjective ? "Nouvel objectif..." : "Nouvelle tâche..."}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === "Enter" && (e.preventDefault(), submit())}
        className="text-xs h-8"
      />
      <button
        onClick={() => setIsObjective(o => !o)}
        title={isObjective ? "Objectif SMART (cliquez pour basculer en tâche)" : "Tâche simple (cliquez pour basculer en objectif)"}
        className={cn(
          "h-8 px-2 rounded-md border text-xs font-body flex items-center gap-1 shrink-0 transition-colors",
          isObjective
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50",
        )}
      >
        <Target size={12} />
      </button>
      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="text-[10px] h-8 px-1.5 rounded-md border border-border bg-secondary/50 text-foreground font-body shrink-0"
      >
        {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
