import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Pencil, FolderKanban, FileText,
  TrendingUp, Clock, ExternalLink,
} from "lucide-react";
import { useClients } from "@/contexts/ClientsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { formatCHF } from "@/components/accounting/utils";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", "in-progress": "En cours", completed: "Terminé", "on-hold": "En pause",
};

const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:         { label: "Brouillon", cls: "text-muted-foreground border-border" },
  "to-validate": { label: "À valider", cls: "text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-500/40" },
  validated:     { label: "Validé",    cls: "text-sky-700 dark:text-sky-300 border-sky-300/60 dark:border-sky-500/40" },
  paid:          { label: "Payé",      cls: "text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/40" },
  "on-hold":     { label: "En pause",  cls: "text-muted-foreground border-border" },
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { quotes } = useQuotes();
  const client = clients.find((c) => c.id === id);

  const data = useMemo(() => {
    if (!client) return null;
    const clientProjects = projects.filter((p) => p.clientId === client.id);
    const projIds = new Set(clientProjects.map((p) => p.id));
    const email = client.email?.toLowerCase();
    const clientQuotes = quotes
      .filter((q) =>
        !q.isTemplate &&
        ((q.projectId && projIds.has(q.projectId)) || (!!email && q.clientEmail?.toLowerCase() === email)),
      )
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const sum = (list: typeof clientQuotes) => list.reduce((s, q) => s + totalQuote(q), 0);
    return {
      clientProjects,
      clientQuotes,
      revenue: sum(clientQuotes.filter((q) => q.invoiceStatus === "paid")),
      outstanding: sum(clientQuotes.filter((q) => q.invoiceStatus === "validated" || q.invoiceStatus === "to-validate")),
      activeCount: clientProjects.filter((p) => p.status === "in-progress").length,
    };
  }, [client, projects, quotes]);

  if (!client || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground font-body">Client introuvable.</p>
        <Link to="/clients" className="text-primary hover:underline text-sm">← Retour aux clients</Link>
      </div>
    );
  }

  const stats = [
    { label: "CA encaissé", value: formatCHF(data.revenue), sub: undefined as string | undefined, icon: TrendingUp, cls: "text-emerald-600" },
    { label: "En attente", value: formatCHF(data.outstanding), sub: undefined, icon: Clock, cls: data.outstanding > 0 ? "text-amber-600" : "" },
    { label: "Projets", value: String(data.clientProjects.length), sub: `${data.activeCount} actif${data.activeCount !== 1 ? "s" : ""}`, icon: FolderKanban, cls: "" },
    { label: "Devis", value: String(data.clientQuotes.length), sub: undefined, icon: FileText, cls: "" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/clients")}
            className="flex items-center gap-1.5 text-primary-foreground/70 hover:text-primary-foreground text-sm font-body mb-3"
          >
            <ArrowLeft size={15} /> Clients
          </button>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">{client.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm font-body text-primary-foreground/70">
                {client.organization && <span className="flex items-center gap-1"><Building2 size={13} /> {client.organization}</span>}
                {client.email && <span className="flex items-center gap-1"><Mail size={13} /> {client.email}</span>}
                {client.phone && <span className="flex items-center gap-1"><Phone size={13} /> {client.phone}</span>}
                {client.address && <span className="flex items-center gap-1"><MapPin size={13} /> {client.address}</span>}
                {client.hourlyRate != null && <span className="flex items-center gap-1">{client.hourlyRate} CHF/h</span>}
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate("/clients")}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1.5"
            >
              <Pencil size={14} /> Gérer
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-1">
                <s.icon size={12} /> {s.label}
              </div>
              <p className={cn("font-display text-xl font-bold tabular-nums", s.cls)}>{s.value}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground font-body mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        <SectionCard icon={FolderKanban} title="Projets" subtitle={String(data.clientProjects.length)} bodyClassName="p-0">
          {data.clientProjects.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground font-body">Aucun projet pour ce client.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.clientProjects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => navigate(`/project/${p.id}/etapes`)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <span className="font-body text-sm font-medium text-foreground truncate">{p.title || "(Sans titre)"}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{PROJECT_STATUS_LABEL[p.status] ?? p.status}</Badge>
                      <ExternalLink size={13} className="text-muted-foreground/40" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard icon={FileText} title="Devis & factures" subtitle={String(data.clientQuotes.length)} bodyClassName="p-0">
          {data.clientQuotes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground font-body">Aucun devis pour ce client.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.clientQuotes.map((q) => {
                const st = QUOTE_STATUS[q.invoiceStatus ?? "draft"] ?? QUOTE_STATUS.draft;
                return (
                  <li key={q.id}>
                    <button
                      onClick={() => navigate(`/quotes/${q.id}`)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <span className="min-w-0 flex items-baseline gap-2">
                        <span className="font-body text-sm font-medium text-foreground shrink-0">
                          {q.quoteNumber || (q.docType === "invoice" ? "Facture" : "Devis")}
                        </span>
                        {q.projectTitle && <span className="font-body text-xs text-muted-foreground truncate">{q.projectTitle}</span>}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn("text-[10px]", st.cls)}>{st.label}</Badge>
                        <span className="font-body text-sm font-semibold tabular-nums text-foreground">{formatCHF(totalQuote(q))}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {client.notes && (
          <SectionCard title="Notes">
            <p className="font-body text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
