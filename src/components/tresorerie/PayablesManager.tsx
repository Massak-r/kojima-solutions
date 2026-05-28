import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Check, RotateCcw, Loader2, CalendarClock,
  AlertCircle, Repeat,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listPayables, createPayable, updatePayable, deletePayable,
} from "@/api/payables";
import { listAccounts } from "@/api/accounts";
import {
  type Payable, type PayableStatus, type PayableRecurrence,
  PAYABLE_STATUS_LABELS, PAYABLE_RECURRENCE_LABELS,
} from "@/types/payable";
import type { Account } from "@/types/account";

function formatCHF(n: number, currency = "CHF") {
  try {
    return new Intl.NumberFormat("fr-CH", {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const target = new Date(date + "T00:00:00").getTime();
  const today  = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((target - today) / 86_400_000);
}

function dueLabel(date?: string | null): { text: string; tone: "ok" | "warn" | "danger" | "muted" } {
  const d = daysUntil(date);
  if (d === null) return { text: "Sans date", tone: "muted" };
  if (d < 0)   return { text: `En retard de ${-d} j`, tone: "danger" };
  if (d === 0) return { text: "Aujourd'hui", tone: "danger" };
  if (d <= 7)  return { text: `Dans ${d} j`, tone: "warn" };
  if (d <= 30) return { text: `Dans ${d} j`, tone: "ok" };
  return { text: new Date(date! + "T00:00:00").toLocaleDateString("fr-CH", { day: "2-digit", month: "short" }), tone: "muted" };
}

interface FormState {
  label: string;
  amount: string;
  currency: string;
  dueDate: string;
  accountId: string;
  status: PayableStatus;
  category: string;
  notes: string;
  recurrence: PayableRecurrence;
  recurrenceDay: string;
  recurrenceEnd: string;
}

const EMPTY_FORM: FormState = {
  label: "", amount: "", currency: "CHF", dueDate: "", accountId: "",
  status: "pending", category: "", notes: "",
  recurrence: "none", recurrenceDay: "", recurrenceEnd: "",
};

export function PayablesManager() {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "scheduled" | "paid" | "all">("pending");
  const [editing, setEditing] = useState<Payable | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const errToast = (msg = "L'opération a échoué") =>
    toast({ title: "Erreur", description: msg, variant: "destructive" });

  const reload = () =>
    Promise.all([listPayables(), listAccounts()])
      .then(([p, a]) => { setPayables(p); setAccounts(a); })
      .catch(() => errToast())
      .finally(() => setLoading(false));

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    if (tab === "all") return payables;
    return payables.filter(p => p.status === tab);
  }, [payables, tab]);

  const totalDue30 = useMemo(() => {
    return payables
      .filter(p => (p.status === "pending" || p.status === "scheduled") && p.dueDate)
      .filter(p => { const d = daysUntil(p.dueDate); return d !== null && d <= 30; })
      .reduce((s, p) => s + p.amount, 0);
  }, [payables]);

  const overdueCount = useMemo(() => {
    return payables.filter(p => p.status === "pending" && p.dueDate && (daysUntil(p.dueDate) ?? 1) < 0).length;
  }, [payables]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(p: Payable) {
    setEditing(p);
    setForm({
      label: p.label,
      amount: p.amount.toString(),
      currency: p.currency,
      dueDate: p.dueDate ?? "",
      accountId: p.accountId ?? "",
      status: p.status,
      category: p.category ?? "",
      notes: p.notes ?? "",
      recurrence: p.recurrence,
      recurrenceDay: p.recurrenceDay?.toString() ?? "",
      recurrenceEnd: p.recurrenceEnd ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim()) { errToast("Libellé requis"); return; }
    const amount = parseFloat(form.amount.replace(",", "."));
    if (!isFinite(amount)) { errToast("Montant invalide"); return; }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      amount,
      currency: form.currency.trim() || "CHF",
      dueDate: form.dueDate || null,
      accountId: form.accountId || null,
      status: form.status,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
      recurrence: form.recurrence,
      recurrenceDay: form.recurrenceDay ? parseInt(form.recurrenceDay, 10) : null,
      recurrenceEnd: form.recurrenceEnd || null,
    };
    try {
      if (editing) {
        const updated = await updatePayable(editing.id, payload);
        if ((updated as Payable & { spawned?: Payable }).spawned) {
          toast({ title: "Prochaine échéance créée", description: "Une nouvelle entrée a été générée pour la prochaine occurrence." });
        } else {
          toast({ title: "Payable mis à jour" });
        }
      } else {
        await createPayable(payload);
        toast({ title: "Payable créé" });
      }
      setDialogOpen(false);
      await reload();
    } catch { errToast(); }
    finally { setSaving(false); }
  }

  async function markPaid(p: Payable) {
    try {
      const res = await updatePayable(p.id, { status: "paid" });
      if (res.spawned) {
        toast({ title: "Marqué payé", description: "Prochaine échéance générée automatiquement." });
      } else {
        toast({ title: "Marqué payé" });
      }
      await reload();
    } catch { errToast(); }
  }

  async function markUnpaid(p: Payable) {
    try {
      await updatePayable(p.id, { status: "pending" });
      toast({ title: "Remis à payer" });
      await reload();
    } catch { errToast(); }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deletePayable(deletingId);
      toast({ title: "Supprimé" });
      setDeletingId(null);
      await reload();
    } catch { errToast(); }
  }

  const toneClass = {
    ok:     "text-emerald-700 dark:text-emerald-400",
    warn:   "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
    muted:  "text-muted-foreground",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> À payer
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tes obligations financières à venir.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> Payable
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4 bg-muted/30">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Dans 30 jours</div>
          <div className="font-display text-2xl font-semibold tabular-nums mt-1">{formatCHF(totalDue30)}</div>
        </div>
        <div className="rounded-xl border p-4 bg-muted/30">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> En retard
          </div>
          <div className={`font-display text-2xl font-semibold tabular-nums mt-1 ${overdueCount > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{overdueCount}</div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending">À payer</TabsTrigger>
          <TabsTrigger value="scheduled">Programmés</TabsTrigger>
          <TabsTrigger value="paid">Payés</TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground italic border rounded-lg px-4 py-10 text-center">
              Aucun payable {tab !== "all" ? `«${PAYABLE_STATUS_LABELS[tab]}»` : ""}.
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map(p => {
                const due = dueLabel(p.dueDate);
                const account = p.accountId ? accountById.get(p.accountId) : null;
                return (
                  <li key={p.id} className="group border rounded-lg p-3 transition hover:border-primary/40">
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => openEdit(p)} className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{p.label}</span>
                          {p.recurrence !== "none" && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Repeat className="h-3 w-3" /> {PAYABLE_RECURRENCE_LABELS[p.recurrence]}
                            </Badge>
                          )}
                          {p.category && <Badge variant="secondary" className="text-xs">{p.category}</Badge>}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-3 flex-wrap">
                          <span className={toneClass[due.tone]}>{due.text}</span>
                          {account && <span className="text-muted-foreground">· {account.name}</span>}
                        </div>
                        {p.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.notes}</div>}
                      </button>
                      <div className="text-right shrink-0">
                        <div className="font-display text-lg font-semibold tabular-nums">
                          {formatCHF(p.amount, p.currency)}
                        </div>
                        <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition justify-end">
                          {p.status === "paid" ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Remettre à payer" onClick={() => markUnpaid(p)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700 dark:text-emerald-400" title="Marquer payé" onClick={() => markPaid(p)}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Éditer" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Supprimer" onClick={() => setDeletingId(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editing ? "Modifier le payable" : "Nouveau payable"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground">Libellé</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="ex. Loyer juin, SIG, paiement mykistudio…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Montant</label>
                <Input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Devise</label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={4} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Échéance</label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Statut</label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as PayableStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYABLE_STATUS_LABELS) as PayableStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{PAYABLE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Compte source</label>
              <Select value={form.accountId || "__none__"} onValueChange={v => setForm(f => ({ ...f, accountId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {accounts.filter(a => !a.isArchived).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.type === "perso" ? "perso" : "entreprise"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Catégorie</label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Logement, Assurance, SARL…" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Récurrence</label>
                <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v as PayableRecurrence }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYABLE_RECURRENCE_LABELS) as PayableRecurrence[]).map(r => (
                      <SelectItem key={r} value={r}>{PAYABLE_RECURRENCE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.recurrence !== "none" && form.recurrence !== "weekly" && (
                <div>
                  <label className="text-xs text-muted-foreground">Jour du mois</label>
                  <Input type="number" min={1} max={31} value={form.recurrenceDay} onChange={e => setForm(f => ({ ...f, recurrenceDay: e.target.value }))} placeholder="1-31" />
                </div>
              )}
              {form.recurrence !== "none" && (
                <div>
                  <label className="text-xs text-muted-foreground">Fin (optionnel)</label>
                  <Input type="date" value={form.recurrenceEnd} onChange={e => setForm(f => ({ ...f, recurrenceEnd: e.target.value }))} />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {form.recurrence !== "none" && (
              <p className="text-xs text-muted-foreground italic">
                Quand tu marqueras ce payable comme payé, la prochaine occurrence sera créée automatiquement.
              </p>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce payable ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible. N'affecte pas les soldes des comptes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
