import { useNavigate } from "react-router-dom";
import { ArrowRight, FileWarning, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminDocs } from "@/hooks/useAdminDocs";

/**
 * Alert banner reminding the user of scanned documents still waiting to be
 * filed. Renders nothing when the triage queue is empty. Tapping it jumps
 * straight to the "À trier" scan inbox. Shown on /home and on the Documents
 * page so a pending document is hard to forget.
 */
export function PendingDocsBanner({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { pendingCount, urgentCount } = useAdminDocs();

  if (pendingCount === 0) return null;

  const hasUrgent = urgentCount > 0;

  return (
    <button
      onClick={() => navigate("/documents?tab=triage")}
      className={cn(
        "group w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors no-print",
        hasUrgent
          ? "border-red-300 bg-red-50 hover:bg-red-100"
          : "border-amber-300 bg-amber-50 hover:bg-amber-100",
        className,
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
        hasUrgent ? "bg-red-100" : "bg-amber-100",
      )}>
        <FileWarning size={18} className={hasUrgent ? "text-red-600" : "text-amber-600"} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-body font-semibold text-sm",
          hasUrgent ? "text-red-900" : "text-amber-900",
        )}>
          Il te reste {pendingCount} document{pendingCount > 1 ? "s" : ""} à compléter
        </p>
        <p className={cn(
          "text-xs font-body flex items-center gap-1 flex-wrap",
          hasUrgent ? "text-red-700" : "text-amber-700",
        )}>
          {hasUrgent && (
            <span className="inline-flex items-center gap-0.5 font-semibold">
              <Zap size={11} /> {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
              <span className="mx-0.5">·</span>
            </span>
          )}
          Appuie pour ouvrir la zone de tri
        </p>
      </div>

      <ArrowRight
        size={18}
        className={cn(
          "shrink-0 transition-transform group-hover:translate-x-0.5",
          hasUrgent ? "text-red-500" : "text-amber-500",
        )}
      />
    </button>
  );
}
