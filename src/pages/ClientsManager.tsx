import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/contexts/ClientsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { formatCHF } from "@/components/accounting/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Mail, Phone, MapPin, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import type { Client } from "@/types/client";

type FormState = Omit<Client, "id" | "createdAt" | "hourlyRate"> & {
  /** Editable as string so the empty/decimal state stays predictable in the form. */
  hourlyRateInput: string;
};

const EMPTY: FormState = { name: "", organization: "", email: "", phone: "", address: "", notes: "", hourlyRateInput: "" };

export default function ClientsManager() {
  const navigate = useNavigate();
  const { clients, addClient, updateClient, deleteClient, restoreClient } = useClients();
  const { projects } = useProjects();
  const { quotes } = useQuotes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
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
    setForm(EMPTY);
    setEditingId(null);
    setShowNew(true);
  }

  function startEdit(client: Client) {
    setForm({
      name: client.name,
      organization: client.organization ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      notes: client.notes ?? "",
      hourlyRateInput: client.hourlyRate != null ? String(client.hourlyRate) : "",
    });
    setEditingId(client.id);
    setShowNew(false);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const rateTrimmed = form.hourlyRateInput.trim().replace(",", ".");
    const rateValue = rateTrimmed === "" ? null : Number.parseFloat(rateTrimmed);
    const hourlyRate = rateValue != null && Number.isFinite(rateValue) && rateValue > 0 ? rateValue : null;
    const payload = {
      name: form.name.trim(),
      organization: form.organization?.trim() || undefined,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      hourlyRate,
    };
    if (editingId) {
      updateClient(editingId, payload);
    } else {
      addClient(payload);
    }
    setShowNew(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  function handleCancel() {
    setShowNew(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  const isFormOpen = showNew || editingId !== null;

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

        {/* Form */}
        {isFormOpen && (
          <div className="bg-card border border-border rounded-xl p-6 mb-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-foreground">
              {editingId ? "Modifier le client" : "Nouveau client"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nom complet"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Organisation</Label>
                <Input
                  value={form.organization ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                  placeholder="Nom de l'entreprise"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemple.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone</Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+41 xx xxx xx xx"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Adresse</Label>
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Rue, ville, pays"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Taux horaire personnalisé (CHF/h)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.hourlyRateInput}
                  onChange={(e) => setForm((f) => ({ ...f, hourlyRateInput: e.target.value }))}
                  placeholder="Laisser vide pour utiliser le taux par défaut"
                />
                <p className="text-[11px] text-muted-foreground/70 leading-snug">
                  Utilisé par « Importer le temps tracé » lors de la création d'une facture. Si vide, le taux par défaut (Réglages) s'applique.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes internes sur ce client…"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleCancel}>Annuler</Button>
              <Button size="sm" onClick={handleSave} disabled={!form.name.trim()}>
                {editingId ? "Mettre à jour" : "Ajouter"}
              </Button>
            </div>
          </div>
        )}

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
        {clients.length === 0 && !isFormOpen ? (
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
    </div>
  );
}
