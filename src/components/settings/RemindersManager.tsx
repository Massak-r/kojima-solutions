import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, BellRing, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { listReminders, createReminder, deleteReminder, type PushReminder } from "@/api/pushReminders";

const KEY = ["push-reminders", "upcoming"] as const;

/** scheduled_at is stored/returned in UTC ("YYYY-MM-DD HH:MM:SS"); render it
 *  back in the operator's local time. */
function formatWhen(utc: string): string {
  const d = new Date(utc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return utc;
  return new Intl.DateTimeFormat("fr-CH", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** datetime-local min = now (local wall clock). */
function nowLocalInput(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function RemindersManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: () => listReminders("upcoming"),
    staleTime: 30_000,
  });
  const items = data?.items ?? [];

  const create = useMutation({
    mutationFn: () =>
      createReminder({ title: title.trim(), scheduledAt: new Date(when).toISOString() }),
    onSuccess: () => {
      setTitle("");
      setWhen("");
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Rappel programmé", description: "Tu recevras une notification le moment venu." });
    },
    onError: (e) =>
      toast({ title: "Échec", description: e instanceof Error ? e.message : "Réessaye ?", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<{ items: PushReminder[] }>(KEY);
      qc.setQueryData<{ items: PushReminder[] }>(KEY, (p) => (p ? { items: p.items.filter((i) => i.id !== id) } : p));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast({ title: "Suppression échouée", variant: "destructive" });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const canAdd = title.trim().length > 0 && !!when && !create.isPending;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <CalendarClock size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Rappels programmés
        </h2>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs font-body text-muted-foreground/70 leading-relaxed">
          Programme un rappel — tu reçois une notification push à l'heure dite (précision ~20 min, selon la fréquence du cron). Active d'abord les notifications ci-dessus.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canAdd) create.mutate(); }}
            placeholder="Rappeler quoi ?"
            maxLength={255}
            className="h-9 text-sm font-body flex-1"
          />
          <Input
            type="datetime-local"
            value={when}
            min={nowLocalInput()}
            onChange={(e) => setWhen(e.target.value)}
            className="h-9 text-sm font-body sm:w-56"
          />
          <Button size="sm" className="h-9 shrink-0" disabled={!canAdd} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Programmer
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground/50 italic py-1">Aucun rappel programmé.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <BellRing size={14} className="text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body font-medium text-foreground/90 truncate">{r.title}</p>
                  <p className="text-[11px] font-body text-muted-foreground/70 tabular-nums">{formatWhen(r.scheduled_at)}</p>
                </div>
                <button
                  onClick={() => remove.mutate(r.id)}
                  disabled={remove.isPending}
                  className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                  aria-label="Supprimer le rappel"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
