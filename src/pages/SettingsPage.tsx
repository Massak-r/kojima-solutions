import { Settings, Bell, Globe, Receipt, Landmark, Wand2, Plus, Trash2, RotateCcw, Wrench } from "lucide-react";
import { EmailTemplates } from "@/components/EmailTemplates";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import type { CompanySettings, QuotePreset } from "@/types/companySettings";
import { apiFetch } from "@/api/client";
import {
  DEFAULT_PAYMENT_TERMS_PRESETS,
  DEFAULT_CONDITIONS_PRESETS,
} from "@/types/companySettings";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-8 px-4 sm:px-6">
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
        {/* Quote / Invoice settings */}
        <QuoteSettings />

        {/* Quote / Invoice presets */}
        <QuotePresets />

        {/* Email Templates */}
        <EmailTemplates />

        {/* Notification Preferences */}
        <NotificationSettings />

        {/* Site Info */}
        <SiteInfoSection />

        {/* Maintenance — DB migration runner */}
        <MaintenanceSection />
      </main>
    </div>
  );
}

function MaintenanceSection() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  async function runMigrations() {
    setRunning(true);
    try {
      // Backfill is INSERT IGNORE so re-running is harmless. Marks pre-cutoff
      // migrations as applied when self-healing app code beat the runner to the
      // DDL — without this, the runner halts at the first duplicate-column
      // error and never reaches newer migrations.
      await apiFetch<{ marked: string[]; skipped_newer: string[] }>(
        "_migrate_backfill.php?before=20260528120000",
        { method: "POST" }
      );
      const runner = await apiFetch<{
        migrations: { file: string; status: "applied" | "skipped" | "error"; error?: string }[];
      }>("db_migrate.php", { method: "POST" });
      const applied = runner.migrations.filter((m) => m.status === "applied");
      const errored = runner.migrations.find((m) => m.status === "error");
      if (errored) {
        toast({
          title: "Migration en erreur",
          description: `${errored.file} — ${errored.error ?? "voir logs serveur"}`,
          variant: "destructive",
        });
      } else if (applied.length > 0) {
        toast({
          title: applied.length === 1 ? "1 migration appliquée" : `${applied.length} migrations appliquées`,
          description: applied.map((m) => m.file).join(", "),
        });
      } else {
        toast({ title: "Schéma déjà à jour" });
      }
    } catch (e) {
      toast({
        title: "Échec",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Wrench size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Maintenance
        </h2>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-medium text-foreground">Appliquer les migrations en attente</p>
            <p className="text-xs font-body text-muted-foreground/70 mt-0.5">
              Débloque le runner si un schéma a été appliqué hors-bande, puis applique les migrations restantes.
            </p>
          </div>
          <Button size="sm" onClick={runMigrations} disabled={running} className="shrink-0">
            {running ? "En cours…" : "Lancer"}
          </Button>
        </div>
      </div>
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

function QuoteSettings() {
  const { settings, updateSettings } = useCompanySettings();
  const { toast } = useToast();
  const [form, setForm] = useState<CompanySettings>({ ...settings });

  function handleSave() {
    updateSettings(form);
    toast({ title: "Paramètres enregistrés" });
  }

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Receipt size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Devis & Factures
        </h2>
      </div>
      <div className="p-5 space-y-6">
        {/* Company info */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Entreprise
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom de l'entreprise</Label>
              <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsable</Label>
              <Input value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Adresse</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Site web</Label>
              <Input value={form.website} onChange={(e) => set("website", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">N° IDE</Label>
              <Input value={form.ideNumber} onChange={(e) => set("ideNumber", e.target.value)} className="text-sm" placeholder="CHE-000.000.000" />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Bank details */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Landmark size={12} className="text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Coordonnées bancaires
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Titulaire du compte</Label>
              <Input value={form.bankAccountHolder} onChange={(e) => set("bankAccountHolder", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IBAN</Label>
              <Input value={form.bankIban} onChange={(e) => set("bankIban", e.target.value)} className="text-sm font-mono" placeholder="CH00 0000 0000 0000 0000 0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">BIC / SWIFT</Label>
              <Input value={form.bankBic} onChange={(e) => set("bankBic", e.target.value)} className="text-sm font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Banque</Label>
              <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className="text-sm" />
            </div>
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Defaults */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Valeurs par défaut
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Taux horaire par défaut (CHF)</Label>
              <Input
                type="number"
                min={0}
                value={form.defaultHourlyRate}
                onChange={(e) => set("defaultHourlyRate", Math.max(0, Number(e.target.value) || 0))}
                className="text-sm w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Conditions générales par défaut</Label>
              <Textarea
                value={form.defaultConditions}
                onChange={(e) => set("defaultConditions", e.target.value)}
                rows={3}
                className="text-sm resize-none"
                placeholder="Paiement à 30 jours, conditions d'annulation..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" onClick={handleSave}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuotePresets() {
  const { settings, updateSettings } = useCompanySettings();
  const { toast } = useToast();
  const [paymentPresets, setPaymentPresets] = useState<QuotePreset[]>(
    settings.paymentTermsPresets ?? DEFAULT_PAYMENT_TERMS_PRESETS,
  );
  const [conditionsPresets, setConditionsPresets] = useState<QuotePreset[]>(
    settings.conditionsPresets ?? DEFAULT_CONDITIONS_PRESETS,
  );

  function genId(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function save() {
    updateSettings({
      paymentTermsPresets: paymentPresets,
      conditionsPresets: conditionsPresets,
    });
    toast({ title: "Modèles enregistrés" });
  }

  function resetDefaults(kind: "payment" | "conditions") {
    if (kind === "payment") setPaymentPresets(DEFAULT_PAYMENT_TERMS_PRESETS);
    else setConditionsPresets(DEFAULT_CONDITIONS_PRESETS);
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Wand2 size={14} className="text-primary" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Modèles devis & factures
        </h2>
      </div>
      <div className="p-5 space-y-6">
        <PresetGroup
          title="Modalités de paiement"
          description="Pills proposées au-dessus du champ « Modalités de paiement » lors de la création d'une facture."
          presets={paymentPresets}
          onChange={setPaymentPresets}
          onReset={() => resetDefaults("payment")}
          idPrefix="pt"
          genId={genId}
        />
        <div className="h-px bg-border/50" />
        <PresetGroup
          title="Conditions générales"
          description="Pills proposées au-dessus du champ « Conditions générales » sur tout devis ou facture."
          presets={conditionsPresets}
          onChange={setConditionsPresets}
          onReset={() => resetDefaults("conditions")}
          idPrefix="cd"
          genId={genId}
        />
        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" onClick={save}>
            Enregistrer les modèles
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresetGroup({
  title,
  description,
  presets,
  onChange,
  onReset,
  idPrefix,
  genId,
}: {
  title: string;
  description: string;
  presets: QuotePreset[];
  onChange: (next: QuotePreset[]) => void;
  onReset: () => void;
  idPrefix: string;
  genId: (prefix: string) => string;
}) {
  function update(id: string, patch: Partial<QuotePreset>) {
    onChange(presets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    onChange(presets.filter((p) => p.id !== id));
  }
  function add() {
    onChange([...presets, { id: genId(idPrefix), label: "Nouveau modèle", content: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">{description}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-[11px] h-7 text-muted-foreground hover:text-foreground gap-1"
          onClick={onReset}
          title="Restaurer les modèles par défaut"
        >
          <RotateCcw size={11} />
          Restaurer
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun modèle. Ajoutez-en avec le bouton ci-dessous.</p>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={p.label}
                  onChange={(e) => update(p.id, { label: e.target.value })}
                  placeholder="Libellé du modèle (ex. 50/50 avec acompte)"
                  className="text-sm font-medium"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => remove(p.id)}
                  title="Supprimer ce modèle"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <Textarea
                value={p.content}
                onChange={(e) => update(p.id, { content: e.target.value })}
                placeholder="Contenu inséré quand on clique sur la pill…"
                rows={3}
                className="text-sm resize-none font-mono leading-relaxed"
              />
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={add}
        className="text-xs gap-1"
      >
        <Plus size={12} />
        Ajouter un modèle
      </Button>
    </div>
  );
}
