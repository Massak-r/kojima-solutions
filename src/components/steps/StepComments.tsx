import { useState } from "react";
import { MessageSquare, Send, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StepComment } from "@/types/timeline";

const ROLE_STYLES: Record<string, { bg: string; label: string }> = {
  admin:       { bg: "bg-primary/10 text-primary", label: "Admin" },
  client:      { bg: "bg-emerald-50 text-emerald-700", label: "Client" },
  stakeholder: { bg: "bg-violet-50 text-violet-700", label: "Partie prenante" },
};

interface Props {
  comments: StepComment[];
  onAdd: (data: { message: string; authorName?: string; authorRole?: "client" | "admin" | "stakeholder" }) => void;
  isAdmin?: boolean;
}

export function StepComments({ comments, onAdd, isAdmin }: Props) {
  const [message, setMessage] = useState("");
  const [authorName, setAuthorName] = useState("");

  function handleSubmit() {
    if (!message.trim()) return;
    onAdd({
      message: message.trim(),
      authorName: authorName.trim() || (isAdmin ? "Admin" : undefined),
      authorRole: isAdmin ? "admin" : "client",
    });
    setMessage("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessageSquare size={12} />
        <span className="font-body font-medium">{comments.length} commentaire{comments.length !== 1 ? "s" : ""}</span>
      </div>

      {comments.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {comments.map((c) => {
            const role = ROLE_STYLES[c.authorRole] ?? ROLE_STYLES.client;
            return (
              <div key={c.id} className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-secondary/60 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={12} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-body font-semibold text-foreground/80">{c.authorName}</span>
                    <span className={cn("text-[9px] font-body font-medium px-1.5 py-0.5 rounded-full", role.bg)}>
                      {role.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 font-body ml-auto">
                      {new Date(c.createdAt).toLocaleDateString("fr-CH")}
                    </span>
                  </div>
                  <p className="text-xs font-body text-foreground/70 mt-0.5 whitespace-pre-wrap">{c.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add comment */}
      <div className="flex gap-2 items-end">
        {!isAdmin && (
          <Input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Votre nom"
            className="text-xs h-8 w-28"
          />
        )}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Ajouter un commentaire..."
          className="text-xs h-8 flex-1"
        />
        <Button size="sm" onClick={handleSubmit} disabled={!message.trim()} className="h-8 px-2.5">
          <Send size={12} />
        </Button>
      </div>
    </div>
  );
}
