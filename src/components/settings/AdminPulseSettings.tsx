import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getNotificationPrefs, updateNotificationPrefs, sendTestPush, getPushHealth, getPulsePreview,
  type NotificationPrefs,
} from "@/api/notificationPrefs";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmtH = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** "aujourd'hui à 08:03" / "hier à 08:01" / "le 14 août à 12:00" — the shape you
 *  read at a glance, which a raw timestamp is not. */
function whenLabel(iso: string): string {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  const hm = d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86_400_000);
  if (diff === 0) return `aujourd'hui à ${hm}`;
  if (diff === 1) return `hier à ${hm}`;
  return `le ${d.toLocaleDateString("fr-CH", { day: "numeric", month: "long" })} à ${hm}`;
}

const selectCls =
  "h-9 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50";

/** Controls for the daily admin pulse + quiet hours (consumed by digest.php). */
export function AdminPulseSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: getNotificationPrefs,
    staleTime: 60_000,
  });
  // What actually left the server. Without it, "je ne reçois rien" and "rien
  // n'était dû" are the same screen.
  const { data: health } = useQuery({
    queryKey: ["push-health"],
    queryFn: getPushHealth,
    staleTime: 30_000,
  });
  // What the next pulse would actually say, composed server-side from the same
  // code that sends it — so the wording can be judged without waiting for 8am.
  const { data: preview } = useQuery({
    queryKey: ["pulse-preview"],
    queryFn: getPulsePreview,
    staleTime: 30_000,
  });
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  useEffect(() => { if (data) setPrefs(data); }, [data]);

  async function save(patch: Partial<NotificationPrefs>) {
    if (!prefs) return;
    setPrefs({ ...prefs, ...patch }); // optimistic
    try {
      await updateNotificationPrefs(patch);
      // Le style et le délai changent le texte du prochain rappel : l'aperçu
      // doit suivre, sinon il affiche une notification qui n'existe plus.
      void qc.invalidateQueries({ queryKey: ["pulse-preview"] });
    } catch {
      toast({ title: "Échec de l'enregistrement", variant: "destructive" });
    }
  }

  // A test send is the only way to catch a subscription that silently died —
  // otherwise a broken phone just looks like "nothing was due today".
  const [testing, setTesting] = useState(false);
  async function runTest() {
    setTesting(true);
    try {
      const r = await sendTestPush();
      toast(
        r.sent > 0
          ? {
              title: `Test envoyé à ${r.sent} appareil${r.sent > 1 ? "s" : ""}`,
              description: "Rien reçu ? Vérifie les notifications autorisées pour Kojima.",
            }
          : {
              title: "Aucun appareil abonné",
              description: "Ouvre Kojima sur ton téléphone et autorise les notifications.",
              variant: "destructive",
            },
      );
    } catch {
      toast({ title: "Échec de l'envoi du test", variant: "destructive" });
    } finally {
      setTesting(false);
      void qc.invalidateQueries({ queryKey: ["push-health"] });
    }
  }

  const p = prefs;
  // Green only when a real device is listening AND the last send reached one.
  // A send accepted by nobody is the exact failure this panel exists to expose.
  const healthy = !!health && health.subscriptions > 0 && (health.lastPush?.sent ?? 0) > 0;
  const pulseDaysLastWeek = health
    ? health.pulseDays.filter((d) => {
        const t = new Date(d.date + "T00:00:00").getTime();
        return Number.isFinite(t) && Date.now() - t < 7 * 86_400_000;
      }).length
    : null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <BellRing size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Pulse admin
        </h2>
      </div>
      <div className="p-5 space-y-4">
        {health && (
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3",
              healthy ? "border-palette-sage/30 bg-palette-sage/5" : "border-palette-amber/40 bg-palette-amber/5",
            )}
          >
            {healthy
              ? <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-palette-sage" />
              : <AlertTriangle size={15} className="shrink-0 mt-0.5 text-palette-amber" />}
            <div className="min-w-0">
              <p className="text-sm font-body font-medium text-foreground">
                {health.lastPush
                  ? `Dernier envoi ${whenLabel(health.lastPush.createdAt)}`
                  : "Aucun envoi encore enregistré"}
              </p>
              <p className="text-xs font-body text-muted-foreground/70 mt-0.5 break-words">
                {health.subscriptions === 0
                  ? "Aucun téléphone abonné — ouvre Kojima sur ton mobile et autorise les notifications."
                  : health.lastPush
                    ? `« ${health.lastPush.title} » · reçu par ${health.lastPush.sent} appareil${health.lastPush.sent > 1 ? "s" : ""}`
                    : "Le journal démarre maintenant : le prochain rappel s'affichera ici."}
              </p>
              {pulseDaysLastWeek !== null && (
                <p className="text-xs font-body text-muted-foreground/60 mt-1">
                  Pulse quotidien : parti {pulseDaysLastWeek} jour{pulseDaysLastWeek > 1 ? "s" : ""} sur les 7 derniers.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Rappel admin quotidien</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Un push par jour de ce qui reste à faire — tâches du jour, paiements, échéances —
              et il revient chaque jour tant que ce n'est pas coché. Silence si rien n'est dû.
            </p>
          </div>
          <Switch
            checked={!!p?.adminPulseEnabled}
            onCheckedChange={(v) => save({ adminPulseEnabled: v })}
            disabled={!p}
          />
        </div>

        <div className="h-px bg-border/30" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Une notification par tâche</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Au lieu d'un seul rappel groupé, une notification par chose à faire (5 au maximum),
              qu'on écarte une par une.
            </p>
          </div>
          <Switch
            checked={p?.pulseStyle === "per_task"}
            onCheckedChange={(v) => save({ pulseStyle: v ? "per_task" : "digest" })}
            disabled={!p}
          />
        </div>

        <div className="h-px bg-border/30" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Heure du rappel</p>
            <p className="text-xs font-body text-muted-foreground/60">Le pulse part à partir de cette heure.</p>
          </div>
          <select
            className={selectCls}
            value={p?.pulseHour ?? 8}
            disabled={!p}
            onChange={(e) => save({ pulseHour: Number(e.target.value) })}
          >
            {HOURS.slice(5, 12).map((h) => <option key={h} value={h}>{fmtH(h)}</option>)}
          </select>
        </div>

        <div className="h-px bg-border/30" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Prévenir à l'avance</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Combien de jours avant l'échéance une facture commence à être annoncée.
            </p>
          </div>
          <select
            className={selectCls}
            value={p?.pulseLeadDays ?? 3}
            disabled={!p}
            onChange={(e) => save({ pulseLeadDays: Number(e.target.value) })}
          >
            {[3, 5, 7, 10, 14, 21, 30].map((d) => (
              <option key={d} value={d}>{d} jours</option>
            ))}
          </select>
        </div>

        <div className="h-px bg-border/30" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Heures silencieuses</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Aucune notification poussée pendant cette plage (elles partent après).
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              className={selectCls}
              value={p?.quietStart ?? 21}
              disabled={!p}
              onChange={(e) => save({ quietStart: Number(e.target.value) })}
            >
              {HOURS.map((h) => <option key={h} value={h}>{fmtH(h)}</option>)}
            </select>
            <span className="text-muted-foreground text-sm">→</span>
            <select
              className={selectCls}
              value={p?.quietEnd ?? 8}
              disabled={!p}
              onChange={(e) => save({ quietEnd: Number(e.target.value) })}
            >
              {HOURS.map((h) => <option key={h} value={h}>{fmtH(h)}</option>)}
            </select>
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Aperçu — composé par le serveur, avec le code qui envoie réellement. */}
        <div>
          <p className="text-sm font-body font-medium text-foreground">Prochain rappel</p>
          {preview ? (
            preview.count === 0 ? (
              <p className="text-xs font-body text-muted-foreground/60 mt-1">
                Rien à annoncer pour l'instant — le rappel de {fmtH(preview.nextHour)} restera silencieux.
              </p>
            ) : (
              <>
                <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-sm font-body font-semibold text-foreground break-words">
                    {preview.title}
                  </p>
                  {preview.body && (
                    <p className="text-xs font-body text-muted-foreground mt-1 whitespace-pre-line break-words">
                      {preview.body}
                    </p>
                  )}
                </div>
                <p className="text-xs font-body text-muted-foreground/60 mt-1.5">
                  {preview.style === "per_task"
                    ? `${Math.min(preview.count, 5)} notification${Math.min(preview.count, 5) > 1 ? "s" : ""} partiront à ${fmtH(preview.nextHour)}, une par tâche.`
                    : `${preview.count} chose${preview.count > 1 ? "s" : ""} en attente · départ à ${fmtH(preview.nextHour)}.`}
                </p>
              </>
            )
          ) : (
            <p className="text-xs font-body text-muted-foreground/60 mt-1">Chargement…</p>
          )}
        </div>

        <div className="h-px bg-border/30" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Tester sur ce téléphone</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Envoie une notification tout de suite, sans attendre le rappel du matin.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={testing}
            onClick={runTest}
          >
            {testing ? "Envoi…" : "Envoyer un test"}
          </Button>
        </div>
      </div>
    </div>
  );
}
