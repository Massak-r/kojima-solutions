import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { Client } from "@/types/client";
import * as api from "@/api/clients";

interface ClientsContextValue {
  clients: Client[];
  loading: boolean;
  addClient: (data: Omit<Client, "id" | "createdAt">) => Client;
  updateClient: (id: string, data: Partial<Omit<Client, "id" | "createdAt">>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);

  useEffect(() => {
    api.listClients()
      .then((data) => {
        setClients(data);
        setApiAvailable(true);
      })
      .catch(() => {
        setApiAvailable(false);
        try {
          const raw = localStorage.getItem("clients_data");
          setClients(raw ? JSON.parse(raw) : []);
        } catch {
          setClients([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((updated: Client[]) => {
    try { localStorage.setItem("clients_data", JSON.stringify(updated)); } catch {}
  }, []);

  const applyAndSync = useCallback(
    (updater: (prev: Client[]) => Client[], apiCall?: () => Promise<unknown>) => {
      setClients((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
      if (apiCall && apiAvailable) {
        apiCall().catch(() => {});
      }
    },
    [persist, apiAvailable]
  );

  const addClient = useCallback((data: Omit<Client, "id" | "createdAt">) => {
    const newClient: Client = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    applyAndSync(
      (prev) => [...prev, newClient],
      () => api.createClient({ ...newClient })
    );
    return newClient;
  }, [applyAndSync]);

  const updateClient = useCallback((id: string, data: Partial<Omit<Client, "id" | "createdAt">>) => {
    applyAndSync(
      (prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)),
      () => api.updateClient(id, data)
    );
  }, [applyAndSync]);

  const deleteClient = useCallback((id: string) => {
    applyAndSync(
      (prev) => prev.filter((c) => c.id !== id),
      () => api.deleteClient(id)
    );
  }, [applyAndSync]);

  const getClient = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients]
  );

  return (
    <ClientsContext.Provider value={{ clients, loading, addClient, updateClient, deleteClient, getClient }}>
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used within ClientsProvider");
  return ctx;
}
