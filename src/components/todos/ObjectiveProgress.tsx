import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ObjectiveProgressProps {
  completed: number;
  total: number;
  className?: string;
}

export function ObjectiveProgress({ completed, total, className }: ObjectiveProgressProps) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isDone = pct === 100;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Progress
        value={pct}
        className={cn(
          "h-2.5 flex-1 rounded-full",
          isDone ? "[&>div]:bg-emerald-500" : "[&>div]:bg-primary",
        )}
      />
      <span className={cn(
        "text-xs font-mono font-semibold whitespace-nowrap tabular-nums",
        isDone ? "text-emerald-600" : "text-foreground/70",
      )}>
        {completed}/{total}
      </span>
    </div>
  );
}
