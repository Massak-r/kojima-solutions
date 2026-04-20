import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, Loader2, AlertTriangle, Bell, Folder, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import {
  listRegistryItems, createRegistryItem, updateRegistryItem, deleteRegistryItem,
} from "@/api/adminRegistry";
import { listFolders } from "@/api/adminDocs";
import { createSubtask, updateSubtask } from "@/api/todoSubtasks";
import type { DocFolder } from "@/api/adminDocs";
import type {
  RegistryEntry, RegistryEntryType, RegistryScope, RegistryStatus,
  BankMeta, InsuranceMeta, SubscriptionMeta, TaxMeta, TaxChecklistItem,
} from "@/types/adminRegistry";
import {
  TYPE_LABELS, SCOPE_LABELS, STATUS_LABELS, REMIND_OPTIONS,
  defaultMeta, daysUntilAction, isExpiringSoon,
} from "@/types/adminRegistry";

const TYPE_ORDER: RegistryEntryType[] = ['bank', 'insurance', 'subscription', 'tax'];

const ADMIN_OBJECTIVE_ID = 'bbab3b83-e0e1-4dad-b5b2-e0160cb40c59';

// ── Sub-form components ───────────────────────────────────────────────────────

function BankMetaFields({ meta, onChange }: { meta: BankMeta; onChange: (m: BankMeta) => void }) {
  const f = (key: keyof BankMeta) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...meta, [key]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-3">
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
    <div className="grid grid-cols-2 gap-3">
      <Field label="Assureur"><Input value={meta.insurer ?? ''} onChange={f('insurer')} placeholder="Generali" className="h-8 text-sm font-body" /></Field>
      <Field label="Type d'assurance"><Input value={meta.insuranceType ?? ''} onChange={f('insuranceType')} placeholder="RC / Vie / Santé" className="h-8 text-sm font-body" /></Field>
      <Field label="N° police"><Input value={meta.policyNumber ?? ''} onChange={f('policyNumber')} placeholder="CH-12345" className="h-8 text-sm font-body" /></Field>
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
    <div className="grid grid-cols-2 gap-3">
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

// ── Status / scope badge helpers ──────────────────────────────────────────────

function statusBadgeClass(status: RegistryStatus): string {
  switch (status) {
    case 'active':   return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'expiring': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'expired':  return 'bg-red-100 text-red-700 border-red-200';
    case 'inactive': return 'bg-muted text-muted-foreground border-border';
  }
}

function scopeBadgeClass(scope: RegistryScope): string {
  switch (scope) {
    case 'personal': return 'bg-secondary text-secondary-foreground border-border';
    case 'business': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'both':     return 'bg-purple-100 text-purple-700 border-purple-200';
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface RegistreTabProps {
  onOpenFolder: (folderId: string) => void;
}

type MetaState = BankMeta | InsuranceMeta | SubscriptionMeta | TaxMeta;

export function RegistreTab({ onOpenFolder }: RegistreTabProps) {
  const { toast } = useToast();

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
    setFormMeta((entry.meta as MetaState) ?? defaultMeta(entry.type));
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
        meta:           formMeta,
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
    try { await deleteRegistryItem(id); } catch {}
  }

  async function handleCreateAlert(entry: RegistryEntry) {
    if (alertingId === entry.id) return;
    setAlertingId(entry.id);
    try {
      const subtask = await createSubtask({
        source:   'admin',
        parentId: ADMIN_OBJECTIVE_ID,
        text:     `Renouveler ${entry.name} — échéance : ${entry.nextActionDate ?? '?'}`,
        priority: 'high',
      });
      await updateSubtask(subtask.id, { flaggedToday: true });
      toast({ title: "Alerte créée", description: `Subtask ajoutée sous l'objectif Admin.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer l'alerte.", variant: "destructive" });
    } finally {
      setAlertingId(null);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderMetaSummary(entry: RegistryEntry) {
    const m = entry.meta as Record<string, unknown> | null;
    if (!m) return null;

    const pairs: [string, string][] = [];
    if (entry.type === 'bank') {
      if (m.bank)        pairs.push(['Banque', String(m.bank)]);
      if (m.accountType) pairs.push(['Type', String(m.accountType)]);
      if (m.iban)        pairs.push(['IBAN', String(m.iban)]);
    } else if (entry.type === 'insurance') {
      if (m.insurer)       pairs.push(['Assureur', String(m.insurer)]);
      if (m.insuranceType) pairs.push(['Type', String(m.insuranceType)]);
      if (m.premium)       pairs.push(['Prime', `CHF ${m.premium}${m.premiumFrequency ? ` / ${m.premiumFrequency}` : ''}`]);
    } else if (entry.type === 'subscription') {
      if (m.provider) pairs.push(['Fournisseur', String(m.provider)]);
      if (m.amount)   pairs.push(['Montant', `CHF ${m.amount}${m.frequency ? ` / ${m.frequency}` : ''}`]);
      if (m.category) pairs.push(['Catégorie', String(m.category)]);
    } else if (entry.type === 'tax') {
      if (m.fiscalYear) pairs.push(['Exercice', String(m.fiscalYear)]);
      const checklist = (m.checklist as TaxChecklistItem[] | undefined) ?? [];
      if (checklist.length) {
        const done = checklist.filter(c => c.done).length;
        pairs.push(['Documents', `${done} / ${checklist.length}`]);
      }
    }

    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
        {pairs.map(([k, v]) => (
          <span key={k} className="text-xs font-body text-muted-foreground">
            <span className="text-foreground/60">{k} :</span> {v}
          </span>
        ))}
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
          <div className="flex gap-1.5 flex-wrap">
            <Pill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>Tout</Pill>
            {TYPE_ORDER.map(t => (
              <Pill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{TYPE_LABELS[t]}</Pill>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <Pill active={scopeFilter === 'all'} onClick={() => setScopeFilter('all')}>Tout</Pill>
            {(['personal', 'business'] as RegistryScope[]).map(s => (
              <Pill key={s} active={scopeFilter === s} onClick={() => setScopeFilter(s)}>{SCOPE_LABELS[s]}</Pill>
            ))}
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
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg font-body max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Modifier' : 'Ajouter'} une entrée</DialogTitle>
          </DialogHeader>

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
            <div className="grid grid-cols-2 gap-3">
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

            {/* Next action + remind */}
            <div className="grid grid-cols-2 gap-3">
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

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 size={13} className="animate-spin mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
