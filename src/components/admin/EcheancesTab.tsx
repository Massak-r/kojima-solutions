import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp, Loader2,
  Clock, CheckCircle2, AlertTriangle, CalendarCheck, RefreshCw, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import {
  listDeadlines, createDeadline, updateDeadline, deleteDeadline,
} from "@/api/adminDeadlines";
import type { AdminDeadlineItem } from "@/api/adminDeadlines";
import {
  type DeadlineRecurrence,
  RECURRENCE_LABELS, REMIND_OPTIONS, DEADLINE_CATEGORIES,
  getDaysUntilDue, deadlineBadgeClass, daysLabel, advanceDueDate,
} from "@/types/adminDeadline";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CH", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function EcheancesTab() {
  const [deadlines, setDeadlines] = useState<AdminDeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDue, setFormDue] = useState(todayStr());
  const [formCategory, setFormCategory] = useState("Général");
  const [formDescription, setFormDescription] = useState("");
  const [formRemindDays, setFormRemindDays] = useState(7);
  const [formRecurring, setFormRecurring] = useState<DeadlineRecurrence | "">("");

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    title: "", dueDate: "", category: "Général", description: "",
    remindDays: 7, recurring: "" as DeadlineRecurrence | "",
  });

  // Show completed
  const [showCompleted, setShowCompleted] = useState(false);

  const { toast } = useToast();
  const errToast = useCallback(() => toast({ title: "Erreur", description: "L'opération a échoué", variant: "destructive" }), [toast]);

  useEffect(() => {
    listDeadlines()
      .then(setDeadlines)
      .catch(errToast)
      .finally(() => setLoading(false));
  }, [errToast]);

  // ── Derived ──

  const activeDeadlines = useMemo(() =>
    deadlines.filter(d => !d.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [deadlines]
  );

  const completedDeadlines = useMemo(() =>
    deadlines.filter(d => d.completed).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [deadlines]
  );

  const overdueCount = useMemo(() =>
    activeDeadlines.filter(d => getDaysUntilDue(d) < 0).length,
    [activeDeadlines]
  );

  const upcomingCount = useMemo(() =>
    activeDeadlines.filter(d => { const days = getDaysUntilDue(d); return days >= 0 && days <= 30; }).length,
    [activeDeadlines]
  );

  // ── Actions ──

  async function handleAdd() {
    if (!formTitle.trim() || !formDue) return;
    setSaving(true);
    try {
      const created = await createDeadline({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        dueDate: formDue,
        category: formCategory,
        recurring: formRecurring || null,
        remindDays: formRemindDays,
        completed: false,
      });
      setDeadlines(prev => [...prev, created]);
      setFormTitle(""); setFormDue(todayStr()); setFormCategory("Général");
      setFormDescription(""); setFormRemindDays(7); setFormRecurring("");
      setShowForm(false);
      toast({ title: "Échéance ajoutée" });
    } catch { errToast(); }
    setSaving(false);
  }

  async function handleComplete(dl: AdminDeadlineItem) {
    try {
      if (dl.recurring) {
        // Advance to next cycle
        const newDue = advanceDueDate(dl.dueDate, dl.recurring);
        const updated = await updateDeadline(dl.id, {
          dueDate: newDue,
          notified: false,
        });
        setDeadlines(prev => prev.map(d => d.id === dl.id ? updated : d));
        toast({ title: "Prochaine échéance", description: `Avancée au ${formatDate(newDue)}` });
      } else {
        const updated = await updateDeadline(dl.id, { completed: true });
        setDeadlines(prev => prev.map(d => d.id === dl.id ? updated : d));
        toast({ title: "Échéance terminée" });
      }
    } catch { errToast(); }
  }

  async function handleUncomplete(dl: AdminDeadlineItem) {
    try {
      const updated = await updateDeadline(dl.id, { completed: false });
      setDeadlines(prev => prev.map(d => d.id === dl.id ? updated : d));
    } catch { errToast(); }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDeadline(id);
      setDeadlines(prev => prev.filter(d => d.id !== id));
      setDeleteId(null);
      toast({ title: "Supprimée" });
    } catch { errToast(); }
  }

  async function handleSaveEdit() {
    if (!editId || !editData.title.trim()) return;
    setSaving(true);
    try {
      const updated = await updateDeadline(editId, {
        title: editData.title.trim(),
        description: editData.description.trim() || null,
        dueDate: editData.dueDate,
        category: editData.category,
        recurring: editData.recurring || null,
        remindDays: editData.remindDays,
      });
      setDeadlines(prev => prev.map(d => d.id === editId ? updated : d));
      setEditId(null);
      toast({ title: "Mise à jour" });
    } catch { errToast(); }
    setSaving(false);
  }

  async function handleRemindChange(dl: AdminDeadlineItem, days: number) {
    try {
      const updated = await updateDeadline(dl.id, { remindDays: days, notified: false });
      setDeadlines(prev => prev.map(d => d.id === dl.id ? updated : d));
    } catch { errToast(); }
  }

  function startEdit(dl: AdminDeadlineItem) {
    setEditId(dl.id);
    setEditData({
      title: dl.title,
      dueDate: dl.dueDate,
      category: dl.category,
      description: dl.description ?? "",
      remindDays: dl.remindDays,
      recurring: dl.recurring ?? "",
    });
  }

  // ── Render ──

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-2xl font-display font-bold">{activeDeadlines.length}</div>
          <div className="text-xs font-body text-muted-foreground mt-1">Actives</div>
        </div>
        {overdueCount > 0 && (
          <div className="glass-card rounded-xl p-4 text-center border-red-200">
            <div className="text-2xl font-display font-bold text-destructive">{overdueCount}</div>
            <div className="text-xs font-body text-destructive/70 mt-1 flex items-center justify-center gap-1">
              <AlertTriangle size={12} /> En retard
            </div>
          </div>
        )}
        {upcomingCount > 0 && (
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-display font-bold text-amber-600">{upcomingCount}</div>
            <div className="text-xs font-body text-muted-foreground mt-1">Ce mois</div>
          </div>
        )}
      </div>

      {/* ── Active deadlines ── */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {activeDeadlines.map(dl => {
            const days = getDaysUntilDue(dl);
            const isEditing = editId === dl.id;
            const isDeleting = deleteId === dl.id;

            return (
              <motion.div
                key={dl.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card rounded-xl overflow-hidden"
              >
                {isEditing ? (
                  /* ── Edit mode ── */
                  <div className="p-4 space-y-3">
                    <Input
                      value={editData.title}
                      onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Titre"
                      className="font-body"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="date"
                        value={editData.dueDate}
                        onChange={e => setEditData(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="font-body"
                      />
                      <Select value={editData.category} onValueChange={v => setEditData(prev => ({ ...prev, category: v }))}>
                        <SelectTrigger className="font-body text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEADLINE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-body text-xs">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={editData.description}
                      onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description (optionnel)"
                      className="font-body text-sm min-h-[60px]"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={String(editData.remindDays)} onValueChange={v => setEditData(prev => ({ ...prev, remindDays: Number(v) }))}>
                        <SelectTrigger className="font-body text-xs"><SelectValue placeholder="Rappel" /></SelectTrigger>
                        <SelectContent>
                          {REMIND_OPTIONS.map(o => <SelectItem key={o.value} value={String(o.value)} className="font-body text-xs">{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={editData.recurring || "none"} onValueChange={v => setEditData(prev => ({ ...prev, recurring: v === "none" ? "" : v as DeadlineRecurrence }))}>
                        <SelectTrigger className="font-body text-xs"><SelectValue placeholder="Récurrence" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="font-body text-xs">Aucune</SelectItem>
                          {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="font-body text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Annuler</Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving}>Enregistrer</Button>
                    </div>
                  </div>
                ) : (
                  /* ── Display mode ── */
                  <div className="p-4 group">
                    <div className="flex items-start gap-3">
                      {/* Complete button */}
                      <button
                        onClick={() => handleComplete(dl)}
                        className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                        title={dl.recurring ? "Avancer au prochain cycle" : "Marquer terminée"}
                      >
                        {dl.recurring ? (
                          <RefreshCw size={18} className="text-primary hover:text-primary/80" />
                        ) : (
                          <CheckCircle2 size={18} className="text-muted-foreground/40 hover:text-emerald-500" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-body font-medium text-sm">{dl.title}</span>
                          <Badge variant="outline" className={cn("text-[10px] font-body border", deadlineBadgeClass(days))}>
                            {daysLabel(days)}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-body">{dl.category}</Badge>
                          {dl.recurring && (
                            <Badge variant="outline" className="text-[10px] font-body border-primary/30 text-primary bg-primary/5">
                              {RECURRENCE_LABELS[dl.recurring]}
                            </Badge>
                          )}
                        </div>

                        {dl.description && (
                          <p className="text-xs font-body text-muted-foreground mt-1 line-clamp-2">{dl.description}</p>
                        )}

                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground font-body">
                          <span className="flex items-center gap-1">
                            <CalendarCheck size={11} /> {formatDate(dl.dueDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> Rappel {dl.remindDays}j avant
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {/* Remind days quick change */}
                        <Select
                          value={String(dl.remindDays)}
                          onValueChange={v => handleRemindChange(dl, Number(v))}
                        >
                          <SelectTrigger className="h-7 w-[110px] text-[10px] font-body border-none bg-transparent hover:bg-muted/50">
                            <Clock size={11} className="mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REMIND_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={String(o.value)} className="font-body text-xs">{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(dl)}>
                          <Pencil size={13} />
                        </Button>

                        {isDeleting ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleDelete(dl.id)}>
                              Supprimer
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setDeleteId(null)}>
                              <X size={13} />
                            </Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => setDeleteId(dl.id)}>
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {activeDeadlines.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground font-body text-sm">
            Aucune échéance active
          </div>
        )}
      </div>

      {/* ── Add form ── */}
      <div className="glass-card rounded-xl overflow-hidden">
        <button
          onClick={() => setShowForm(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <span className="font-display text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Plus size={14} className="text-primary" /> Nouvelle échéance
          </span>
          {showForm ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                <Input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Titre de l'échéance"
                  className="font-body"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    value={formDue}
                    onChange={e => setFormDue(e.target.value)}
                    className="font-body"
                  />
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger className="font-body text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEADLINE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-body text-xs">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Description (optionnel)"
                  className="font-body text-sm min-h-[60px]"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={String(formRemindDays)} onValueChange={v => setFormRemindDays(Number(v))}>
                    <SelectTrigger className="font-body text-xs"><SelectValue placeholder="Rappel" /></SelectTrigger>
                    <SelectContent>
                      {REMIND_OPTIONS.map(o => <SelectItem key={o.value} value={String(o.value)} className="font-body text-xs">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formRecurring || "none"} onValueChange={v => setFormRecurring(v === "none" ? "" : v as DeadlineRecurrence)}>
                    <SelectTrigger className="font-body text-xs"><SelectValue placeholder="Récurrence" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-body text-xs">Aucune</SelectItem>
                      {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="font-body text-xs">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleAdd} disabled={saving || !formTitle.trim()}>
                    {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                    Ajouter
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Completed deadlines ── */}
      {completedDeadlines.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(o => !o)}
            className="flex items-center gap-2 text-xs font-body text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>{completedDeadlines.length} terminée{completedDeadlines.length > 1 ? "s" : ""}</span>
            {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-1.5"
              >
                {completedDeadlines.map(dl => (
                  <div
                    key={dl.id}
                    className="glass-card rounded-xl p-3 flex items-center gap-3 opacity-60 group"
                  >
                    <button onClick={() => handleUncomplete(dl)} className="shrink-0">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="font-body text-sm line-through">{dl.title}</span>
                      <div className="text-[11px] text-muted-foreground font-body mt-0.5">
                        <Badge variant="secondary" className="text-[10px] font-body mr-2">{dl.category}</Badge>
                        {dl.completedAt && `Terminée le ${formatDate(dl.completedAt.slice(0, 10))}`}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {deleteId === dl.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => handleDelete(dl.id)}>
                            Supprimer
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setDeleteId(null)}>
                            <X size={13} />
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/50 hover:text-destructive" onClick={() => setDeleteId(dl.id)}>
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
