import { useEffect, useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClients } from "@/contexts/ClientsContext";
import type { Client } from "@/types/client";

type FormState = Omit<Client, "id" | "createdAt" | "hourlyRate"> & {
  /** Editable as string so the empty/decimal state stays predictable in the form. */
  hourlyRateInput: string;
};

const EMPTY: FormState = { name: "", organization: "", email: "", phone: "", address: "", notes: "", hourlyRateInput: "" };

function fromClient(client: Client): FormState {
  return {
    name: client.name,
    organization: client.organization ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
    hourlyRateInput: client.hourlyRate != null ? String(client.hourlyRate) : "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Client to edit; omit/null to create a new one. */
  client?: Client | null;
}

/**
 * Shared client create/edit dialog. Used by both the répertoire (ClientsManager)
 * and the 360 fiche (ClientDetail) so the form fields and save logic live in one
 * place rather than two divergent inline forms.
 */
export function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const { addClient, updateClient } = useClients();
  const [form, setForm] = useState<FormState>(EMPTY);

  // Reset the form each time the dialog opens (or the target client changes).
  useEffect(() => {
    if (open) setForm(client ? fromClient(client) : EMPTY);
  }, [open, client]);

  function handleSave() {
    if (!form.name.trim()) return;
    const rateTrimmed = form.hourlyRateInput.trim().replace(",", ".");
    const rateValue = rateTrimmed === "" ? null : Number.parseFloat(rateTrimmed);
    const hourlyRate = rateValue != null && Number.isFinite(rateValue) && rateValue > 0 ? rateValue : null;
    const payload = {
      name: form.name.trim(),
      organization: form.organization?.trim() || undefined,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      address: form.address?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      hourlyRate,
    };
    if (client) updateClient(client.id, payload);
    else addClient(payload);
    onOpenChange(false);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{client ? "Modifier le client" : "Nouveau client"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Coordonnées et taux horaire du client.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="grid sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nom *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nom complet"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Organisation</Label>
            <Input
              value={form.organization ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              placeholder="Nom de l'entreprise"
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@exemple.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Téléphone</Label>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+41 xx xxx xx xx"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Adresse</Label>
            <Input
              value={form.address ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Rue, ville, pays"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Taux horaire personnalisé (CHF/h)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.hourlyRateInput}
              onChange={(e) => setForm((f) => ({ ...f, hourlyRateInput: e.target.value }))}
              placeholder="Laisser vide pour utiliser le taux par défaut"
            />
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Utilisé par « Importer le temps tracé » lors de la création d'une facture. Si vide, le taux par défaut (Réglages) s'applique.
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes internes sur ce client…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>
        <ResponsiveDialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>
            {client ? "Mettre à jour" : "Ajouter"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
