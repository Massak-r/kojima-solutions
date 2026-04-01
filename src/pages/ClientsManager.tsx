import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "@/contexts/ClientsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Mail, Phone, MapPin, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useInlineDelete } from "@/hooks/useInlineDelete";
import type { Client } from "@/types/client";

type FormState = Omit<Client, "id" | "createdAt">;

const EMPTY: FormState = { name: "", organization: "", email: "", phone: "", address: "", notes: "" };

export default function ClientsManager() {
  const navigate = useNavigate();
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [searchQuery, setSearchQuery] = useState("");
  const { confirmingId, requestDelete, confirmDelete, cancelDelete } = useInlineDelete();

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c) =>
      [c.name, c.organization, c.email, c.phone].some((f) => f?.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

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
    });
    setEditingId(client.id);
    setShowNew(false);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    const payload: FormState = {
      name: form.name.trim(),
      organization: form.organization?.trim() || undefined,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
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
              {editingId ? "Edit Client" : "New Client"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Organization</Label>
                <Input
                  value={form.organization ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+41 xx xxx xx xx"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, City, Country"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes about this client..."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={!form.name.trim()}>
                {editingId ? "Update Client" : "Add Client"}
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
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
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
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {confirmingId === client.id ? (
                    <>
                      <Button size="sm" variant="destructive" className="h-8 px-3 text-xs" onClick={() => confirmDelete(() => deleteClient(client.id))}>Supprimer</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={cancelDelete}>Annuler</Button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(client)}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => requestDelete(client.id)}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
