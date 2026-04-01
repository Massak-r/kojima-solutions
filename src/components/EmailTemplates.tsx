import { useState, useEffect } from "react";
import { FileText, Pencil, RotateCcw, Save, X, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  listEmailTemplates,
  updateEmailTemplate,
  resetEmailTemplate,
  type EmailTemplate,
} from "@/api/emailTemplates";

export function EmailTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await listEmailTemplates();
      setTemplates(data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  function startEdit(t: EmailTemplate) {
    setEditingId(t.id);
    setEditSubject(t.subject);
    setEditBody(t.body);
    setExpandedId(t.id);
  }

  async function saveEdit(id: string) {
    try {
      await updateEmailTemplate(id, { subject: editSubject, body: editBody });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, subject: editSubject, body: editBody, customized: true } : t));
      setEditingId(null);
      toast({ title: "Template sauvegardé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleReset(id: string) {
    try {
      await resetEmailTemplate(id);
      await refresh();
      setEditingId(null);
      toast({ title: "Template réinitialisé" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Email Templates
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
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <FileText size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Email Templates
        </h2>
        <span className="text-[10px] font-body text-muted-foreground/40 ml-auto">
          Variables : {"{project_title}"}, {"{client_name}"}, {"{message}"}, etc.
        </span>
      </div>

      <div className="divide-y divide-border/30">
        {templates.map(t => {
          const isExpanded = expandedId === t.id;
          const isEditing = editingId === t.id;

          return (
            <div key={t.id} className="px-5 py-3">
              <button
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                className="w-full flex items-center gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-body font-medium text-foreground">{t.label}</span>
                    {t.customized && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
                        Modifié
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-body text-muted-foreground/60">{t.description}</p>
                </div>
                <ChevronDown size={12} className={cn("text-muted-foreground/40 transition-transform shrink-0", isExpanded && "rotate-180")} />
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">Objet</label>
                        <input
                          value={editSubject}
                          onChange={e => setEditSubject(e.target.value)}
                          className="w-full mt-1 text-xs font-body bg-secondary border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-body text-muted-foreground/60 uppercase tracking-wider">Corps</label>
                        <textarea
                          value={editBody}
                          onChange={e => setEditBody(e.target.value)}
                          rows={8}
                          className="w-full mt-1 text-xs font-mono bg-secondary border border-border rounded-md px-2.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => saveEdit(t.id)}>
                          <Save size={10} /> Sauvegarder
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingId(null)}>
                          Annuler
                        </Button>
                        {t.customized && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600" onClick={() => handleReset(t.id)}>
                            <RotateCcw size={10} /> Réinitialiser
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                        <div className="text-[10px] font-body text-muted-foreground/60 mb-1">
                          Objet : <strong className="text-foreground/70">{t.subject}</strong>
                        </div>
                        <div className="border-t border-border/30 pt-2 mt-2">
                          <pre className="text-xs font-body text-foreground/70 whitespace-pre-wrap leading-relaxed">
                            {t.body}
                          </pre>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => startEdit(t)}>
                        <Pencil size={10} /> Modifier
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
