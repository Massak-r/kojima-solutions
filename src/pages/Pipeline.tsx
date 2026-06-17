import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast as sonnerToast } from "sonner";
import {
  Plus, MoreVertical, Building2, CalendarClock, Trash2, ArrowRightLeft, Handshake, Mail,
  UserPlus, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients } from "@/contexts/ClientsContext";
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from "@/hooks/useLeads";
import type { Lead, LeadStatus } from "@/api/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { haptic } from "@/lib/haptics";

const STATUSES: { key: LeadStatus; label: string; dot: string; headerText: string }[] = [
  { key: "new",       label: "Nouveau",     dot: "bg-slate-400",   headerText: "text-slate-600 dark:text-slate-300"   },
  { key: "contacted", label: "Contacté",    dot: "bg-sky-400",     headerText: "text-sky-700 dark:text-sky-300"       },
  { key: "proposal",  label: "Proposition", dot: "bg-amber-400",   headerText: "text-amber-700 dark:text-amber-300"   },
  { key: "won",       label: "Gagné",       dot: "bg-emerald-500", headerText: "text-emerald-700 dark:text-emerald-300" },
  { key: "lost",      label: "Perdu",       dot: "bg-muted-foreground/40", headerText: "text-muted-foreground" },
];

function chf(n: number): string {
  // fr-CH uses a no-break/narrow space as the thousands separator; normalise it
  // to the Swiss apostrophe and avoid any irregular-whitespace in source.
  return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 0 }).format(n).replace(/\s/g, "'") + " CHF";
}

