import { useEffect, useState } from "react";
import {
  listProjectStakeholders,
  addProjectStakeholder,
  deleteProjectStakeholder,
  inviteStakeholder,
} from "@/api/projectStakeholders";
import type { ProjectStakeholder } from "@/types/project";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Send, Loader2, X, Check, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = ["Décideur", "Technique", "Design", "Autre"] as const;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}j`;
}

interface Props {
  projectId: string;
}

export function StakeholderManager({ projectId }: Props) {
  const { toast } = useToast();
  const [stakeholders, setStakeholders] = useState<ProjectStakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [adding, setAdding] = useState(false);

  // Invite state
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    listProjectStakeholders(projectId)
      .then(setStakeholders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    setAdding(true);
    try {
      const created = await addProjectStakeholder({
        projectId,
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole || undefined,
      });
      setStakeholders((prev) => [...prev, created]);
      setNewName(""); setNewEmail(""); setNewRole("");
      setShowAdd(false);
      toast({ title: "Stakeholder ajouté" });
    } catch {
      toast({ title: "Erreur", description: "Ce stakeholder existe peut-être déjà.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProjectStakeholder(id);
      setStakeholders((prev) => prev.filter((s) => s.id !== id));
      setConfirmDelete(null);
      toast({ title: "Stakeholder supprimé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleInvite(sh: ProjectStakeholder) {
    setInviting(sh.id);
    try {
      await inviteStakeholder(sh.id, projectId);
      setInvited((prev) => new Set(prev).add(sh.id));
      toast({ title: `Invitation envoyée à ${sh.name}` });
    } catch {
      toast({ title: "Erreur d'envoi", variant: "destructive" });
    } finally {
      setInviting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Parties prenantes
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          {showAdd ? <X size={12} /> : <Plus size={12} />}
          {showAdd ? "Annuler" : "Ajouter"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 border-b border-border space-y-3 bg-secondary/20">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nom"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs h-8"
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="text-xs h-8"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="">Rôle (optionnel)</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button type="submit" size="sm" className="h-8 text-xs gap-1" disabled={adding}>
              {adding ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              Ajouter
            </Button>
          </div>
        </form>
      )}

      {/* Stakeholder list */}
      {stakeholders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Aucun stakeholder pour ce projet
        </p>
      ) : (
        <div className="divide-y divide-border">
          {stakeholders.map((sh) => (
            <div key={sh.id} className="flex items-center gap-3 px-4 py-2.5 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{sh.name}</span>
                  {sh.role && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      {sh.role}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{sh.email || "Via lien de partage"}</span>
                  <span className="shrink-0">
                    · {sh.lastAccessedAt ? `Vu il y a ${timeAgo(sh.lastAccessedAt)}` : "Jamais connecté"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Invite button */}
                <button
                  onClick={() => handleInvite(sh)}
                  disabled={inviting === sh.id || invited.has(sh.id)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    invited.has(sh.id)
                      ? "text-emerald-500"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5",
                  )}
                  title={invited.has(sh.id) ? "Invitation envoyée" : "Envoyer une invitation"}
                >
                  {inviting === sh.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : invited.has(sh.id) ? (
                    <Check size={13} />
                  ) : (
                    <Send size={13} />
                  )}
                </button>
                {/* Delete */}
                {confirmDelete === sh.id ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleDelete(sh.id)}
                      className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      title="Confirmer"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                      title="Annuler"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(sh.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors md:opacity-0 md:group-hover:opacity-100"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
