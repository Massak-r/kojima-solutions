import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Bell, Folder, X, Check, Copy, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import {
  listRegistryItems, createRegistryItem, updateRegistryItem, deleteRegistryItem,
} from "@/api/adminRegistry";
import { listFolders } from "@/api/adminDocs";
import { useCreateSubtask, useUpdateSubtask } from "@/hooks/useSubtasks";
import type { DocFolder } from "@/api/adminDocs";
import type {
  RegistryEntry, RegistryEntryType, RegistryScope, RegistryStatus,
  BankMeta, InsuranceMeta, SubscriptionMeta, TaxMeta, TaxChecklistItem, CommonMeta,
} from "@/types/adminRegistry";
import {
  TYPE_LABELS, SCOPE_LABELS, STATUS_LABELS, REMIND_OPTIONS,
  defaultMeta, daysUntilAction, isExpiringSoon, pickCommonMeta,
} from "@/types/adminRegistry";

const TYPE_ORDER: RegistryEntryType[] = ['bank', 'insurance', 'subscription', 'tax'];

const ADMIN_OBJECTIVE_ID = 'bbab3b83-e0e1-4dad-b5b2-e0160cb40c59';

// ── Sub-form components ───────────────────────────────────────────────────────

function BankMetaFields({ meta, onChange }: { meta: BankMeta; onChange: (m: BankMeta) => void }) {
  const f = (key: keyof BankMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...meta, [key]: e.target.value });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Banque"><Input value={meta.bank ?? ''} onChange={f('bank')} placeholder="PostFinance" className="h-8 text-sm font-body" /></Field>
      <Field label="Type de compte"><Input value={meta.accountType ?? ''} onChange={f('accountType')} placeholder="Courant / Épargne" className="h-8 text-sm font-body" /></Field>
      <Field label="IBAN" className="col-span-2"><Input value={meta.iban ?? ''} onChange={f('iban')} placeholder="CH00 0000 0000 0000 0000 0" className="h-8 text-sm font-body" /></Field>
      <Field label="BIC"><Input value={meta.bic ?? ''} onChange={f('bic')} placeholder="POFICHBEXXX" className="h-8 text-sm font-body" /></Field>
      <Field label="Contact agence"><Input value={meta.agencyContact ?? ''} onChange={f('agencyContact')} placeholder="Nom / email" className="h-8 text-sm font-body" /></Field>
      <Field label="E-banking URL" className="col-span-2"><Input value={meta.ebankingUrl ?? ''} onChange={f('ebankingUrl')} placeholder="https://..." className="h-8 text-sm font-body" /></Field>
    </div>
  );
}

function InsuranceMetaFields({ meta, onChange }: { meta: InsuranceMeta; onChange: (m: InsuranceMeta) => void }) {
  const f = (key: keyof InsuranceMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...meta, [key]: e.target.value });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Assureur"><Input value={meta.insurer ?? ''} onChange={f('insurer')} placeholder="Generali" className="h-8 text-sm font-body" /></Field>
      <Field label="Type d'assurance"><Input value={meta.insuranceType ?? ''} onChange={f('insuranceType')} placeholder="RC / Vie / Santé" className="h-8 text-sm font-body" /></Field>
      <Field label="Prime (CHF)"><Input value={meta.premium ?? ''} onChange={f('premium')} placeholder="500" className="h-8 text-sm font-body" /></Field>
      <Field label="Fréquence">
        <Select value={meta.premiumFrequency ?? ''} onValueChange={v => onChange({ ...meta, premiumFrequency: v })}>
          <SelectTrigger className="h-8 text-sm font-body"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {['Mensuelle','Trimestrielle','Semestrielle','Annuelle'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Date de début"><Input type="date" value={meta.startDate ?? ''} onChange={f('startDate')} className="h-8 text-sm font-body" /></Field>
    </div>
  );
}

