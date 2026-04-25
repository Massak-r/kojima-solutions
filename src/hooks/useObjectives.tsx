import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import {
  listAllUnified,
  createObjectiveBySource,
  updateObjectiveBySource,
  deleteObjectiveBySource,
  type CreateObjectivePayload,
  type ObjectiveSource,
  type UnifiedObjective,
} from "@/api/objectiveSource";

const OBJECTIVES_KEY = ["objectives"] as const;

function notifyError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "Erreur inconnue");
  toast({
    title: label,
    description: message.slice(0, 240),
    variant: "destructive",
  });
}

function snapshot(qc: QueryClient): UnifiedObjective[] {
  return qc.getQueryData<UnifiedObjective[]>(OBJECTIVES_KEY) ?? [];
}

function setObjectivesCache(qc: QueryClient, updater: (prev: UnifiedObjective[]) => UnifiedObjective[]) {
  qc.setQueryData<UnifiedObjective[]>(OBJECTIVES_KEY, (prev) => updater(prev ?? []));
}

export function useObjectives() {
  return useQuery({
    queryKey: OBJECTIVES_KEY,
    queryFn: () => listAllUnified(),
    staleTime: 30_000,
  });
}

export function useObjective(source: ObjectiveSource | undefined, id: string | undefined) {
  return useQuery({
    queryKey: OBJECTIVES_KEY,
    queryFn: () => listAllUnified(),
    staleTime: 30_000,
    enabled: !!source && !!id,
    select: (list) =>
      source && id ? list.find((o) => o.source === source && o.id === id) ?? null : null,
  });
}

export function useCreateObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ source, data }: { source: ObjectiveSource; data: CreateObjectivePayload }) =>
      createObjectiveBySource(source, data),
    onMutate: async ({ source, data }) => {
      await qc.cancelQueries({ queryKey: OBJECTIVES_KEY });
      const prev = snapshot(qc);
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: UnifiedObjective = {
        id: tempId,
        source,
        text: data.text,
        completed: false,
        category: data.category,
        dueDate: data.dueDate ?? null,
        recurring: data.recurring ?? null,
        isObjective: data.isObjective ?? false,
        description: data.description ?? null,
        smartSpecific: data.smartSpecific ?? null,
        smartMeasurable: data.smartMeasurable ?? null,
        smartAchievable: data.smartAchievable ?? null,
        smartRelevant: data.smartRelevant ?? null,
        priority: data.priority ?? "medium",
        status: data.status ?? "not_started",
        definitionOfDone: null,
        linkedProjectId: null,
        linkedClientId: null,
        order: 0,
        createdAt: new Date().toISOString(),
      };
      setObjectivesCache(qc, (list) => [...list, optimistic]);
      return { prev, tempId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(OBJECTIVES_KEY, ctx.prev);
      notifyError("Création de l'objectif échouée", err);
    },
    onSuccess: (created, _vars, ctx) => {
      setObjectivesCache(qc, (list) =>
        list.map((o) => (o.id === ctx?.tempId ? created : o)),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: OBJECTIVES_KEY });
    },
  });
}

export function useUpdateObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ source, id, patch }: { source: ObjectiveSource; id: string; patch: Partial<UnifiedObjective> }) =>
      updateObjectiveBySource(source, id, patch),
    onMutate: async ({ source, id, patch }) => {
      await qc.cancelQueries({ queryKey: OBJECTIVES_KEY });
      const prev = snapshot(qc);
      setObjectivesCache(qc, (list) =>
        list.map((o) => (o.source === source && o.id === id ? { ...o, ...patch } : o)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(OBJECTIVES_KEY, ctx.prev);
      notifyError("Modification de l'objectif échouée", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: OBJECTIVES_KEY });
    },
  });
}

export function useDeleteObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ source, id }: { source: ObjectiveSource; id: string }) =>
      deleteObjectiveBySource(source, id),
    onMutate: async ({ source, id }) => {
      await qc.cancelQueries({ queryKey: OBJECTIVES_KEY });
      const prev = snapshot(qc);
      setObjectivesCache(qc, (list) =>
        list.filter((o) => !(o.source === source && o.id === id)),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(OBJECTIVES_KEY, ctx.prev);
      notifyError("Suppression de l'objectif échouée", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: OBJECTIVES_KEY });
    },
  });
}

export const objectivesQueryKey = OBJECTIVES_KEY;
