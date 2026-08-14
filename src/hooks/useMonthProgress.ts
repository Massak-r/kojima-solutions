import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useObjectives } from "@/hooks/useObjectives";
import { useObjectiveSubtasks } from "@/hooks/useSubtasks";
import { listPayables } from "@/api/payables";
import {
  ADMIN_CHECKLIST_OBJECTIVE_ID, monthProgress, type MonthProgress,
} from "@/lib/adminCompliance";

/**
 * The month's obligations, assembled from exactly the inputs the Centre admin
 * uses. Two screens showing two different counts for the same month would
 * destroy trust in both, so the gathering lives here rather than being
 * reimplemented per screen. The payables query shares its key with the admin
 * centre, so mounting this costs no extra request.
 */
export function useMonthProgress(): { progress: MonthProgress; ready: boolean } {
  const today = useMemo(() => new Date(), []);

  const { data: objectives } = useObjectives();
  const adminObj = objectives?.find(
    (o) => o.source === "admin"
      && (o.id === ADMIN_CHECKLIST_OBJECTIVE_ID || /checklists?\s+admin/i.test(o.text)),
  );
  const objectiveId = adminObj?.id ?? ADMIN_CHECKLIST_OBJECTIVE_ID;

  const { data: subtasks = [], isLoading: subLoading } = useObjectiveSubtasks(objectiveId);
  const { data: payables = [], isLoading: payLoading } = useQuery({
    queryKey: ["admin-center", "payables"],
    queryFn: () => listPayables(),
    staleTime: 60_000,
  });

  const progress = useMemo(
    () => monthProgress({ subtasks, payables, today }),
    [subtasks, payables, today],
  );

  return { progress, ready: !subLoading && !payLoading };
}