function SubscriptionMetaFields({ meta, onChange }: { meta: SubscriptionMeta; onChange: (m: SubscriptionMeta) => void }) {
  const f = (key: keyof SubscriptionMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...meta, [key]: e.target.value });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Fournisseur"><Input value={meta.provider ?? ''} onChange={f('provider')} placeholder="Adobe, GitHub..." className="h-8 text-sm font-body" /></Field>
      <Field label="Montant (CHF)"><Input value={meta.amount ?? ''} onChange={f('amount')} placeholder="29.90" className="h-8 text-sm font-body" /></Field>
      <Field label="Fréquence">
        <Select value={meta.frequency ?? ''} onValueChange={v => onChange({ ...meta, frequency: v })}>
          <SelectTrigger className="h-8 text-sm font-body"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {['Mensuelle','Annuelle','Usage'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Catégorie"><Input value={meta.category ?? ''} onChange={f('category')} placeholder="Outils, SaaS..." className="h-8 text-sm font-body" /></Field>
      <Field label="Fin de contrat" className="col-span-2"><Input type="date" value={meta.contractEndDate ?? ''} onChange={f('contractEndDate')} className="h-8 text-sm font-body" /></Field>
    </div>
  );
}

function TaxMetaFields({ meta, onChange }: { meta: TaxMeta; onChange: (m: TaxMeta) => void }) {
  const checklist = meta.checklist ?? [];
  const [newLabel, setNewLabel] = useState('');

  function addItem() {
    const label = newLabel.trim();
    if (!label) return;
    const item: TaxChecklistItem = { id: crypto.randomUUID(), label, done: false };
    onChange({ ...meta, checklist: [...checklist, item] });
    setNewLabel('');
  }

  function toggleItem(id: string) {
    onChange({ ...meta, checklist: checklist.map(c => c.id === id ? { ...c, done: !c.done } : c) });
  }

  function removeItem(id: string) {
    onChange({ ...meta, checklist: checklist.filter(c => c.id !== id) });
  }

  return (
    <div className="space-y-3">
      <Field label="Exercice fiscal">
        <Input value={meta.fiscalYear ?? ''} onChange={e => onChange({ ...meta, fiscalYear: e.target.value })} placeholder="2025" className="h-8 text-sm font-body w-32" />
      </Field>
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-body">Documents à réunir</p>
        <div className="space-y-1.5">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  item.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-input"
                )}
              >
                {item.done && <Check size={10} />}
              </button>
              <span className={cn("text-sm font-body flex-1", item.done && "line-through text-muted-foreground")}>{item.label}</span>
              <button type="button" onClick={() => removeItem(item.id)} className="p-0.5 text-muted-foreground hover:text-destructive">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
            placeholder="Nouveau document..."
            className="h-7 text-xs font-body"
          />
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addItem}>
            <Plus size={11} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1 font-body">{label}</p>
      {children}
    </div>
  );
}

// ── Pill filter ───────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-body transition-all border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ── Copyable info chip ────────────────────────────────────────────────────────

/** A labelled value (IBAN, BIC, n° de police…) that copies itself to the
 * clipboard in one click, with a brief green confirmation. */
