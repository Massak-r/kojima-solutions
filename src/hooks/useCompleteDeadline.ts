import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateDeadline, type AdminDeadline } from "@/api/adminDeadlines";
import { formatDateShortWithYear } from "@/lib/dateFormat";

/** Marquer une échéance comme faite, depuis n'importe quelle surface (brief,
 *  liste Échéances, réglages). Pour une récurrente, le serveur avance la date
 *  à la prochaine occurrence au lieu de la clore — le toast l'explique. */
export function useCompleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => updateDeadline(id, { completed: true }),
    onSuccess: (d: AdminDeadline) => {
      qc.invalidateQueries({ queryKey: ["admin-deadlines"] });
      if (!d.completed && d.recurring) {
        toast.success("Échéance faite", {
          description: `Récurrente — prochaine occurrence le ${formatDateShortWithYear(d.dueDate)}.`,
        });
      } else {
        toast.success("Échéance faite");
      }
    },
    onError: () => toast.error("Échéance non mise à jour", { description: "Réessaye ?" }),
  });
}
