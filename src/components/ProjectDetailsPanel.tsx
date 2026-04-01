import { ProjectData, STATUS_LABELS } from "@/types/project";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, Plus, Building2, Check } from "lucide-react";
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
        Project Details
      </h3>

      {/* Basic Info */}
      <SectionHeader
        label="General"
        expanded={expandedSections.basic}
        onToggle={() => toggle("basic")}
      />
      {expandedSections.basic && (
        <div className="flex flex-col gap-3">
          <ClientSelector project={project} onChange={onChange} />
          <Field label="Project Description">
            <Textarea
              placeholder="Brief project description..."
              value={project.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              className="text-sm resize-none"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Start Date">
              <Input
                type="date"
                value={project.startDate}
                onChange={(e) => onChange({ startDate: e.target.value })}
                className="text-sm"
              />
            </Field>
            <Field label="End Date">
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
              placeholder="Additional project notes, links, or references..."
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
  const { clients, addClient } = useClients();
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedClient = clients.find((c) => c.id === project.clientId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNewForm(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectClient(client: Client) {
    onChange({ clientId: client.id, client: client.name });
    setOpen(false);
  }

  function clearClient() {
    onChange({ clientId: undefined, client: "" });
  }

  function handleCreateAndSelect() {
    if (!newName.trim()) return;
    const created = addClient({
      name: newName.trim(),
      organization: newOrg.trim() || undefined,
      email: newEmail.trim() || undefined,
    });
    selectClient(created);
    setNewName(""); setNewOrg(""); setNewEmail("");
    setShowNewForm(false);
  }

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
              : "Select or create a client…"}
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
              {clients.length === 0 && !showNewForm && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No clients yet.</p>
              )}
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectClient(c)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Building2 size={13} className="text-muted-foreground shrink-0" />
                    <span>
                      <span className="font-medium">{c.name}</span>
                      {c.organization && <span className="text-muted-foreground"> - {c.organization}</span>}
                    </span>
                  </span>
                  {project.clientId === c.id && <Check size={13} className="text-primary shrink-0" />}
                </button>
              ))}
            </div>

            {!showNewForm ? (
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 border-t border-border transition-colors"
              >
                <Plus size={13} /> Create new client…
              </button>
            ) : (
              <div className="p-3 border-t border-border space-y-2">
                <p className="text-xs font-medium text-foreground">Quick add client</p>
                <Input
                  placeholder="Name *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndSelect(); if (e.key === 'Escape') setShowNewForm(false); }}
                />
                <Input
                  placeholder="Organization"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-1.5 justify-end">
                  <button type="button" onClick={() => setShowNewForm(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
                  <button
                    type="button"
                    disabled={!newName.trim()}
                    onClick={handleCreateAndSelect}
                    className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md disabled:opacity-50"
                  >
                    Add & Select
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