function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked (insecure context / permissions) — fail quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copier : ${value}`}
      aria-label={`Copier ${label}`}
      className={cn(
        "group/chip inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-body transition-colors",
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-secondary",
      )}
    >
      <span className="text-foreground/60">{label}&nbsp;:</span>
      <span className={cn("font-medium", copied ? "text-emerald-700" : "text-foreground")}>{value}</span>
      {copied
        ? <Check size={11} className="shrink-0" />
        : <Copy size={11} className="shrink-0 opacity-50 group-hover/chip:opacity-100 transition-opacity" />}
    </button>
  );
}

// ── Status / scope badge helpers ──────────────────────────────────────────────

function statusBadgeClass(status: RegistryStatus): string {
  switch (status) {
    case 'active':   return 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30';
    case 'expiring': return 'bg-amber-100   dark:bg-amber-500/15   text-amber-700   dark:text-amber-300   border-amber-200   dark:border-amber-500/30';
    case 'expired':  return 'bg-red-100     dark:bg-red-500/15     text-red-700     dark:text-red-300     border-red-200     dark:border-red-500/30';
    case 'inactive': return 'bg-muted text-muted-foreground border-border';
  }
}

function scopeBadgeClass(scope: RegistryScope): string {
  switch (scope) {
    case 'personal': return 'bg-secondary text-secondary-foreground border-border';
    case 'business': return 'bg-blue-100   dark:bg-blue-500/15   text-blue-700   dark:text-blue-300   border-blue-200   dark:border-blue-500/30';
    case 'both':     return 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30';
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface RegistreTabProps {
  onOpenFolder: (folderId: string) => void;
}

type MetaState = BankMeta | InsuranceMeta | SubscriptionMeta | TaxMeta;

export function RegistreTab({ onOpenFolder }: RegistreTabProps) {
  const { toast } = useToast();
  const createSubtaskMut = useCreateSubtask();
  const updateSubtaskMut = useUpdateSubtask();

  const [entries,  setEntries]  = useState<RegistryEntry[]>([]);
  const [folders,  setFolders]  = useState<DocFolder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Filters
  const [typeFilter,  setTypeFilter]  = useState<'all' | RegistryEntryType>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | RegistryScope>('all');

  // Dialog
  const [dialogOpen,    setDialogOpen]    = useState(false);
  const [editingEntry,  setEditingEntry]  = useState<RegistryEntry | null>(null);

  // Form state
  const [formType,           setFormType]           = useState<RegistryEntryType>('bank');
  const [formName,           setFormName]           = useState('');
  const [formScope,          setFormScope]          = useState<RegistryScope>('personal');
  const [formStatus,         setFormStatus]         = useState<RegistryStatus>('active');
  const [formFolderId,       setFormFolderId]       = useState<string>('');
  const [formNotes,          setFormNotes]          = useState('');
  const [formNextActionDate, setFormNextActionDate] = useState('');
  const [formRemindDays,     setFormRemindDays]     = useState(30);
  const [formMeta,           setFormMeta]           = useState<MetaState>({});
  const [formExtras,         setFormExtras]         = useState<CommonMeta>({});

  // Delete + alert
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [alertingId, setAlertingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRegistryItems(), listFolders()])
      .then(([e, f]) => { setEntries(e); setFolders(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredEntries = useMemo(() => entries.filter(e => {
    if (typeFilter  !== 'all' && e.type  !== typeFilter)  return false;
    if (scopeFilter !== 'all' && e.scope !== scopeFilter) return false;
    return true;
  }), [entries, typeFilter, scopeFilter]);

  const alertEntries = useMemo(() =>
    entries.filter(e => e.status !== 'inactive' && e.status !== 'expired' && isExpiringSoon(e)),
    [entries]
  );

  const entriesByType = useMemo(() => {
    const map: Partial<Record<RegistryEntryType, RegistryEntry[]>> = {};
    filteredEntries.forEach(e => {
      if (!map[e.type]) map[e.type] = [];
      map[e.type]!.push(e);
    });
    return map;
  }, [filteredEntries]);

  const folderMap = useMemo(() => new Map(folders.map(f => [f.id, f.name])), [folders]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingEntry(null);
    setFormType('bank');
    setFormName('');
    setFormScope('personal');
    setFormStatus('active');
    setFormFolderId('');
    setFormNotes('');
    setFormNextActionDate('');
    setFormRemindDays(30);
    setFormMeta(defaultMeta('bank'));
    setFormExtras({});
    setDialogOpen(true);
  }

  function openEdit(entry: RegistryEntry) {
    setEditingEntry(entry);
    setFormType(entry.type);
    setFormName(entry.name);
    setFormScope(entry.scope);
    setFormStatus(entry.status);
    setFormFolderId(entry.folderId ?? '');
    setFormNotes(entry.notes ?? '');
    setFormNextActionDate(entry.nextActionDate ?? '');
    setFormRemindDays(entry.remindDays);
    // The legacy insurance-only "N° police" field is superseded by the generic
    // identifiers — strip it from meta and fold any saved value into Identifiant 1.
    const rawMeta = (entry.meta ?? {}) as Record<string, unknown>;
    const { policyNumber, ...cleanMeta } = rawMeta;
    setFormMeta(entry.meta ? (cleanMeta as MetaState) : defaultMeta(entry.type));
    const extras = pickCommonMeta(entry.meta);
    if (typeof policyNumber === 'string' && policyNumber && !extras.id1Value) {
      extras.id1Label = extras.id1Label || 'N° de police';
      extras.id1Value = policyNumber;
    }
    setFormExtras(extras);
    setDialogOpen(true);
  }

  function onTypeChange(t: RegistryEntryType) {
    setFormType(t);
    setFormMeta(defaultMeta(t));
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        type:           formType,
        name:           formName.trim(),
        scope:          formScope,
        status:         formStatus,
        folderId:       formFolderId || null,
        notes:          formNotes || null,
        nextActionDate: formNextActionDate || null,
        remindDays:     formRemindDays,
        meta:           { ...formMeta, ...formExtras } as MetaState,
        sortOrder:      editingEntry?.sortOrder ?? 0,
      };

      if (editingEntry) {
        const updated = await updateRegistryItem(editingEntry.id, payload);
        setEntries(prev => prev.map(e => e.id === editingEntry.id ? updated : e));
        toast({ title: "Enregistré", description: `"${updated.name}" mis à jour.` });
      } else {
        const created = await createRegistryItem(payload);
        setEntries(prev => [...prev, created]);
        toast({ title: "Créé", description: `"${created.name}" ajouté au registre.` });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'enregistrer.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    setEntries(prev => prev.filter(e => e.id !== id));
    setDeleteId(null);
    try { await deleteRegistryItem(id); } catch { /* optimistic delete — UI already updated */ }
  }

  async function handleCreateAlert(entry: RegistryEntry) {
    if (alertingId === entry.id) return;
    setAlertingId(entry.id);
    try {
      const subtask = await createSubtaskMut.mutateAsync({
        source:   'admin',
        parentId: ADMIN_OBJECTIVE_ID,
        text:     `Renouveler ${entry.name} — échéance : ${entry.nextActionDate ?? '?'}`,
        priority: 'high',
      });
      await updateSubtaskMut.mutateAsync({ id: subtask.id, patch: { flaggedToday: true } });
      toast({ title: "Alerte créée", description: `Subtask ajoutée sous l'objectif Admin.` });
    } catch {
      // Mutation hooks already toast the error; nothing more to do here.
    } finally {
      setAlertingId(null);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderMetaSummary(entry: RegistryEntry) {
    const m = entry.meta as Record<string, unknown> | null;
    if (!m) return null;

    const pairs: { label: string; value: string; copyable: boolean }[] = [];
    const add = (label: string, value: string, copyable = true) =>
      pairs.push({ label, value, copyable });

    if (entry.type === 'bank') {
      if (m.bank)        add('Banque', String(m.bank));
      if (m.accountType) add('Type', String(m.accountType));
      if (m.iban)        add('IBAN', String(m.iban));
      if (m.bic)         add('BIC', String(m.bic));
    } else if (entry.type === 'insurance') {
      if (m.insurer)       add('Assureur', String(m.insurer));
      if (m.insuranceType) add('Type', String(m.insuranceType));
      if (m.policyNumber)  add('N° police', String(m.policyNumber));
      if (m.premium)       add('Prime', `CHF ${m.premium}${m.premiumFrequency ? ` / ${m.premiumFrequency}` : ''}`);
    } else if (entry.type === 'subscription') {
      if (m.provider) add('Fournisseur', String(m.provider));
      if (m.amount)   add('Montant', `CHF ${m.amount}${m.frequency ? ` / ${m.frequency}` : ''}`);
      if (m.category) add('Catégorie', String(m.category));
    } else if (entry.type === 'tax') {
      if (m.fiscalYear) add('Exercice', String(m.fiscalYear));
      const checklist = (m.checklist as TaxChecklistItem[] | undefined) ?? [];
      if (checklist.length) {
        const done = checklist.filter(c => c.done).length;
        add('Documents', `${done} / ${checklist.length}`, false);
      }
    }

    // Custom identifiers — available on every entry type.
    if (m.id1Value) add(String(m.id1Label || 'Identifiant 1'), String(m.id1Value));
    if (m.id2Value) add(String(m.id2Label || 'Identifiant 2'), String(m.id2Value));

    if (pairs.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-x-2 gap-y-1.5 mt-2">
        {pairs.map(p => p.copyable
          ? <CopyChip key={p.label} label={p.label} value={p.value} />
          : (
            <span key={p.label} className="inline-flex items-center text-xs font-body text-muted-foreground px-2 py-0.5">
              <span className="text-foreground/60">{p.label}&nbsp;:</span>&nbsp;{p.value}
            </span>
          )
        )}
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Alert banner */}
      {alertEntries.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15} />
            <span className="text-sm font-body font-semibold">{alertEntries.length} échéance{alertEntries.length > 1 ? 's' : ''} à surveiller</span>
          </div>
          <div className="space-y-1.5">
            {alertEntries.map(e => {
              const days = daysUntilAction(e);
              const label = days === null ? '' : days <= 0 ? `Échue il y a ${Math.abs(days)} j` : `Dans ${days} j`;
              return (
                <div key={e.id} className="flex items-center gap-3 text-xs font-body text-amber-800 dark:text-amber-300">
                  <span className="flex-1">{e.name} <span className="opacity-60">— {label}</span></span>
                  <button
                    onClick={() => handleCreateAlert(e)}
                    disabled={alertingId === e.id}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-200 hover:bg-amber-300 transition-colors disabled:opacity-50"
                  >
                    {alertingId === e.id ? <Loader2 size={10} className="animate-spin" /> : <Bell size={10} />}
                    Créer une alerte
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground/70 w-[72px] shrink-0">Catégorie</span>
            <div className="flex gap-1.5 flex-wrap flex-1">
              <Pill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>Tout</Pill>
              {TYPE_ORDER.map(t => (
                <Pill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{TYPE_LABELS[t]}</Pill>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-body font-semibold uppercase tracking-wide text-muted-foreground/70 w-[72px] shrink-0">Périmètre</span>
            <div className="flex gap-1.5 flex-wrap flex-1">
              <Pill active={scopeFilter === 'all'} onClick={() => setScopeFilter('all')}>Tout</Pill>
              {(['personal', 'business'] as RegistryScope[]).map(s => (
                <Pill key={s} active={scopeFilter === s} onClick={() => setScopeFilter(s)}>{SCOPE_LABELS[s]}</Pill>
              ))}
            </div>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus size={14} /> Ajouter
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm font-body">Aucune entrée. Cliquez sur « Ajouter » pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {TYPE_ORDER.filter(t => entriesByType[t]?.length).map(type => (
            <section key={type}>
              <h3 className="font-body text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {TYPE_LABELS[type]}
              </h3>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {entriesByType[type]!.map(entry => {
                    const days = daysUntilAction(entry);
                    const expiring = isExpiringSoon(entry) && entry.status !== 'inactive' && entry.status !== 'expired';
                    const meta = entry.meta as Record<string, unknown> | null;
                    const rawLink = meta && typeof meta.linkUrl === 'string' ? meta.linkUrl.trim() : '';
                    const linkHref = rawLink && !/^https?:\/\//i.test(rawLink) ? `https://${rawLink}` : rawLink;
                    const linkLabel = meta && typeof meta.linkLabel === 'string' && meta.linkLabel.trim()
                      ? meta.linkLabel.trim() : 'Aller plus loin';
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="glass-card rounded-2xl p-4 group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-body font-medium text-sm">{entry.name}</span>
                              <Badge className={cn("text-[10px] border", statusBadgeClass(entry.status))}>
                                {STATUS_LABELS[entry.status]}
                              </Badge>
                              <Badge className={cn("text-[10px] border", scopeBadgeClass(entry.scope))}>
                                {SCOPE_LABELS[entry.scope]}
                              </Badge>
                              {expiring && days !== null && (
                                <span className="text-[10px] font-body text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                  {days <= 0 ? `Échue il y a ${Math.abs(days)} j` : `Expire dans ${days} j`}
                                </span>
                              )}
                            </div>
                            {renderMetaSummary(entry)}
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground font-body mt-2 whitespace-pre-wrap break-words">
                                {entry.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {entry.nextActionDate && (
                                <span className="text-xs text-muted-foreground font-body">
                                  Prochaine action : {new Date(entry.nextActionDate).toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                              {entry.folderId && folderMap.has(entry.folderId) && (
                                <button
                                  onClick={() => onOpenFolder(entry.folderId!)}
                                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-body transition-colors"
                                >
                                  <Folder size={11} />
                                  {folderMap.get(entry.folderId)}
                                </button>
                              )}
                              {linkHref && (
                                <a
                                  href={linkHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-body transition-colors"
                                >
                                  <ExternalLink size={11} />
                                  {linkLabel}
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                            {expiring && (
                              <button
                                onClick={() => handleCreateAlert(entry)}
                                disabled={alertingId === entry.id}
                                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                title="Créer une alerte"
                              >
                                {alertingId === entry.id ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(entry)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={13} />
                            </button>
                            {deleteId === entry.id ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(entry.id)}>OK</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDeleteId(null)}>Non</Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <ResponsiveDialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <ResponsiveDialogContent className="max-w-lg font-body max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editingEntry ? 'Modifier' : 'Ajouter'} une entrée</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <Field label="Type">
              <Select value={formType} onValueChange={v => !editingEntry && onTypeChange(v as RegistryEntryType)} disabled={!!editingEntry}>
                <SelectTrigger className="h-9 text-sm font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {/* Name */}
            <Field label="Nom">
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Libellé..." className="h-9 text-sm font-body" autoFocus />
            </Field>

            {/* Scope + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Périmètre">
                <Select value={formScope} onValueChange={v => setFormScope(v as RegistryScope)}>
                  <SelectTrigger className="h-9 text-sm font-body"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['personal','business','both'] as RegistryScope[]).map(s => <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Statut">
                <Select value={formStatus} onValueChange={v => setFormStatus(v as RegistryStatus)}>
                  <SelectTrigger className="h-9 text-sm font-body"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['active','inactive','expiring','expired'] as RegistryStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Meta fields */}
            <div className="border border-border/50 rounded-xl p-4 bg-secondary/20">
              {formType === 'bank'         && <BankMetaFields         meta={formMeta as BankMeta}         onChange={m => setFormMeta(m)} />}
              {formType === 'insurance'    && <InsuranceMetaFields    meta={formMeta as InsuranceMeta}    onChange={m => setFormMeta(m)} />}
              {formType === 'subscription' && <SubscriptionMetaFields meta={formMeta as SubscriptionMeta} onChange={m => setFormMeta(m)} />}
              {formType === 'tax'          && <TaxMetaFields          meta={formMeta as TaxMeta}          onChange={m => setFormMeta(m)} />}
            </div>

            {/* Identifiers — generic, shown as copyable chips on the card */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-body">Identifiants (copiables sur la fiche)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={formExtras.id1Label ?? ''} onChange={e => setFormExtras(p => ({ ...p, id1Label: e.target.value }))} placeholder="Libellé — ex. N° de police" className="h-8 text-sm font-body" />
                <Input value={formExtras.id1Value ?? ''} onChange={e => setFormExtras(p => ({ ...p, id1Value: e.target.value }))} placeholder="Valeur" className="h-8 text-sm font-body" />
                <Input value={formExtras.id2Label ?? ''} onChange={e => setFormExtras(p => ({ ...p, id2Label: e.target.value }))} placeholder="Libellé — ex. N° client" className="h-8 text-sm font-body" />
                <Input value={formExtras.id2Value ?? ''} onChange={e => setFormExtras(p => ({ ...p, id2Value: e.target.value }))} placeholder="Valeur" className="h-8 text-sm font-body" />
              </div>
            </div>

            {/* "Go further" link */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-body">Lien « aller plus loin »</p>
              <div className="grid grid-cols-3 gap-2">
                <Input value={formExtras.linkLabel ?? ''} onChange={e => setFormExtras(p => ({ ...p, linkLabel: e.target.value }))} placeholder="Libellé" className="h-8 text-sm font-body" />
                <Input value={formExtras.linkUrl ?? ''} onChange={e => setFormExtras(p => ({ ...p, linkUrl: e.target.value }))} placeholder="https://portail..." className="col-span-2 h-8 text-sm font-body" />
              </div>
            </div>

            {/* Next action + remind */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Prochaine action">
                <Input type="date" value={formNextActionDate} onChange={e => setFormNextActionDate(e.target.value)} className="h-9 text-sm font-body" />
              </Field>
              <Field label="Rappel (jours avant)">
                <Select value={String(formRemindDays)} onValueChange={v => setFormRemindDays(Number(v))}>
                  <SelectTrigger className="h-9 text-sm font-body"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMIND_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} jours</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Folder link */}
            <Field label="Dossier lié (optionnel)">
              <Select value={formFolderId || 'none'} onValueChange={v => setFormFolderId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm font-body"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {/* Notes */}
            <Field label="Notes (optionnel)">
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-body resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Informations complémentaires..."
              />
            </Field>
          </div>

          <ResponsiveDialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 size={13} className="animate-spin mr-1" />}
              Enregistrer
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