export default function Pipeline() {
  const { data: leads = [], isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { addClient } = useClients();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  // Close the loop: a won lead becomes a client (and we keep the link so we
  // never re-convert or lose the trail). Drops you on the new client's fiche.
  function convertToClient(lead: Lead) {
    const client = addClient({
      name: lead.name,
      email: lead.email ?? undefined,
      organization: lead.company ?? undefined,
    });
    updateLead.mutate({ id: lead.id, patch: { status: "won", convertedClientId: client.id } });
    haptic("success");
    sonnerToast.success("Lead converti en client", { description: lead.name });
    navigate(`/clients/${client.id}`);
  }

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = { new: [], contacted: [], proposal: [], won: [], lost: [] };
    for (const l of leads) (map[l.status] ?? map.new).push(l);
    return map;
  }, [leads]);

  // Active pipeline value = everything not yet won/lost. Conversion = won / (won+lost).
  const activeValue = useMemo(
    () => leads.filter((l) => l.status === "new" || l.status === "contacted" || l.status === "proposal").reduce((s, l) => s + l.value, 0),
    [leads],
  );
  const wonCount = byStatus.won.length;
  const closedCount = byStatus.won.length + byStatus.lost.length;
  const conversion = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Header */}
      <header className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-eyebrow flex items-center gap-1.5"><Handshake size={13} className="text-primary" /> Pipeline</p>
            <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground leading-none">Pipeline commercial</h1>
            <p className="mt-2 text-sm font-body text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{chf(activeValue)}</span> en cours
              {conversion !== null && <> · conversion {conversion}%</>}
              {" · "}{leads.length} lead{leads.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setAdding(true)} size="sm" className="gap-1.5">
            <Plus size={15} /> Nouveau lead
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm font-body text-muted-foreground py-12 text-center">Chargement…</p>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Handshake size={26} className="text-primary" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground mb-1">Aucun lead pour l'instant</h2>
          <p className="text-sm font-body text-muted-foreground mb-5 max-w-sm mx-auto">
            Ajoute tes prospects pour suivre la conversion, de la première prise de contact à la signature.
          </p>
          <Button onClick={() => setAdding(true)} size="sm" className="gap-1.5">
            <Plus size={15} /> Ajouter un lead
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {STATUSES.map((col) => {
            const items = byStatus[col.key];
            const colValue = items.reduce((s, l) => s + l.value, 0);
            return (
              <section key={col.key} className="flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", col.dot)} />
                    <h2 className={cn("text-eyebrow truncate", col.headerText)}>{col.label}</h2>
                    <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{items.length}</span>
                  </div>
                  {colValue > 0 && (
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 shrink-0">{chf(colValue)}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/50 py-6 text-center text-[11px] font-body text-muted-foreground/40">
                      Vide
                    </div>
                  ) : (
                    items.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onMove={(status) => { haptic("tap"); updateLead.mutate({ id: lead.id, patch: { status } }); }}
                        onDelete={() => deleteLead.mutate(lead.id)}
                        onConvert={() => convertToClient(lead)}
                        onViewClient={() => lead.convertedClientId && navigate(`/clients/${lead.convertedClientId}`)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <AddLeadDialog
        open={adding}
        onOpenChange={setAdding}
        onCreate={(data) => createLead.mutate(data, { onSuccess: () => { haptic("success"); setAdding(false); } })}
        pending={createLead.isPending}
      />
    </div>
  );
}

function LeadCard({ lead, onMove, onDelete, onConvert, onViewClient }: {
  lead: Lead;
  onMove: (s: LeadStatus) => void;
  onDelete: () => void;
  onConvert: () => void;
  onViewClient: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !!lead.nextFollowUp && lead.nextFollowUp < today && lead.status !== "won" && lead.status !== "lost";
  const others = STATUSES.filter((s) => s.key !== lead.status);
  const closed = lead.status === "won" || lead.status === "lost";

  return (
    <div className={cn(
      "rounded-2xl border border-border bg-card shadow-card p-3 group relative transition-all hover:shadow-raised hover:-translate-y-px",
      closed && "opacity-70",
    )}>
      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors" aria-label="Actions">
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Déplacer vers</DropdownMenuLabel>
            {others.map((s) => (
              <DropdownMenuItem key={s.key} onClick={() => onMove(s.key)}>
                <ArrowRightLeft size={13} className="mr-2 text-muted-foreground" />
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {lead.convertedClientId ? (
              <DropdownMenuItem onClick={onViewClient}>
                <UserCheck size={13} className="mr-2 text-emerald-600" /> Voir la fiche client
              </DropdownMenuItem>
            ) : lead.status !== "lost" ? (
              <DropdownMenuItem onClick={onConvert}>
                <UserPlus size={13} className="mr-2 text-primary" /> Convertir en client
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 size={13} className="mr-2" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="font-body font-semibold text-sm text-foreground pr-6 leading-snug break-words">{lead.name}</p>
      {lead.company && (
        <p className="mt-0.5 flex items-center gap-1 text-xs font-body text-muted-foreground truncate">
          <Building2 size={11} className="shrink-0" /> {lead.company}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {lead.value > 0 && (
          <span className="text-[11px] font-mono font-semibold tabular-nums text-foreground/80">{chf(lead.value)}</span>
        )}
        {lead.source && (
          <span className="text-[9px] font-body font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{lead.source}</span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] font-body text-muted-foreground/70">
        {lead.email && (
          <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-foreground truncate max-w-[140px]" title={lead.email}>
            <Mail size={10} /> {lead.email}
          </a>
        )}
        {lead.nextFollowUp && (
          <span className={cn("inline-flex items-center gap-1 tabular-nums", overdue && "text-destructive font-semibold")}>
            <CalendarClock size={10} /> {lead.nextFollowUp.slice(5)}
          </span>
        )}
      </div>
    </div>
  );
}

function AddLeadDialog({
  open, onOpenChange, onCreate, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (data: { name: string; company?: string; email?: string; source?: string; value?: number; nextFollowUp?: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [value, setValue] = useState("");
  const [followUp, setFollowUp] = useState("");

  function submit() {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      company: company.trim() || undefined,
      email: email.trim() || undefined,
      source: source.trim() || undefined,
      value: value ? Math.max(0, parseInt(value, 10) || 0) : undefined,
      nextFollowUp: followUp || undefined,
    });
    setName(""); setCompany(""); setEmail(""); setSource(""); setValue(""); setFollowUp("");
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Handshake size={16} className="text-primary" /> Nouveau lead
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label htmlFor="lead-name" className="text-xs">Nom *</Label>
            <Input id="lead-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact"
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { e.preventDefault(); submit(); } }} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="lead-company" className="text-xs">Société</Label>
              <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optionnel" />
            </div>
            <div className="w-28 space-y-1">
              <Label htmlFor="lead-value" className="text-xs">Valeur (CHF)</Label>
              <Input id="lead-value" type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-email" className="text-xs">Email</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@exemple.ch" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="lead-source" className="text-xs">Source</Label>
              <Input id="lead-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Réseau, site, recommandation…" list="lead-sources" />
              <datalist id="lead-sources">
                <option value="Recommandation" /><option value="Site web" /><option value="Réseau" /><option value="LinkedIn" /><option value="Salon" />
              </datalist>
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="lead-followup" className="text-xs">Relance le</Label>
              <Input id="lead-followup" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </div>
          </div>
        </div>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!name.trim() || pending}>Ajouter</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
