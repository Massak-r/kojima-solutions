import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { listLeads, createLead, updateLead, deleteLead, type Lead, type LeadCreate } from "@/api/leads";

const KEY = ["leads"] as const;

export function useLeads() {
  return useQuery({ queryKey: KEY, queryFn: listLeads, staleTime: 30_000 });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LeadCreate) => createLead(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast({ title: "Lead non créé", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Lead> }) => updateLead(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Lead[]>(KEY);
      qc.setQueryData<Lead[]>(KEY, (p) => (p ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); toast({ title: "Mise à jour échouée", variant: "destructive" }); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Lead[]>(KEY);
      qc.setQueryData<Lead[]>(KEY, (p) => (p ?? []).filter((l) => l.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); toast({ title: "Suppression échouée", variant: "destructive" }); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const leadsQueryKey = KEY;
