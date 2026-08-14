import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubtaskCompletions } from "@/hooks/useSubtaskCompletions";
import { recurrenceDoneCount } from "@/lib/streak";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";

/**
 * Combien de fois cette tâche récurrente a été accomplie — un total, pas une série.
 *
 * C'était auparavant un badge « flamme » façon « ne casse pas la chaîne ! », qui
 * repartait de zéro dès qu'un cycle était manqué. Une remise à zéro silencieuse
 * sanctionne exactement les semaines où ça va déjà mal, et produit de l'évitement
 * plutôt que de l'élan. Le total, lui, ne redescend jamais : ce qui est fait
 * reste acquis.
 *
 * Le ton suit : plus de flamme ni d'ambre d'alerte, une coche et une teinte
 * discrète. C'est un fait qu'on constate, pas une alarme.
 *
 * Masqué sous 2 : « fait 1 fois » n'apprend rien.
 */
export function DoneCountBadge({ subtask, className }: { subtask: SubtaskItem; className?: string }) {
  const { data: completionsMap } = useSubtaskCompletions(subtask.source as ObjectiveSource);
  if (!subtask.recurrence) return null;
  const count = recurrenceDoneCount(completionsMap?.[subtask.id] ?? []);
  if (count < 2) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-body font-semibold text-primary/70 shrink-0",
        className,
      )}
      title={`Fait ${count} fois`}
    >
      <CheckCheck size={10} />
      {count}
    </span>
  );
}
