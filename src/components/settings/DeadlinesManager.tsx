import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, Trash2, Loader2, Check, Repeat, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  listDeadlines, createDeadline, updateDeadline, deleteDeadline,
  type AdminDeadline, type NewDeadline, type DeadlineRecurrence,
} from "@/api/adminDeadlines";

const KEY = ["admin-deadlines"] as const;

const CATEGORIES = ["Général", "TVA", "AVS", "Comptabilité", "Administratif", "Client"];
const RECURRENCES: Array<{ value: "" | DeadlineRecurrence; label: string }> = [
  { value: "",          label: "Une fois" },
  { value: "weekly",    label: "Hebdo" },
  { value: "monthly",   label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "biannual",  label: "Semestriel" },
  { value: "yearly",    label: "Annuel" },
];

/** Soonest future YYYY-MM-DD among a set of [month, day] anchors. */
function soonestFutureDate(anchors: Array<[number, number]>): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = anchors
    .flatMap(([m, day]) => [new Date(today.getFullYear(), m - 1, day), new Date(today.getFullYear() + 1, m - 1, day)])
    .filter((x) => x.getTime() >= today.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Swiss solo-studio fiscal calendar — recurring, the cron rolls them forward.
 *  Dates are sensible defaults the operator can fine-tune. */
const SWISS_FISCAL: NewDeadline[] = [
  { title: "Décompte TVA trimestriel", dueDate: soonestFutureDate([[5, 31], [8, 31], [11, 30], [2, 28]]), category: "TVA", recurring: "quarterly", remindDays: 14, description: "Décompte TVA à remettre (ajuste selon ta méthode : effective ou TDFN)." },
  { title: "Acompte AVS/AI/APG", dueDate: soonestFutureDate([[4, 10], [7, 10], [10, 10], [1, 10]]), category: "AVS", recurring: "quarterly", remindDays: 14, description: "Acompte de cotisations sociales (caisse de compensation)." },
  { title: "Bouclement comptable annuel", dueDate: soonestFutureDate([[3, 31]]), category: "Comptabilité", recurring: "yearly", remindDays: 30, description: "Clôture de l'exercice précédent + déclaration d'impôt." },
];

function daysLabel(due: string): { label: string; cls: string } {
  const d = Math.ceil((new Date(due + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (d < 0)   return { label: `+${Math.abs(d)}j retard`, cls: "text-red-600" };
  if (d === 0) return { label: "Aujourd'hui", cls: "text-red-600" };
  if (d <= 7)  return { label: `dans ${d}j`, cls: "text-amber-600" };
  return { label: `dans ${d}j`, cls: "text-muted-foreground" };
}

export function DeadlinesManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [category, setCategory] = useState("Général");
  const [recurring, setRecurring] = useState<"" | DeadlineRecurrence>("");
  const [remindDays, setRemindDays] = useState(7);
  const [seeding, setSeeding] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: listDeadlines, staleTime: 30_000 });
  const items = data ?? [];
  const hasFiscal = items.some((d) => ["TVA", "AVS", "Comptabilité"].includes(d.category));

  const create = useMutation({
    mutationFn: (d: NewDeadline) => createDeadline(d),
    onError: (e) => toast({ title: "Échec", description: e instanceof Error ? e.message : "Réessaye ?", variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => updateDeadline(id, { completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDeadline(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<AdminDeadline[]>(KEY);
      qc.setQueryData<AdminDeadline[]>(KEY, (p) => (p ?? []).filter((d) => d.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); toast({ title: "Suppression échouée", variant: "destructive" }); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const canAdd = title.trim().length > 0 && !!due && !create.isPending;

  function add() {
    create.mutate(
      { title: title.trim(), dueDate: due, category, recurring: recurring || null, remindDays },
      {
        onSuccess: () => {
          setTitle(""); setDue(""); setCategory("Général"); setRecurring(""); setRemindDays(7);
          qc.invalidateQueries({ queryKey: KEY });
          toast({ title: "Échéance ajoutée", description: "Tu seras notifié à l'approche." });
        },
      },
    );
  }

  async function seedFiscal() {
    setSeeding(true);
    try {
      for (const d of SWISS_FISCAL) {
        await createDeadline(d).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Calendrier fiscal ajouté", description: "TVA · AVS · bouclement — ajuste les dates si besoin." });
    } finally {
      setSeeding(false);
    }
  }

  const sorted = [...items].sort(
    (a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate),
  );

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <CalendarClock size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Échéances & deadlines
        </h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs font-body text-muted-foreground/70 leading-relaxed">
          Tes dates clés (TVA, AVS, administratif…). Tu es notifié à l'approche (cloche + push) et les échéances récurrentes se reportent toutes seules. Les factures et fins de projet sont déjà détectées automatiquement.
        </p>

        {!hasFiscal && (
          <button
            onClick={seedFiscal}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-2 text-xs font-body font-medium rounded-lg border border-dashed border-primary/40 text-primary py-2 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {seeding ? <Loader2 size={13} className="animate-spin" /> : <Landmark size={13} />}
            Ajouter le calendrier fiscal suisse (TVA · AVS · bouclement)
          </button>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canAdd) add(); }}
              placeholder="Échéance — ex. Décompte TVA Q2"
              maxLength={255}
              className="h-9 text-sm font-body"
            />
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 text-sm font-body sm:w-44" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs font-body">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={recurring} onChange={(e) => setRecurring(e.target.value as "" | DeadlineRecurrence)} className="h-9 rounded-md border border-input bg-background px-2 text-xs font-body">
              {RECURRENCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
              Rappel
              <Input type="number" min={0} max={90} value={remindDays} onChange={(e) => setRemindDays(Math.max(0, Math.min(90, parseInt(e.target.value, 10) || 0)))} className="h-9 w-16 text-sm font-mono" />
              j avant
            </label>
            <Button size="sm" className="h-9 ml-auto" disabled={!canAdd} onClick={add}>
              {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
        ) : sorted.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground/50 italic py-1">Aucune échéance enregistrée.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {sorted.map((d) => {
              const dl = daysLabel(d.dueDate);
              return (
                <li key={d.id} className={cn("flex items-center gap-3 py-2.5", d.completed && "opacity-50")}>
                  <button
                    onClick={() => toggle.mutate({ id: d.id, completed: !d.completed })}
                    className={cn(
                      "w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                      d.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-emerald-500",
                    )}
                    aria-label={d.completed ? "Rouvrir" : "Marquer fait"}
                  >
                    {d.completed && <Check size={11} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-body font-medium text-foreground/90 truncate", d.completed && "line-through")}>{d.title}</p>
                    <p className="text-[11px] font-body text-muted-foreground/70 flex items-center gap-1.5">
                      <span className="px-1.5 rounded-full bg-secondary text-[10px]">{d.category}</span>
                      {d.recurring && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground/60">
                          <Repeat size={9} />{RECURRENCES.find((r) => r.value === d.recurring)?.label}
                        </span>
                      )}
                    </p>
                  </div>
                  {!d.completed && <span className={cn("text-[11px] font-mono shrink-0", dl.cls)}>{dl.label}</span>}
                  <button
                    onClick={() => remove.mutate(d.id)}
                    disabled={remove.isPending}
                    className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                    aria-label="Supprimer l'échéance"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
