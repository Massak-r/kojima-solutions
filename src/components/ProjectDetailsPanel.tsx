import { ProjectData, STATUS_LABELS, KIND_LABELS, KIND_ORDER } from "@/types/project";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, Plus, Building2, Check, Pencil, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useClients } from "@/contexts/ClientsContext";
import type { Client } from "@/types/client";

interface ProjectDetailsPanelProps {
  project: ProjectData;
  onChange: (updates: Partial<ProjectData>) => void;
}

export function ProjectDetailsPanel({ project, onChange }: ProjectDetailsPanelProps) {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    notes: false,
  });

  function toggle(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
        Détails du projet
      </h3>

      {/* Basic Info */}
      <SectionHeader
        label="Général"
        expanded={expandedSections.basic}
        onToggle={() => toggle("basic")}
      />
      {expandedSections.basic && (
        <div className="flex flex-col gap-3">
          <KindSelector kind={project.kind ?? "client"} onChange={onChange} />
          {(project.kind ?? "client") === "client" && (
            <ClientSelector project={project} onChange={onChange} />
          )}
          <Field label="Description du projet">
            <Textarea
              placeholder="Brève description du projet..."
              value={project.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              className="text-sm resize-none"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Date de début">
              <Input
                type="date"
                value={project.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="text-sm"
              />
            </Field>
            <Field label="Date de fin">
              <Input
                type="date"
                value={project.endDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className="text-sm"
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              value={project.status}
              onChange={(e) => onChange({ status: e.target.value as ProjectData["status"] })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <Separator />

      {/* Notes */}
      <SectionHeader
        label="Notes"
        expanded={expandedSections.notes}
        onToggle={() => toggle("notes")}
      />
      {expandedSections.notes && (
        <div className="flex flex-col gap-3">
          <Field label="Notes">
            <Textarea
              placeholder="Notes, liens ou références supplémentaires..."
              value={project.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={4}
              className="text-sm resize-none"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ── Client Selector ──────────────────────────────────────────────────────────────────────────────

function ClientSelector({ project, onChange }: { project: ProjectData; onChange: (updates: Partial<ProjectData>) => void }) {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formOrg, setFormOrg] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find((c) => c.id === project.clientId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        resetForm();
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function resetForm() {
    setShowNewForm(false);
    setEditingId(null);
    setFormName(""); setFormOrg(""); setFormEmail("");
    setFormPhone(""); setFormAddress(""); setFormNotes("");
    setConfirmDeleteId(null);
  }

  function selectClient(client: Client) {
    onChange({ clientId: client.id, client: client.name });
    setOpen(false);
    resetForm();
  }

  function clearClient() {
    onChange({ clientId: undefined, client: "" });
  }

  function startEdit(e: React.MouseEvent, client: Client) {
    e.stopPropagation();
    setEditingId(client.id);
    setShowNewForm(false);
    setFormName(client.name);
    setFormOrg(client.organization ?? "");
    setFormEmail(client.email ?? "");
    setFormPhone(client.phone ?? "");
    setFormAddress(client.address ?? "");
    setFormNotes(client.notes ?? "");
  }

  function handleSaveEdit() {
    if (!editingId || !formName.trim()) return;
    const payload = {
      name: formName.trim(),
      organization: formOrg.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      address: formAddress.trim() || undefined,
      notes: formNotes.trim() || undefined,
    };
    updateClient(editingId, payload);
    // Update project if editing the currently selected client
    if (editingId === project.clientId) {
      onChange({ client: payload.name });
    }
    resetForm();
  }

  function handleDelete(e: React.MouseEvent, clientId: string) {
    e.stopPropagation();
    if (confirmDeleteId === clientId) {
      deleteClient(clientId);
      if (clientId === project.clientId) {
        onChange({ clientId: undefined, client: "" });
      }
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(clientId);
    }
  }

  function handleCreateAndSelect() {
    if (!formName.trim()) return;
    const created = addClient({
      name: formName.trim(),
      organization: formOrg.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      address: formAddress.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });
    selectClient(created);
  }

  const isFormOpen = showNewForm || editingId !== null;

  return (
    <Field label="Client">
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={selectedClient ? "text-foreground" : "text-muted-foreground"}>
            {selectedClient
              ? `${selectedClient.name}${selectedClient.organization ? ` - ${selectedClient.organization}` : ""}`
              : "Sélectionner ou créer un client…"}
          </span>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </button>

        {selectedClient && (
          <button
            type="button"
            onClick={clearClient}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            title="Clear client"
          >
            ×
          </button>
        )}

        {open && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="max-h-52 overflow-y-auto">
              {clients.length === 0 && !isFormOpen && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aucun client pour l'instant.</p>
              )}
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1 px-3 py-2 hover:bg-secondary/50 transition-colors group"
                >
                  <button
                    type="button"
                    onClick={() => selectClient(c)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm"
                  >
                    <Building2 size={13} className="text-muted-foreground shrink-0" />
                    <span className="truncate">
                      <span className="font-medium">{c.name}</span>
                      {c.organization && <span className="text-muted-foreground"> - {c.organization}</span>}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {project.clientId === c.id && <Check size={13} className="text-primary" />}
                    <button
                      type="button"
                      onClick={(e) => startEdit(e, c)}
                      className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all"
                      title="Modifier"
                    >
                      <Pencil size={11} />
                    </button>
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, c.id)}
                          className="text-[10px] text-destructive-foreground bg-destructive px-1.5 py-0.5 rounded"
                        >
                          Suppr.
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, c.id)}
                        className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isFormOpen ? (
              <button
                type="button"
                onClick={() => { resetForm(); setShowNewForm(true); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 border-t border-border transition-colors"
              >
                <Plus size={13} /> Créer un nouveau client…
              </button>
            ) : (
              <div className="p-3 border-t border-border space-y-2">
                <p className="text-xs font-medium text-foreground">
                  {editingId ? "Modifier le client" : "Ajout rapide client"}
                </p>
                <Input
                  placeholder="Nom *"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') editingId ? handleSaveEdit() : handleCreateAndSelect();
                    if (e.key === 'Escape') resetForm();
                  }}
                />
                <Input
                  placeholder="Organisation"
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Téléphone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Adresse"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="h-8 text-xs"
                />
                <Textarea
                  placeholder="Notes internes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="text-xs resize-none min-h-[3rem]"
                  rows={2}
                />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Annuler</button>
                  <button
                    type="button"
                    disabled={!formName.trim()}
                    onClick={editingId ? handleSaveEdit : handleCreateAndSelect}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md disabled:opacity-50"
                  >
                    {editingId ? "Enregistrer" : "Ajouter"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

// ── Kind Selector ──────────────────────────────────────────────────────────────────────────────

function KindSelector({ kind, onChange }: { kind: ProjectData["kind"]; onChange: (updates: Partial<ProjectData>) => void }) {
  return (
    <Field label="Catégorie">
      <div className="inline-flex rounded-md border border-input bg-background p-0.5 gap-0.5">
        {KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange({ kind: k })}
            className={`flex-1 px-3 py-1.5 text-xs font-body font-medium rounded transition-colors ${
              kind === k
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>
    </Field>
  );
}

function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full text-left group"
    >
      <span className="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
        {label}
      </span>
      {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-body text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
