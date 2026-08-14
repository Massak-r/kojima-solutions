import { useState } from "react";
import { Vibrate } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from "@/lib/haptics";

/**
 * Vibration is the one piece of feedback the app puts in your hand rather than
 * on the screen, so it gets an explicit off switch — and a way to feel it before
 * committing, since nobody can judge a haptic from a description.
 */
export function HapticsSettings() {
  const supported = hapticsSupported();
  const [on, setOn] = useState(() => hapticsEnabled());

  function toggle(next: boolean) {
    setOn(next);
    setHapticsEnabled(next);
    if (next) haptic("success"); // confirm in the medium being enabled
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Vibrate size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Retour tactile
        </h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Vibration</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Une pulsation très courte quand tu valides ou balayes une ligne. Jamais sur un simple tap.
            </p>
          </div>
          <Switch checked={on} onCheckedChange={toggle} disabled={!supported} />
        </div>

        {supported ? (
          <>
            <div className="h-px bg-border/30" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-body font-medium text-foreground">Essayer</p>
                <p className="text-xs font-body text-muted-foreground/60">
                  Sens la pulsation avant de décider.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!on}
                onClick={() => haptic("success")}
              >
                Vibrer
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs font-body text-muted-foreground/60">
            Cet appareil ne gère pas la vibration. Le réglage s'applique depuis ton téléphone.
          </p>
        )}
      </div>
    </div>
  );
}
