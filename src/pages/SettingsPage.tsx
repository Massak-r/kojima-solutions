import { Settings, Bell, Mail, Shield, Database, Globe } from "lucide-react";
import { EmailTemplates } from "@/components/EmailTemplates";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Settings size={14} className="text-accent" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-primary-foreground/50">
              Configuration
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
            Réglages
          </h1>
          <p className="font-body text-primary-foreground/55 mt-1 text-sm">
            Email templates, notifications et préférences.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Email Templates */}
        <EmailTemplates />

        {/* Notification Preferences */}
        <NotificationSettings />

        {/* Site Info */}
        <SiteInfoSection />
      </main>
    </div>
  );
}

function NotificationSettings() {
  const { toast } = useToast();
  const [pushEnabled, setPushEnabled] = useState(() => {
    return "Notification" in window && Notification.permission === "granted";
  });

  async function requestPush() {
    if (!("Notification" in window)) {
      toast({ title: "Notifications non supportées par ce navigateur", variant: "destructive" });
      return;
    }
    const perm = await Notification.requestPermission();
    setPushEnabled(perm === "granted");
    if (perm === "granted") {
      toast({ title: "Notifications push activées" });
    } else {
      toast({ title: "Notifications refusées", variant: "destructive" });
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Bell size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Notifications
        </h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Notifications push</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Recevoir des alertes pour les nouveaux feedbacks, gates et intakes.
            </p>
          </div>
          {pushEnabled ? (
            <span className="text-xs font-body font-semibold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
              Activées
            </span>
          ) : (
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={requestPush}>
              Activer
            </Button>
          )}
        </div>

        <div className="h-px bg-border/30" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-body font-medium text-foreground">Emails automatiques</p>
            <p className="text-xs font-body text-muted-foreground/60">
              Tous les emails passent par la file d'attente. Aucun envoi automatique.
            </p>
          </div>
          <span className="text-xs font-body font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
            File d'attente
          </span>
        </div>
      </div>
    </div>
  );
}

function SiteInfoSection() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Globe size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Site & Système
        </h2>
      </div>
      <div className="p-5 space-y-3">
        <InfoRow label="URL du site" value="kojima-solutions.ch" />
        <InfoRow label="Emails" value="Via file d'attente (preview avant envoi)" />
        <InfoRow label="Analytics" value="Custom tracker (privacy-friendly, no cookies)" />
        <InfoRow label="Authentification" value="Mot de passe admin + email gate clients" />
        <InfoRow label="API" value="PHP + MySQL (Infomaniak)" />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs font-body text-muted-foreground">{label}</span>
      <span className="text-xs font-body font-medium text-foreground">{value}</span>
    </div>
  );
}
