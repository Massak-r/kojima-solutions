import { SubTask, FeedbackRequest } from "@/types/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  MessageSquarePlus,
  FileUp,
  Send,
} from "lucide-react";
import { useState } from "react";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

interface SubtaskManagerProps {
  subtasks: SubTask[];
  onChange: (subtasks: SubTask[]) => void;
}

export function SubtaskManager({ subtasks, onChange }: SubtaskManagerProps) {
  const [newTitle, setNewTitle] = useState("");

  const addSubtask = () => {
    if (!newTitle.trim()) return;
    onChange([...subtasks, { id: generateId(), title: newTitle.trim(), completed: false }]);
    setNewTitle("");
  };

  const toggle = (id: string) => {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)));
  };

  const remove = (id: string) => {
    onChange(subtasks.filter((s) => s.id !== id));
  };

  const completedCount = subtasks.filter((s) => s.completed).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-semibold text-foreground">
          Subtasks
        </p>
        {subtasks.length > 0 && (
          <span className="font-body text-[10px] text-muted-foreground">
            {completedCount}/{subtasks.length} done
          </span>
        )}
      </div>

      {subtasks.map((st) => (
        <div key={st.id} className="flex items-center gap-2 group">
          <Checkbox
            checked={st.completed}
            onCheckedChange={() => toggle(st.id)}
            className="h-3.5 w-3.5"
          />
          <span
            className={`flex-1 font-body text-xs ${
              st.completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {st.title}
          </span>
          <button
            onClick={() => remove(st.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}

      <div className="flex gap-1.5">
        <Input
          placeholder="Add subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())}
          className="text-xs h-7"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addSubtask}
          disabled={!newTitle.trim()}
          className="h-7 px-2"
        >
          <Plus size={12} />
        </Button>
      </div>
    </div>
  );
}

interface FeedbackRequestCreatorProps {
  onAdd: (type: "feedback" | "file", message: string) => void;
}

export function FeedbackRequestCreator({ onAdd }: FeedbackRequestCreatorProps) {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"feedback" | "file">("feedback");

  const handleSubmit = () => {
    if (!message.trim()) return;
    onAdd(type, message.trim());
    setMessage("");
  };

  return (
    <div className="space-y-2">
      <p className="font-display text-xs font-semibold text-foreground">Request from Client</p>
      <div className="flex gap-1 mb-1">
        <button
          onClick={() => setType("feedback")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-body font-medium transition-all border ${
            type === "feedback"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquarePlus size={10} />
          Feedback
        </button>
        <button
          onClick={() => setType("file")}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-body font-medium transition-all border ${
            type === "file"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileUp size={10} />
          File
        </button>
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder={type === "file" ? "Describe the file needed..." : "What feedback do you need?"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSubmit())}
          className="text-xs h-7"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!message.trim()}
          className="h-7 px-2 gap-1"
        >
          <Send size={10} />
        </Button>
      </div>
    </div>
  );
}
