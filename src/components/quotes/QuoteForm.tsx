import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type Quote,
  type QuoteLineItem,
  createEmptyQuote,
  createEmptyLineItem,
  nextQuoteNumber,
  quoteNumberConflicts,
  TVA_RATE,
} from "@/types/quote";
import type { Client } from "@/types/client";
import type { QuotePreset } from "@/types/companySettings";
import { QuotePreview } from "./QuotePreview";
import { RichTextEditor } from "./RichTextEditor";
import { TimeImportDialog } from "./TimeImportDialog";
import { Plus, Trash2, Download, Save, Wand2, UserSearch, Check, Clock } from "lucide-react";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { printViaIframe } from "@/lib/printUtils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type QuoteFormData = Omit<Quote, "id" | "createdAt">;

interface QuoteFormProps {
  initial?: QuoteFormData | null;
  quoteId?: string | null;
  onSaved?: (quoteId: string) => void;
}

export function QuoteForm({ initial = null, quoteId = null, onSaved }: QuoteFormProps) {
  const { lang: siteLang, t: siteT } = useLanguage();
  const { quotes, addQuote, updateQuote } = useQuotes();
  const { clients } = useClients();
  const { settings: companySettings } = useCompanySettings();
  const navigate = useNavigate();

  const [data, setData] = useState<QuoteFormData>(
    () => initial ?? createEmptyQuote(siteLang)
  );

  // Always-editable quote number. We auto-fill on mount and recompute on
  // docType change ONLY when the current value still matches the previously
  // computed auto value — that way a user-typed custom number is preserved
  // across toggles while a stale auto value gets refreshed.
  const currentYear = new Date().getFullYear();
  const computedNumber = useMemo(
    () =>
      nextQuoteNumber(
        // Exclude the current quote so editing it doesn't bump the number.
        quotes.filter((q) => q.id !== quoteId),
        data.docType ?? "quote",
        currentYear,
      ),
    [quotes, quoteId, data.docType, currentYear],
  );
  const lastAutoNumberRef = useRef<string>(data.quoteNumber);

  useEffect(() => {
    // Only auto-fill if the field is empty or still matches the last value we auto-filled.
    if (data.quoteNumber && data.quoteNumber !== lastAutoNumberRef.current) return;
    if (data.quoteNumber === computedNumber) {
      lastAutoNumberRef.current = computedNumber;
      return;
    }
    lastAutoNumberRef.current = computedNumber;
    setData((prev) => ({ ...prev, quoteNumber: computedNumber }));
  }, [computedNumber, data.quoteNumber]);

  const isAutoNumber = data.quoteNumber === computedNumber;

  // Client picker — autofill name/email/company/address from an existing
  // client record, plus carry over the conditions from their most recent quote.
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // Time-tracking import — opens TimeImportDialog so the operator turns
  // tracked focus sessions into invoice line items in one click.
  const [timeImportOpen, setTimeImportOpen] = useState(false);

  function applyClient(client: Client) {
    const lastForClient = quotes
      .filter((q) => q.clientEmail?.toLowerCase() === client.email?.toLowerCase()
        || (q.clientName === client.name && !!client.name))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    setData((prev) => ({
      ...prev,
      clientName: client.name,
      clientEmail: client.email ?? prev.clientEmail,
      clientCompany: client.organization ?? prev.clientCompany,
      clientAddress: client.address ?? prev.clientAddress,
      // Only overwrite conditions when we have something to pull in,
      // and the user hasn't already typed their own.
      conditions: prev.conditions?.trim()
        ? prev.conditions
        : (lastForClient?.conditions || companySettings.defaultConditions || ""),
    }));
    setClientPickerOpen(false);
  }

  // Preview scaling. We track both:
  //   - the wrapper width (to compute the scale factor for fitting A4 across)
  //   - the actual document height (so the preview can grow past one page when
  //     the content requires it — otherwise extra pages get clipped)
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);
  // 1123px ≈ 297mm at 96dpi — single A4 page, used as a sensible default.
  const [previewContentHeight, setPreviewContentHeight] = useState(1123);

  useEffect(() => {
    const wrapper = previewRef.current;
    const content = previewContentRef.current;
    if (!wrapper || !content) return;

    function measure() {
      const w = wrapper!.clientWidth;
      // 210mm ≈ 793.7px at 96dpi
      setPreviewScale(Math.min(w / 793.7, 1));
      // Use the rendered document's natural height so the wrapper grows for
      // multi-page documents instead of clipping them at one A4.
      const naturalHeight = content!.scrollHeight || content!.offsetHeight || 1123;
      setPreviewContentHeight(Math.max(naturalHeight, 1123));
    }

    measure();
    const wrapperObs = new ResizeObserver(measure);
    wrapperObs.observe(wrapper);
    const contentObs = new ResizeObserver(measure);
    contentObs.observe(content);
    return () => {
      wrapperObs.disconnect();
      contentObs.disconnect();
    };
  }, []);

  function set<K extends keyof QuoteFormData>(key: K, value: QuoteFormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(id: string, upd: Partial<QuoteLineItem>) {
    setData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((line) =>
        line.id === id ? { ...line, ...upd } : line
      ),
    }));
  }

  function addLine() {
    setData((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, createEmptyLineItem()],
    }));
  }

  function removeLine(id: string) {
    const index = data.lineItems.findIndex((l) => l.id === id);
    if (index === -1) return;
    const removed = data.lineItems[index];
    const nextItems = data.lineItems.filter((l) => l.id !== id);
    const finalItems = nextItems.length === 0 ? [createEmptyLineItem()] : nextItems;

    setData((prev) => ({ ...prev, lineItems: finalItems }));

    toast.success(siteT("Ligne supprimée", "Line removed"), {
      duration: 6000,
      action: {
        label: siteT("Annuler", "Undo"),
        onClick: () => {
          setData((curr) => {
            // If the placeholder line is still empty and untouched, drop it before re-inserting.
            const stripped = curr.lineItems.length === 1 && curr.lineItems[0].description === "" && curr.lineItems[0].quantity === 1 && curr.lineItems[0].unitPrice === 0
              ? []
              : curr.lineItems;
            const restored = [...stripped];
            restored.splice(Math.min(index, restored.length), 0, removed);
            return { ...curr, lineItems: restored };
          });
        },
      },
    });
  }

  async function handleDownloadPdf() {
    if (!quoteId) {
      toast.error(siteT("Sauvegardez d'abord le devis", "Please save the quote first"));
      return;
    }
    const quote: Quote = { ...data, id: quoteId, createdAt: new Date().toISOString() };
    updateQuote(quoteId, quote);
    await new Promise((resolve) => setTimeout(resolve, 150));
    printViaIframe(`/quotes/${quoteId}/print`);
  }

  function handleSave() {
    // Conflict check on save: prevents two documents sharing the same number.
    if (quoteNumberConflicts(quotes, data.quoteNumber, quoteId)) {
      const suggested = nextQuoteNumber(
        quotes.filter((q) => q.id !== quoteId),
        data.docType ?? "quote",
        currentYear,
      );
      toast.error(
        siteT(
          `Le numéro ${data.quoteNumber} existe déjà. Suggestion : ${suggested}`,
          `Number ${data.quoteNumber} already exists. Suggested: ${suggested}`,
        ),
      );
      return;
    }

    const quote: Quote = {
      ...data,
      id: quoteId ?? crypto.randomUUID?.() ?? `q-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const isTpl = data.isTemplate === true;
    if (quoteId) {
      updateQuote(quoteId, quote);
      toast.success(siteT(
        isTpl ? "Modèle mis à jour" :
          data.docType === 'invoice' ? "Facture mise à jour" : "Devis mis à jour",
        isTpl ? "Template updated" :
          data.docType === 'invoice' ? "Invoice updated" : "Quote updated"
      ));
      if (onSaved) onSaved(quoteId);
    } else {
      addQuote(quote);
      toast.success(siteT(
        isTpl ? "Modèle enregistré" :
          data.docType === 'invoice' ? "Facture enregistrée" : "Devis enregistré",
        isTpl ? "Template saved" :
          data.docType === 'invoice' ? "Invoice saved" : "Quote saved"
      ));
      if (onSaved) {
        onSaved(quote.id);
      } else {
        navigate("/quotes");
      }
    }
  }

  const isFr = data.lang === "fr";

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* Form */}
      <div className="quote-form-panel space-y-8 glass-card p-6 md:p-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {data.docType === 'invoice'
                ? (isFr ? "Nouvelle facture" : "New invoice")
                : (isFr ? "Nouveau devis" : "New quote")}
            </h2>
            <div className="flex items-center gap-2">
              <Label htmlFor="quote-lang" className="text-xs text-muted-foreground whitespace-nowrap">
                {siteT("Langue", "Language")}
              </Label>
              <select
                id="quote-lang"
                value={data.lang}
                onChange={(e) => set("lang", e.target.value as "fr" | "en")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="fr">FR</option>
                <option value="en">EN</option>
              </select>
            </div>
          </div>
          {/* Doc type toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => set("docType", "quote")}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                (data.docType ?? "quote") === "quote"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {isFr ? "Devis" : "Quote"}
            </button>
            <button
              type="button"
              onClick={() => set("docType", "invoice")}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                data.docType === "invoice"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {isFr ? "Facture" : "Invoice"}
            </button>
          </div>
        </div>

        {/* Client */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {isFr ? "Client" : "Client"}
            </h3>
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5">
                  <UserSearch className="w-3.5 h-3.5" />
                  {siteT("Choisir un client existant", "Pick an existing client")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[320px]" align="end">
                <Command>
                  <CommandInput placeholder={siteT("Rechercher un client…", "Search clients…")} />
                  <CommandList>
                    <CommandEmpty>
                      {siteT("Aucun client trouvé.", "No clients found.")}
                    </CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => {
                        const selected =
                          (c.email && c.email.toLowerCase() === data.clientEmail?.toLowerCase())
                          || (!!c.name && c.name === data.clientName);
                        return (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.organization ?? ""} ${c.email ?? ""}`}
                            onSelect={() => applyClient(c)}
                            className="flex items-start gap-2"
                          >
                            <Check
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${selected ? "opacity-100 text-primary" : "opacity-0"}`}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">
                                {c.name || "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {[c.organization, c.email].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? "Nom" : "Name"} *</Label>
              <Input
                value={data.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder={siteT("Nom du client", "Client name")}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={data.clientEmail}
                onChange={(e) => set("clientEmail", e.target.value)}
                placeholder="email@exemple.ch"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? "Société" : "Company"}</Label>
              <Input
                value={data.clientCompany ?? ""}
                onChange={(e) => set("clientCompany", e.target.value)}
                placeholder={siteT("Optionnel", "Optional")}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{isFr ? "Adresse" : "Address"}</Label>
              <Input
                value={data.clientAddress ?? ""}
                onChange={(e) => set("clientAddress", e.target.value)}
                placeholder={siteT("Optionnel", "Optional")}
              />
            </div>
          </div>
        </div>

        {/* Quote meta */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            {isFr ? "Référence" : "Reference"}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  {data.docType === 'invoice'
                    ? (isFr ? "N° de facture" : "Invoice number")
                    : (isFr ? "N° de devis" : "Quote number")}
                </Label>
                {isAutoNumber && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-primary/40 text-primary bg-primary/5">
                    {siteT("Auto", "Auto")}
                  </span>
                )}
              </div>
              <Input
                value={data.quoteNumber}
                onChange={(e) => set("quoteNumber", e.target.value)}
                placeholder={data.docType === 'invoice' ? "FAC-2026-001" : "DEV-2026-001"}
                className="font-mono"
              />
              {quoteNumberConflicts(quotes, data.quoteNumber, quoteId) && (
                <p className="text-[11px] text-destructive">
                  {siteT("Ce numéro est déjà utilisé.", "This number is already in use.")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                {data.docType === 'invoice'
                  ? (isFr ? "Date de facture" : "Invoice date")
                  : (isFr ? "Validité" : "Validity date")}
              </Label>
              <Input
                type="date"
                value={data.validityDate}
                onChange={(e) => set("validityDate", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Project */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            {isFr ? "Projet" : "Project"}
          </h3>
          <div className="space-y-2">
            <Label>{isFr ? "Titre du projet" : "Project title"}</Label>
            <Input
              value={data.projectTitle}
              onChange={(e) => set("projectTitle", e.target.value)}
              placeholder={siteT("Court résumé du projet", "Short project summary")}
            />
          </div>
          <div className="space-y-2">
            <Label>{isFr ? "Description" : "Description"}</Label>
            <textarea
              value={data.projectDescription}
              onChange={(e) => set("projectDescription", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={siteT("Description rapide du projet…", "Quick project description…")}
            />
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">
              {isFr ? "Prestations" : "Line items"}
            </h3>
            <div className="flex items-center gap-2">
              {data.projectId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTimeImportOpen(true)}
                  className="text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                  title={isFr
                    ? "Convertir le temps de focus tracé en lignes de facturation"
                    : "Convert tracked focus time into invoice lines"}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  {isFr ? "Importer le temps tracé" : "Import tracked time"}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" />
                {isFr ? "Ajouter" : "Add"}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {data.lineItems.map((line) => (
              <div
                key={line.id}
                className="space-y-3 p-3 rounded-lg bg-secondary/30"
              >
                <div className="space-y-1">
                  <Label className="text-xs">{isFr ? "Prestation" : "Description"}</Label>
                  <RichTextEditor
                    value={line.description}
                    onChange={(html) => updateLine(line.id, { description: html })}
                    placeholder={
                      isFr
                        ? "Détail de la prestation…"
                        : "Service details…"
                    }
                    ariaLabel={isFr ? "Description de la prestation" : "Line item description"}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isFr ? "Quantité" : "Quantity"}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={line.quantity || ""}
                    onChange={(e) =>
                      updateLine(line.id, { quantity: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="h-9 max-w-[160px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isFr ? "Prix unitaire (CHF)" : "Unit price (CHF)"}</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    value={line.unitPrice === 0 ? "" : line.unitPrice}
                    onChange={(e) =>
                      updateLine(line.id, {
                        unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="h-9 max-w-[200px]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/60">
                  <span className="text-xs text-muted-foreground">
                    {siteT("Total ligne", "Line total")} :{" "}
                    <span className="text-foreground font-medium">
                      {new Intl.NumberFormat("fr-CH", {
                        style: "currency",
                        currency: "CHF",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      }).format(line.quantity * line.unitPrice).replace(new RegExp("(?<=\\d)[\\s\\u00A0\\u202F](?=\\d)", "g"), "'")}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive hover:text-destructive text-xs"
                    onClick={() => removeLine(line.id)}
                    disabled={data.lineItems.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {siteT("Retirer", "Remove")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TVA */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <Label htmlFor="apply-tva" className="font-medium">
              TVA {TVA_RATE}% ({isFr ? "optionnel" : "optional"})
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {isFr
                ? "Inclure la TVA suisse au devis"
                : "Include Swiss VAT on the quote"}
            </p>
          </div>
          <Switch
            id="apply-tva"
            checked={data.applyTva}
            onCheckedChange={(v) => set("applyTva", v)}
          />
        </div>

        {/* Remise */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="discount-enabled" className="font-medium">
                {siteT("Remise", "Discount")}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {siteT("Déduite avant la TVA", "Deducted before VAT")}
              </p>
            </div>
            <Switch
              id="discount-enabled"
              checked={Boolean(data.discountEnabled)}
              onCheckedChange={(v) => set("discountEnabled", v)}
            />
          </div>

          {data.discountEnabled && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">{siteT("Type", "Type")}</Label>
                <select
                  value={data.discountType ?? "amount"}
                  onChange={(e) => set("discountType", e.target.value as "amount" | "percent")}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="amount">{siteT("Montant (CHF)", "Amount (CHF)")}</option>
                  <option value="percent">{siteT("Pourcentage (%)", "Percent (%)")}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{siteT("Valeur", "Value")}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={data.discountValue ?? 0}
                  onChange={(e) => set("discountValue", Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label className="text-xs">{siteT("Libellé (optionnel)", "Label (optional)")}</Label>
                <Input
                  value={data.discountLabel ?? ""}
                  onChange={(e) => set("discountLabel", e.target.value)}
                  placeholder={siteT("Remise", "Discount")}
                />
              </div>
            </div>
          )}
        </div>

        {/* Conditions */}
        <div className="space-y-2">
          <Label>{isFr ? "Conditions générales" : "Terms and conditions"}</Label>
          <PresetPills
            presets={companySettings.conditionsPresets}
            onApply={(content) => set("conditions", content)}
            currentValue={data.conditions}
            emptyHint={isFr ? "Aucun modèle. Ajoutez-en dans Réglages." : "No presets. Add some in Settings."}
          />
          <textarea
            value={data.conditions}
            onChange={(e) => set("conditions", e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            placeholder={
              isFr
                ? "Devis valable 30 jours, conditions d'annulation…"
                : "Quote valid for 30 days, cancellation terms…"
            }
          />
        </div>

        {/* Payment terms — kept inside the form column so the sticky
            preview on the right doesn't overlap it. */}
        <div className="space-y-2">
          <Label>{isFr ? "Modalités de paiement" : "Payment terms"}</Label>
          <PresetPills
            presets={companySettings.paymentTermsPresets}
            onApply={(content) => set("paymentTerms", content)}
            currentValue={data.paymentTerms ?? ""}
            emptyHint={isFr ? "Aucun modèle. Ajoutez-en dans Réglages." : "No presets. Add some in Settings."}
          />
          <textarea
            value={data.paymentTerms ?? ""}
            onChange={(e) => set("paymentTerms", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            placeholder={
              isFr
                ? "50% à la commande, 50% à la livraison…"
                : "50% upfront, 50% on delivery…"
            }
          />
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch
                checked={data.isTemplate ?? false}
                onCheckedChange={(v) => {
                  set("isTemplate", v);
                  if (!v) set("templateName", null);
                }}
              />
              <span className="text-sm text-muted-foreground">
                {siteT("Sauvegarder comme modèle", "Save as template")}
              </span>
            </label>
            {data.isTemplate && (
              <Input
                value={data.templateName ?? ""}
                onChange={(e) => set("templateName", e.target.value)}
                placeholder={siteT("Nom du modèle (ex : Audit standard)", "Template name (e.g. Standard audit)")}
                className="flex-1 min-w-[200px] h-8 text-sm"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} className="btn-primary-glow">
              <Save className="w-4 h-4 mr-2" />
              {data.isTemplate
                ? siteT(
                    quoteId ? "Mettre à jour le modèle" : "Enregistrer le modèle",
                    quoteId ? "Update template" : "Save template"
                  )
                : quoteId
                ? siteT(
                    data.docType === 'invoice' ? "Mettre à jour la facture" : "Mettre à jour le devis",
                    data.docType === 'invoice' ? "Update invoice" : "Update quote"
                  )
                : siteT(
                    data.docType === 'invoice' ? "Enregistrer la facture" : "Enregistrer le devis",
                    data.docType === 'invoice' ? "Save invoice" : "Save quote"
                  )}
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              {siteT("Imprimer / Enregistrer PDF", "Print / Save PDF")}
            </Button>
          </div>
        </div>
      </div>

      {/* Live preview — wrapper height tracks the rendered document so multi-page
          quotes are fully visible. The inner doc is scaled with transform: scale,
          which doesn't shrink layout space, so we compute the wrapper height
          manually from the measured content height × scale. */}
      <div className="quote-preview-panel lg:sticky lg:top-24">
        <p className="text-xs text-muted-foreground mb-2" data-print-hide>
          {siteT("Aperçu du devis", "Quote preview")}
          <span className="ml-2 text-muted-foreground/80">
            ({siteT("Le PDF généré sera identique.", "Generated PDF will match this exactly.")})
          </span>
        </p>
        <div
          ref={previewRef}
          className="quote-preview-wrapper rounded-xl border border-border bg-muted/30 overflow-hidden relative"
          style={{ height: `${previewContentHeight * previewScale}px` }}
        >
          <div
            ref={previewContentRef}
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: "210mm",
              transform: `scale(${previewScale})`,
            }}
          >
            <QuotePreview quote={data} />
          </div>
        </div>
      </div>

      {data.projectId && (
        <TimeImportDialog
          open={timeImportOpen}
          onClose={() => setTimeImportOpen(false)}
          projectId={data.projectId}
          quoteId={quoteId}
          onImport={(newLines) => {
            setData((prev) => {
              // Drop the empty placeholder line if it's the only one left.
              const stripped = prev.lineItems.length === 1
                && prev.lineItems[0].description === ""
                && prev.lineItems[0].quantity === 1
                && prev.lineItems[0].unitPrice === 0
                ? []
                : prev.lineItems;
              return { ...prev, lineItems: [...stripped, ...newLines] };
            });
          }}
        />
      )}

    </div>
  );
}

function PresetPills({
  presets,
  onApply,
  currentValue,
  emptyHint,
}: {
  presets: QuotePreset[];
  onApply: (content: string) => void;
  currentValue: string;
  emptyHint: string;
}) {
  if (!presets || presets.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
        <Wand2 className="w-3 h-3" /> {emptyHint}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Wand2 className="w-3 h-3 text-muted-foreground shrink-0" />
      {presets.map((p) => {
        const active = currentValue.trim() === p.content.trim();
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply(p.content)}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title={p.content}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
