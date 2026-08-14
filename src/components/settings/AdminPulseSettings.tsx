import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getNotificationPrefs, updateNotificationPrefs, sendTestPush,
  type NotificationPrefs,
} from "@/api/notificationPrefs";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmtH = (h: number) => `${String(h).padStart(2, "0")}:00`;

const selectCls =
  "h-9 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50";

/** Controls for the daily admin pulse + quiet hours (consumed by digest.php). */
export function AdminPulseSettings() {
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: getNotificationPrefs,
    staleTime: 60_000,
  });
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  useEffect(() => { if (data) setPrefs(data); }, [data]);

  async function save(patch: Partial<NotificationPrefs>) {
    if (!prefs) return;
    setPrefs({ ...prefs, ...patch }); // optimistic
    try {
      await updateNotificationPrefs(patch);
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
    }
  }

  const p = prefs;
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <BellRing size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Pulse admin
        </h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Rappel admin quotidien</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Un seul push par jour de ce qui est à faire (salaire, OCAS, échéances). Silence si rien n'est dû.
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
