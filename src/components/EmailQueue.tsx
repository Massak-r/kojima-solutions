import { useState, useEffect } from "react";
import { Mail, Send, Trash2, Eye, EyeOff, RefreshCw, ChevronDown, CheckCircle2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  listQueuedEmails,
  sendQueuedEmail,
  discardQueuedEmail,
  updateQueuedEmail,
  type QueuedEmail,
} from "@/api/emailQueue";

const SOURCE_LABELS: Record<string, string> = {
  feedback: "Feedback",
  gate: "Gate",
  intake: "Intake",
  contact: "Contact",
  "stakeholder-invite": "Invitation",
  "invoice-reminder": "Rappel facture",
  manual: "Manuel",
  system: "Système",
};

export function EmailQueue() {
  const { toast } = useToast();
  const [emails, setEmails] = useState<QueuedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listQueuedEmails("pending");
      setEmails(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleSend(id: string) {
    setSendingId(id);
    try {
      await sendQueuedEmail(id);
      toast({ title: "Email envoyé" });
      setEmails((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast({ title: "Erreur d'envoi", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  }

  async function handleDiscard(id: string) {
    try {
      await discardQueuedEmail(id);
      setEmails((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Email supprimé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  function startEdit(email: QueuedEmail) {
    setEditingId(email.id);
    setEditSubject(email.subject);
    setEditBody(email.body);
  }

  async function saveEdit(id: string) {
    try {
      const updated = await updateQueuedEmail(id, { subject: editSubject, body: editBody });
      setEmails((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingId(null);
      toast({ title: "Email modifié" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            File d'emails
          </h2>
        </div>
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            File d'emails
          </h2>
          {emails.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">
              {emails.length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="h-7 w-7 p-0">
          <RefreshCw size={12} />
        </Button>
      </div>

      {emails.length === 0 ? (
        <div className="p-6 text-center">
          <CheckCircle2 size={24} className="text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs font-body text-muted-foreground/50">Aucun email en attente</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {emails.map((email) => {
            const isExpanded = expandedId === email.id;
            const isEditing = editingId === email.id;
            return (
              <div key={email.id} className="px-5 py-3">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono border-primary/30 text-primary">
                        {SOURCE_LABELS[email.source] || email.source}
                      </Badge>
                      <span className="text-xs font-body text-muted-foreground/60 truncate">
                        → {email.recipient_email}
                      </span>
                    </div>
                    <p className="text-sm font-body font-medium text-foreground/80 truncate">
                      {email.subject}
                    </p>
                  </div>
                  <span className="text-[10px] font-body text-muted-foreground/40 shrink-0">
                    {new Date(email.created_at).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <ChevronDown size={12} className={cn("text-muted-foreground/40 transition-transform shrink-0", isExpanded && "rotate-180")} />
                </button>

                {/* Expanded preview */}
                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {isEditing ? (
                      <>
                        <div>
                          <label className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">Objet</label>
                          <input
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            className="w-full mt-1 text-xs font-body bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">Corps</label>
                          <textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={8}
                            className="w-full mt-1 text-xs font-mono bg-secondary border border-border rounded-md px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => saveEdit(email.id)}>
                            Sauvegarder
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingId(null)}>
                            Annuler
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                          <div className="flex items-center gap-2 mb-2 text-[10px] font-body text-muted-foreground/60">
                            <span>À : <strong className="text-foreground/70">{email.recipient_name || email.recipient_email}</strong></span>
                            {email.recipient_name && (
                              <span>&lt;{email.recipient_email}&gt;</span>
                            )}
                          </div>
                          <div className="text-[10px] font-body text-muted-foreground/60 mb-2">
                            Objet : <strong className="text-foreground/70">{email.subject}</strong>
                          </div>
                          <div className="border-t border-border/30 pt-2 mt-2">
                            <pre className="text-xs font-body text-foreground/70 whitespace-pre-wrap leading-relaxed">
                              {email.body}
                            </pre>
                            {email.cta_url && (
                              <p className="mt-2 text-xs text-primary">
                                → {email.cta_url}
                              </p>
                            )}
                          </div>
                          <div className="border-t border-border/30 pt-2 mt-2 text-[10px] font-body text-muted-foreground/40">
                            ---<br />
                            Kojima Solutions · kojima-solutions.ch<br />
                            massaki@kojima-solutions.ch
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleSend(email.id)}
                            disabled={sendingId === email.id}
                          >
                            <Send size={10} />
                            {sendingId === email.id ? "Envoi..." : "Envoyer"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => startEdit(email)}
                          >
                            <Pencil size={10} /> Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                            onClick={() => handleDiscard(email.id)}
                          >
                            <Trash2 size={10} /> Supprimer
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
