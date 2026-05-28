import { useEffect, useMemo, useState } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Archive, ArchiveRestore, Building2, Wallet,
  Banknote, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listAccounts, createAccount, updateAccount, deleteAccount,
} from "@/api/accounts";
import {
  type Account, type AccountType, ACCOUNT_TYPE_LABELS,
} from "@/types/account";

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

function timeAgo(iso?: string | null): string {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso.replace(" ", "T")).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 30) return `il y a ${d} j`;
  const m = Math.floor(d / 30);
  return m < 12 ? `il y a ${m} mois` : `il y a ${Math.floor(m / 12)} an${m / 12 >= 2 ? "s" : ""}`;
}

interface FormState {
  name: string;
  type: AccountType;
  institution: string;
  currency: string;
  balance: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "", type: "perso", institution: "", currency: "CHF", balance: "", notes: "",
};

export function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const errToast = (msg = "L'opération a échoué") =>
    toast({ title: "Erreur", description: msg, variant: "destructive" });

  const reload = (archived = showArchived) =>
    listAccounts({ includeArchived: archived })
      .then(setAccounts)
      .catch(() => errToast())
      .finally(() => setLoading(false));

  useEffect(() => { reload(showArchived); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showArchived]);

  const { perso, entreprise, totalPerso, totalEntreprise } = useMemo(() => {
    const active = accounts.filter(a => showArchived || !a.isArchived);
    const p = active.filter(a => a.type === "perso");
    const e = active.filter(a => a.type === "entreprise");
    return {
      perso: p,
      entreprise: e,
      totalPerso: p.reduce((s, a) => s + a.balance, 0),
      totalEntreprise: e.reduce((s, a) => s + a.balance, 0),
    };
  }, [accounts, showArchived]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      name: a.name,
      type: a.type,
      institution: a.institution ?? "",
      currency: a.currency,
      balance: a.balance.toString(),
      notes: a.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { errToast("Nom requis"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      institution: form.institution.trim() || null,
      currency: form.currency.trim() || "CHF",
      balance: parseFloat(form.balance.replace(",", ".")) || 0,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await updateAccount(editing.id, payload);
        toast({ title: "Compte mis à jour" });
      } else {
        await createAccount(payload);
        toast({ title: "Compte créé" });
      }
      setDialogOpen(false);
      await reload();
    } catch {
      errToast();
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(a: Account) {
    try {
      await updateAccount(a.id, { isArchived: !a.isArchived });
      await reload();
    } catch { errToast(); }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deleteAccount(deletingId);
      toast({ title: "Compte supprimé" });
      setDeletingId(null);
      await reload();
    } catch { errToast(); }
  }

  const renderGroup = (title: string, icon: React.ReactNode, items: Account[], total: number) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground">{title}</h3>
          <Badge variant="outline" className="text-xs">{items.length}</Badge>
        </div>
        <div className="font-display text-xl font-semibold tabular-nums">{formatCHF(total)}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic border rounded-lg px-4 py-6 text-center">
          Aucun compte {title.toLowerCase()}.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(a => (
            <li
              key={a.id}
              className={`group border rounded-lg p-3 transition hover:border-primary/40 ${a.isArchived ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => openEdit(a)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.name}</span>
                    {a.institution && <span className="text-xs text-muted-foreground">· {a.institution}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    MAJ {timeAgo(a.balanceUpdatedAt)}
                  </div>
                  {a.notes && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.notes}</div>
                  )}
                </button>
                <div className="text-right">
                  <div className="font-display text-lg font-semibold tabular-nums">
                    {formatCHF(a.balance, a.currency)}
                  </div>
                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleArchive(a)}>
                      {a.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Mes comptes</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived(v => !v)}>
            {showArchived ? "Masquer archivés" : "Voir archivés"}
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Compte
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-muted/30">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total personnel</div>
          <div className="font-display text-3xl font-semibold tabular-nums">{formatCHF(totalPerso)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total entreprise</div>
          <div className="font-display text-3xl font-semibold tabular-nums">{formatCHF(totalEntreprise)}</div>
        </div>
      </div>

      {renderGroup("Personnel", <Wallet className="h-4 w-4 text-primary" />, perso, totalPerso)}
      {renderGroup("Entreprise", <Building2 className="h-4 w-4 text-primary" />, entreprise, totalEntreprise)}

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editing ? "Modifier le compte" : "Nouveau compte"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground">Nom</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex. PostFinance perso" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as AccountType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(t => (
                      <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Devise</label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={4} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Institution (optionnel)</label>
              <Input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="ex. PostFinance, UBS, Liquide…" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Solde actuel</label>
              <Input type="text" inputMode="decimal" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
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
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les dépenses et payables liés à ce compte gardent leur historique mais perdent la référence.
            </AlertDialogDescription>
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
