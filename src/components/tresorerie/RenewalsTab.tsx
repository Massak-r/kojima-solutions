import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Plus, Pencil, Trash2, RotateCcw, Loader2, CalendarClock, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  listRenewals, createRenewal, updateRenewal, deleteRenewal, advanceExpiry,
  RENEWAL_RECURRENCE_LABELS, type Renewal, type RenewalRecurrence,
} from "@/api/renewals";

const RECURRENCES: RenewalRecurrence[] = ["none", "monthly", "quarterly", "biannual", "yearly"];
const CATEGORIES = ["Domaine", "Hébergement", "SSL", "Assurance", "Contrat", "Abonnement", "Licence", "Autre"];

function fmtCHF(n: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })
    .format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysUntil(iso: string): number {
  const t = new Date(iso + "T00:00:00").getTime();
  const today = new Date(todayISO() + "T00:00:00").getTime();
  return Math.round((t - today) / 86_400_000);
}
function dueLabel(iso: string): { text: string; cls: string } {
  const d = daysUntil(iso);
  if (d < 0)   return { text: `En retard ${Math.abs(d)}j`, cls: "text-destructive font-semibold" };
  if (d === 0) return { text: "Aujourd'hui", cls: "text-destructive font-semibold" };
  if (d <= 7)  return { text: `Dans ${d}j`, cls: "text-amber-600 font-medium" };
  if (d <= 30) return { text: `Dans ${d}j`, cls: "text-amber-600" };
  if (d <= 90) return { text: `Dans ${Math.round(d / 7)} sem`, cls: "text-muted-foreground" };
  return { text: new Date(iso + "T00:00:00").toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" }), cls: "text-muted-foreground" };
}
function stripColor(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0)  return "bg-red-500";
  if (d <= 7) return "bg-amber-400";
  if (d <= 30) return "bg-amber-300";
  return "bg-green-400";
}

interface FormState {
  label: string; category: string; expiryDate: string;
  recurrence: RenewalRecurrence; amount: string; notes: string;
}
const EMPTY: FormState = { label: "", category: "", expiryDate: "", recurrence: "yearly", amount: "", notes: "" };

export function RenewalsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: renewals = [], isLoading } = useQuery({
    queryKey: ["renewals"],
    queryFn: () => listRenewals(),
    staleTime: 60_000,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const errToast = () => toast({ title: "Erreur", description: "L'opération a échoué", variant: "destructive" });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["renewals"] });

  const sorted = useMemo(
    () => [...renewals].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [renewals],
  );
  const overdue = useMemo(() => renewals.filter(r => daysUntil(r.expiryDate) < 0).length, [renewals]);
  const yearlyCost = useMemo(
    () => renewals.reduce((s, r) => {
      if (r.amount == null) return s;
      const perYear = { none: 0, monthly: 12, quarterly: 4, biannual: 2, yearly: 1 }[r.recurrence];
      return s + r.amount * perYear;
    }, 0),
    [renewals],
  );

  function openCreate() { setEditId(null); setForm({ ...EMPTY, expiryDate: todayISO() }); setDialogOpen(true); }
  function openEdit(r: Renewal) {
    setEditId(r.id);
    setForm({
      label: r.label, category: r.category ?? "", expiryDate: r.expiryDate,
      recurrence: r.recurrence, amount: r.amount != null ? String(r.amount) : "", notes: r.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.label.trim() || !form.expiryDate) { errToast(); return; }
    setSaving(true);
    const payload = {
      label: form.label.trim(),
      category: form.category.trim() || null,
      expiryDate: form.expiryDate,
      recurrence: form.recurrence,
      amount: form.amount ? parseFloat(form.amount.replace(",", ".")) : null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editId) { await updateRenewal(editId, payload); toast({ title: "Échéance mise à jour" }); }
      else { await createRenewal(payload); toast({ title: "Échéance ajoutée" }); }
      invalidate();
      setDialogOpen(false);
    } catch { errToast(); }
    finally { setSaving(false); }
  }

  async function renew(r: Renewal) {
    try {
      await updateRenewal(r.id, { expiryDate: advanceExpiry(r.expiryDate, r.recurrence) });
      invalidate();
      toast({ title: "Renouvelé", description: `Prochaine échéance dans ${RENEWAL_RECURRENCE_LABELS[r.recurrence].toLowerCase()}.` });
    } catch { errToast(); }
  }

  async function remove(id: string) {
    try { await deleteRenewal(id); invalidate(); setDeletingId(null); toast({ title: "Supprimé" }); }
    catch { errToast(); }
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Échéances & renouvellements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Domaines, hébergement, SSL, assurances, contrats, abonnements à renouveler.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> Nouvelle</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border p-3 bg-muted/30">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Suivies</div>
          <div className="font-display text-xl font-semibold tabular-nums mt-1">{renewals.length}</div>
        </div>
        <div className="rounded-xl border p-3 bg-muted/30">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> En retard</div>
          <div className={cn("font-display text-xl font-semibold tabular-nums mt-1", overdue > 0 && "text-destructive")}>{overdue}</div>
        </div>
        <div className="rounded-xl border p-3 bg-muted/30 col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Coût annuel</div>
          <div className="font-display text-xl font-semibold tabular-nums mt-1">{fmtCHF(yearlyCost)}</div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="border rounded-lg px-4 py-10 text-center text-sm text-muted-foreground italic">
          Aucune échéance. Ajoute tes domaines, hébergements, assurances…
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map(r => {
            const dl = dueLabel(r.expiryDate);
            return (
              <li key={r.id} className="group border rounded-lg p-3 flex items-center gap-3 transition hover:border-primary/40">
                <div className={cn("w-1.5 h-9 rounded-full shrink-0", stripColor(r.expiryDate))} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{r.label}</span>
                    {r.category && <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>}
                    <Badge variant="outline" className="text-[10px]">{RENEWAL_RECURRENCE_LABELS[r.recurrence]}</Badge>
                  </div>
                  <div className="text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span className={dl.cls}>{dl.text}</span>
                    {r.amount != null && <span className="text-muted-foreground tabular-nums">{fmtCHF(r.amount)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                  {r.recurrence !== "none" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700 dark:text-emerald-400" title="Marquer renouvelé (avance la date)" onClick={() => renew(r)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Éditer" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {deletingId === r.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => remove(r.id)}>Oui</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setDeletingId(null)}>Non</Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Supprimer" onClick={() => setDeletingId(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editId ? "Modifier" : "Nouvelle"} échéance</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs text-muted-foreground">Libellé</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="ex. kojima-solutions.ch, Hébergement Infomaniak…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Catégorie</label>
                <Select value={form.category || "__none__"} onValueChange={v => setForm(f => ({ ...f, category: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Récurrence</label>
                <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v as RenewalRecurrence }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCES.map(r => <SelectItem key={r} value={r}>{RENEWAL_RECURRENCE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Échéance</label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Montant (CHF, optionnel)</label>
                <Input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.label.trim() || !form.expiryDate}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {editId ? "Enregistrer" : "Ajouter"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
