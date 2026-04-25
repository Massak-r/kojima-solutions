import { useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { Client } from "@/types/client";
import * as api from "@/api/clients";

const CLIENTS_KEY = ["clients"] as const;

interface ClientsContextValue {
  clients: Client[];
  loading: boolean;
  addClient: (data: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, data: Partial<Omit<Client, "id" | "createdAt">>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
}

// Provider is now a no-op pass-through. The real cache lives in react-query
// (QueryClientProvider in App.tsx) and `useClients()` reads from it directly.
export function ClientsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function notifyError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "Erreur inconnue");
  toast({ title: label, description: message.slice(0, 240), variant: "destructive" });
}

function setCache(qc: QueryClient, updater: (prev: Client[]) => Client[]) {
  qc.setQueryData<Client[]>(CLIENTS_KEY, (prev) => updater(prev ?? []));
}

export function useClients(): ClientsContextValue {
  const qc = useQueryClient();
  const { data: clients = [], isLoading } = useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: () => api.listClients(),
    staleTime: 30_000,
  });

  const addClient = useCallback((data: Omit<Client, "id" | "createdAt">) => {
    const newClient: Client = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setCache(qc, (prev) => [...prev, newClient]);
    api.createClient(newClient)
      .then(() => qc.invalidateQueries({ queryKey: CLIENTS_KEY }))
      .catch((err) => {
        setCache(qc, (prev) => prev.filter((c) => c.id !== newClient.id));
        notifyError("Création client échouée", err);
      });
    return newClient;
  }, [qc]);

  const updateClient = useCallback(
    (id: string, data: Partial<Omit<Client, "id" | "createdAt">>) => {
      const prev = qc.getQueryData<Client[]>(CLIENTS_KEY) ?? [];
      setCache(qc, (list) => list.map((c) => (c.id === id ? { ...c, ...data } : c)));
      api.updateClient(id, data)
        .then(() => qc.invalidateQueries({ queryKey: CLIENTS_KEY }))
        .catch((err) => {
          qc.setQueryData(CLIENTS_KEY, prev);
          notifyError("Modification client échouée", err);
        });
    },
    [qc],
  );

  const deleteClient = useCallback((id: string) => {
    const prev = qc.getQueryData<Client[]>(CLIENTS_KEY) ?? [];
    setCache(qc, (list) => list.filter((c) => c.id !== id));
    api.deleteClient(id)
      .then(() => qc.invalidateQueries({ queryKey: CLIENTS_KEY }))
      .catch((err) => {
        qc.setQueryData(CLIENTS_KEY, prev);
        notifyError("Suppression client échouée", err);
      });
  }, [qc]);

  const getClient = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients],
  );

  return { clients, loading: isLoading, addClient, updateClient, deleteClient, getClient };
}
