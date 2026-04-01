import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

interface RevisionCounterProps {
  current: number;
  limit: number;
  className?: string;
  compact?: boolean;
}

export function RevisionCounter({ current, limit, className, compact = false }: RevisionCounterProps) {
  const remaining = Math.max(0, limit - current);
  const atLimit = current >= limit;
  const approaching = remaining === 1;

  const color = atLimit
    ? "text-muted-foreground"
    : approaching
      ? "text-amber-600"
      : "text-emerald-600";

  const dotColor = atLimit
    ? "bg-muted-foreground/40"
    : approaching
      ? "bg-amber-400"
      : "bg-emerald-400";

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 font-body text-[10px]", color, className)}>
        <RefreshCw size={10} />
        Tour {Math.min(current + 1, limit)} sur {limit}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i < current ? dotColor : "bg-border",
              i === current && !atLimit && "ring-2 ring-offset-1 ring-current",
            )}
          />
        ))}
      </div>
      <span className={cn("font-body text-[10px]", color)}>
        {atLimit
          ? "Des tours supplémentaires sont disponibles sur demande"
          : `Tour ${current + 1} sur ${limit}`
        }
      </span>
    </div>
  );
}
