import { useEffect, useState } from "react";
import {
  CheckCircle2, Circle, Target, Play, Square, StickyNote, Upload, Link as LinkIcon,
  GitBranch, GitCommit, Activity as ActivityIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { listActivity, type ObjectiveActivity } from "@/api/objectiveActivity";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface ActivityTimelineProps {
  source: ObjectiveSource;
  objectiveId: string;
  /** bumping this value forces a re-fetch */
  refreshKey?: number;
}

function iconForKind(kind: string) {
  switch (kind) {
    case "subtask_completed":   return <CheckCircle2 size={13} className="text-emerald-500" />;
    case "subtask_uncompleted": return <Circle size={13} className="text-muted-foreground" />;
    case "focus_set":           return <Target size={13} className="text-amber-500" />;
    case "focus_cleared":       return <Target size={13} className="text-muted-foreground/50" />;
    case "session_started":     return <Play size={13} className="text-primary" />;
    case "session_ended":       return <Square size={13} className="text-primary" />;
    case "status_changed":      return <GitCommit size={13} className="text-blue-500" />;
    case "note_saved":          return <StickyNote size={13} className="text-violet-500" />;
    case "file_uploaded":       return <Upload size={13} className="text-sky-500" />;
    case "link_added":          return <LinkIcon size={13} className="text-cyan-500" />;
    case "decision_added":      return <GitBranch size={13} className="text-rose-500" />;
    default:                    return <ActivityIcon size={13} className="text-muted-foreground" />;
  }
}

function labelForKind(kind: string, payload: Record<string, any> | null | undefined): string {
  const text  = payload?.text as string | undefined;
  const durSec = payload?.durationSec as number | undefined;
  const from  = payload?.from as string | undefined;
  const to    = payload?.to as string | undefined;
  switch (kind) {
    case "subtask_completed":   return `Étape terminée : « ${text ?? "(sans titre)"} »`;
    case "subtask_uncompleted": return `Étape rouverte : « ${text ?? "(sans titre)"} »`;
    case "focus_set":           return `Focus sur : « ${text ?? "(sans titre)"} »`;
    case "focus_cleared":       return `Focus retiré`;
    case "session_started":     return "Session démarrée";
    case "session_ended": {
      if (!durSec || durSec < 1) return "Session arrêtée";
      const min = Math.floor(durSec / 60);
      const sec = durSec % 60;
      return `Session terminée · ${min > 0 ? `${min}min ` : ""}${sec}s`;
    }
    case "status_changed":  return `Statut : ${from ?? "?"} → ${to ?? "?"}`;
    case "note_saved":      return "Note enregistrée";
    case "file_uploaded":   return "Fichier ajouté";
    case "link_added":      return "Lien ajouté";
    case "decision_added":  return "Décision consignée";
    default:                return kind;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  return d.toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" });
}

export function ActivityTimeline({ source, objectiveId, refreshKey = 0 }: ActivityTimelineProps) {
  const [items,   setItems]   = useState<ObjectiveActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listActivity(source, objectiveId, 100)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [source, objectiveId, refreshKey]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/40 p-3 space-y-2">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/40 p-8 text-center">
        <ActivityIcon size={24} className="mx-auto text-muted-foreground/30 mb-2" />
        <div className="text-sm font-body text-muted-foreground">Aucune activité pour le moment.</div>
        <div className="text-xs font-body text-muted-foreground/50 mt-1">
          Les actions (étapes, sessions, fichiers, etc.) s'afficheront ici.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-2 sm:p-3">
      <ul className="relative space-y-0">
        {items.map((ev, i) => (
          <li key={ev.id} className={cn(
            "flex items-start gap-3 px-3 py-2.5",
            i < items.length - 1 && "border-b border-border/20",
          )}>
            <div className="w-6 h-6 rounded-full bg-card flex items-center justify-center shrink-0 mt-0.5 border border-border/40">
              {iconForKind(ev.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-body text-foreground/80 break-words">
                {labelForKind(ev.kind, ev.payload)}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/50 tabular-nums mt-0.5">
                {formatTime(ev.createdAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
