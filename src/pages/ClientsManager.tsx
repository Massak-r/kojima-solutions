import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/contexts/ClientsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { formatCHF } from "@/components/accounting/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Building2, Mail, Phone, MapPin, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import type { Client } from "@/types/client";

export default function ClientsManager() {
  const navigate = useNavigate();
  const { clients, deleteClient, restoreClient } = useClients();
  const { projects } = useProjects();
  const { quotes } = useQuotes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogClient, setDialogClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { deleteWithUndo } = useUndoableDelete<Client>({
    hardDelete: (id) => deleteClient(id),
    restore: (client) => restoreClient(client),
    message: (c) => `Client « ${c.name} » supprimé`,
  });

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c) =>
      [c.name, c.organization, c.email, c.phone].some((f) => f?.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  // Per-client value for the list: encaissé (paid quotes) + active project count.
  const statsByClient = useMemo(() => {
    const map: Record<string, { revenue: number; active: number }> = {};
    for (const p of projects) {
      if (!p.clientId) continue;
      (map[p.clientId] ??= { revenue: 0, active: 0 });
      if (p.status === "in-progress") map[p.clientId].active += 1;
    }
    const projClient = new Map(projects.filter((p) => p.clientId).map((p) => [p.id, p.clientId!]));
    const emailToClient = new Map(clients.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id]));
    for (const q of quotes) {
      if (q.isTemplate || q.invoiceStatus !== "paid") continue;
      let cid = q.projectId ? projClient.get(q.projectId) : undefined;
      if (!cid && q.clientEmail) cid = emailToClient.get(q.clientEmail.toLowerCase());
      if (cid) (map[cid] ??= { revenue: 0, active: 0 }).revenue += totalQuote(q);
    }
    return map;
  }, [projects, quotes, clients]);

  function startNew() {
    setDialogClient(null);
    setDialogOpen(true);
  }

  function startEdit(client: Client) {
    setDialogClient(client);
    setDialogOpen(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Building2 size={22} className="text-accent" />
            <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary-foreground/60">
              Répertoire
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                Clients
              </h1>
              <p className="font-body text-primary-foreground/65 mt-1 text-sm">
                Gérez votre répertoire de clients.
              </p>
            </div>
            <Button
              onClick={startNew}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-1.5"
            >
              <Plus size={15} /> Nouveau client
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Search */}
        {clients.length > 0 && (
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un client..."
              type="search"
              inputMode="search"
              enterKeyHint="search"
              className="pl-9 font-body"
            />
          </div>
        )}

        {/* Client list */}
        {clients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Aucun client"
            description="Ajoutez votre premier client pour l'utiliser dans les devis et projets."
            action={{ label: "Nouveau client", onClick: startNew, icon: Plus }}
          />
        ) : filteredClients.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground font-body py-12">
            Aucun client trouvé pour « {searchQuery} »
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredClients.map((client) => {
              const stats = statsByClient[client.id];
              return (
              <div
                key={client.id}
                className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <button
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  aria-label={`Voir la fiche de ${client.name}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-display text-sm font-semibold text-foreground">{client.name}</p>
                      {client.organization && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {client.organization}
                        </Badge>
                      )}
                      {client.hourlyRate != null && (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/40">
                          {client.hourlyRate} CHF/h
                        </Badge>
                      )}
                      {stats && stats.active > 0 && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {stats.active} projet{stats.active > 1 ? "s" : ""} actif{stats.active > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {stats && stats.revenue > 0 && (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/40">
                          {formatCHF(stats.revenue)} encaissé
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {client.email && (
                        <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                          <Mail size={11} /> {client.email}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                          <Phone size={11} /> {client.phone}
                        </span>
                      )}
                      {client.address && (
                        <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                          <MapPin size={11} /> {client.address}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(client)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    title="Modifier"
                    aria-label={`Modifier ${client.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteWithUndo(client)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Supprimer"
                    aria-label={`Supprimer ${client.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} client={dialogClient} />
    </div>
  );
}
