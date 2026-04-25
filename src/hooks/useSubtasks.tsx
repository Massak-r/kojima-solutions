import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  listSubtasks,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  batchCompleteSubtasks,
  type SubtaskItem,
} from "@/api/todoSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";

const ALL_SUBTASKS_KEY = ["subtasks", "all"] as const;

function notifyError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "Erreur inconnue");
  toast({
    title: label,
    description: message.slice(0, 240),
    variant: "destructive",
  });
}

function snapshot(qc: QueryClient): SubtaskItem[] {
  return qc.getQueryData<SubtaskItem[]>(ALL_SUBTASKS_KEY) ?? [];
}

function setSubtasksCache(qc: QueryClient, updater: (prev: SubtaskItem[]) => SubtaskItem[]) {
  qc.setQueryData<SubtaskItem[]>(ALL_SUBTASKS_KEY, (prev) => updater(prev ?? []));
}

async function fetchAllSubtasks(): Promise<SubtaskItem[]> {
  const [admin, personal] = await Promise.all([
    listSubtasks(undefined, "admin"),
    listSubtasks(undefined, "personal"),
  ]);
  return [...admin, ...personal];
}

export function useAllSubtasks() {
  return useQuery({
    queryKey: ALL_SUBTASKS_KEY,
    queryFn: fetchAllSubtasks,
    staleTime: 30_000,
  });
}

/** Subset for one parent objective. Reuses the unified subtasks query for cache reuse. */
export function useObjectiveSubtasks(parentId: string | undefined) {
  return useQuery({
    queryKey: ALL_SUBTASKS_KEY,
    queryFn: fetchAllSubtasks,
    staleTime: 30_000,
    enabled: !!parentId,
    select: (list) => (parentId ? list.filter((s) => s.parentId === parentId) : []),
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createSubtask>[0]) => createSubtask(data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: ALL_SUBTASKS_KEY });
      const prev = snapshot(qc);
      const tempId = `temp-${crypto.randomUUID()}`;
      const siblings = prev.filter(
        (s) => s.parentId === data.parentId && (s.parentSubtaskId ?? null) === (data.parentSubtaskId ?? null),
      );
      const nextOrder = siblings.length === 0 ? 0 : Math.max(...siblings.map((s) => s.order)) + 1;
      const optimistic: SubtaskItem = {
        id: tempId,
        source: data.source,
        parentId: data.parentId,
        parentSubtaskId: data.parentSubtaskId ?? null,
        text: data.text,
        completed: false,
        dueDate: data.dueDate,
        order: nextOrder,
        description: data.description ?? null,
        priority: data.priority ?? "medium",
        status: data.status ?? "not_started",
        flaggedToday: false,
        effortSize: data.effortSize ?? null,
        estimatedMinutes: data.estimatedMinutes ?? null,
        createdAt: new Date().toISOString(),
      };
      setSubtasksCache(qc, (list) => [...list, optimistic]);
      return { prev, tempId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ALL_SUBTASKS_KEY, ctx.prev);
      notifyError("Création de l'étape échouée", err);
    },
    onSuccess: (created, _vars, ctx) => {
      setSubtasksCache(qc, (list) =>
        list.map((s) => (s.id === ctx?.tempId ? created : s)),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ALL_SUBTASKS_KEY });
    },
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SubtaskItem> }) =>
      updateSubtask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ALL_SUBTASKS_KEY });
      const prev = snapshot(qc);
      setSubtasksCache(qc, (list) =>
        list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ALL_SUBTASKS_KEY, ctx.prev);
      notifyError("Mise à jour de l'étape échouée", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ALL_SUBTASKS_KEY });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubtask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ALL_SUBTASKS_KEY });
      const prev = snapshot(qc);
      // Cascade locally: also drop any children
      setSubtasksCache(qc, (list) =>
        list.filter((s) => s.id !== id && s.parentSubtaskId !== id),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ALL_SUBTASKS_KEY, ctx.prev);
      notifyError("Suppression de l'étape échouée", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ALL_SUBTASKS_KEY });
    },
  });
}

export function useBatchCompleteSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, subtasks }: { parentId: string; subtasks: SubtaskItem[] }) =>
      batchCompleteSubtasks(parentId, subtasks),
    onMutate: async ({ parentId }) => {
      await qc.cancelQueries({ queryKey: ALL_SUBTASKS_KEY });
      const prev = snapshot(qc);
      setSubtasksCache(qc, (list) =>
        list.map((s) => (s.parentId === parentId ? { ...s, completed: true } : s)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ALL_SUBTASKS_KEY, ctx.prev);
      notifyError("Validation en lot échouée", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ALL_SUBTASKS_KEY });
    },
  });
}

export const subtasksQueryKey = ALL_SUBTASKS_KEY;

export type { SubtaskItem, ObjectiveSource };
