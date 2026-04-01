import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResponseHistoryEntry } from "@/types/timeline";

interface FeedbackAuditLogProps {
  history: ResponseHistoryEntry[];
  className?: string;
  defaultExpanded?: boolean;
}

export function FeedbackAuditLog({ history, className, defaultExpanded = false }: FeedbackAuditLogProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!history || history.length === 0) return null;

  return (
    <div className={cn("border border-border/60 rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <span className="font-body text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
          <Clock size={11} />
          Historique des retours ({history.length})
        </span>
        {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 py-2 space-y-2">
          {history.map((entry, i) => {
            const isApproval = entry.response === "approved" || entry.response.startsWith("approved");
            const isRevision = entry.response.startsWith("changes:");
            const displayResponse = isRevision
              ? entry.response.replace(/^changes:\s*/, "")
              : entry.response;

            return (
              <div key={entry.id || i} className="flex items-start gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  isApproval ? "bg-emerald-100" : "bg-amber-100",
                )}>
                  {isApproval
                    ? <CheckCircle2 size={10} className="text-emerald-600" />
                    : <span className="text-[8px] font-bold text-amber-600">{entry.revisionRound}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "font-body text-[10px] font-semibold",
                      isApproval ? "text-emerald-700" : "text-amber-700",
                    )}>
                      {isApproval ? "Approuvé" : `Révision demandée`}
                    </span>
                    {entry.respondedBy && (
                      <span className="font-body text-[9px] text-muted-foreground">
                        par {entry.respondedBy}
                      </span>
                    )}
                    <span className="font-body text-[9px] text-muted-foreground/60">
                      {new Date(entry.respondedAt).toLocaleDateString("fr-CH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {!isApproval && displayResponse && (
                    <p className="font-body text-xs text-foreground/70 mt-0.5 leading-relaxed">
                      {displayResponse}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
