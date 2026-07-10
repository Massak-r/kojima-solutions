import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  listTimeBlocks, createTimeBlock, updateTimeBlock, deleteTimeBlock,
  type TimeBlock, type TimeBlockRefKind,
} from "@/api/timeBlocks";

const keyFor = (day: string) => ["time-blocks", day] as const;

export function useTimeBlocks(day: string) {
  return useQuery({
    queryKey: keyFor(day),
    queryFn: () => listTimeBlocks(day),
    staleTime: 30_000,
  });
}

export function useCreateTimeBlock(day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      day: string; startMin: number; endMin?: number | null; title: string;
      color?: string; refKind?: TimeBlockRefKind; refId?: string;
    }) => createTimeBlock(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(day) }),
    onError: (err) =>
      toast({
        title: "Bloc non créé",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });
}

export function useUpdateTimeBlock(day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: {
      id: string;
      patch: Partial<Pick<TimeBlock, "startMin" | "endMin" | "title" | "color" | "doneMin">>;
    }) => updateTimeBlock(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keyFor(day) });
      const prev = qc.getQueryData<TimeBlock[]>(keyFor(day));
      qc.setQueryData<TimeBlock[]>(keyFor(day), (p) =>
        (p ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keyFor(day), ctx.prev);
      toast({ title: "Modification échouée", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keyFor(day) }),
  });
}

export function useDeleteTimeBlock(day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimeBlock(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keyFor(day) });
      const prev = qc.getQueryData<TimeBlock[]>(keyFor(day));
      qc.setQueryData<TimeBlock[]>(keyFor(day), (p) => (p ?? []).filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keyFor(day), ctx.prev);
      toast({ title: "Suppression échouée", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keyFor(day) }),
  });
}
