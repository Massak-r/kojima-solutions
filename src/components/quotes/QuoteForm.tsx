import { useEffect, useRef, useState } from "react";
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
  TVA_RATE,
} from "@/types/quote";
import { QuotePreview } from "./QuotePreview";
import { Plus, Trash2, Download, Save } from "lucide-react";
import { useQuotes } from "@/hooks/useQuotes";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { printViaIframe } from "@/lib/printUtils";

type QuoteFormData = Omit<Quote, "id" | "createdAt">;

interface QuoteFormProps {
  initial?: QuoteFormData | null;
  quoteId?: string | null;
  onSaved?: (quoteId: string) => void;
}

// Convert markdown **bold** to HTML
function markdownToHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r?\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

// Convert HTML back to markdown **bold**
function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")
    .replace(/<[^>]+>/g, "") // Remove any other HTML tags
    .trim();
}

// Rich text editor component with visual bold
function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (markdown: string) => void;
  placeholder: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const divRef = useState<{ current: HTMLDivElement | null }>({ current: null });

  useEffect(() => {
    const el = document.getElementById(id) as HTMLDivElement | null;
    if (!el || isFocused) return;
    const currentHtml = markdownToHtml(value || "");
    if (el.innerHTML !== currentHtml) {
      el.innerHTML = currentHtml;
    }
    // Show placeholder if empty
    if (!value && !isFocused) {
      el.setAttribute("data-empty", "true");
    } else {
      el.removeAttribute("data-empty");
    }
  }, [value, id, isFocused]);

  return (
    <div
      ref={(el) => {
        divRef.current = el;
        if (el && !isFocused) {
          el.innerHTML = markdownToHtml(value || "");
        }
      }}
      id={id}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        setIsFocused(false);
        const html = (e.target as HTMLDivElement).innerHTML;
        const markdown = htmlToMarkdown(html);
        onChange(markdown);
      }}
      onInput={(e) => {
        const html = (e.target as HTMLDivElement).innerHTML;
        const markdown = htmlToMarkdown(html);
        onChange(markdown);
      }}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[70px] break-words"
      style={{ minHeight: "70px" }}
      data-placeholder={placeholder}
    />
  );
}

export function QuoteForm({ initial = null, quoteId = null, onSaved }: QuoteFormProps) {
  const { lang: siteLang, t: siteT } = useLanguage();
  const { addQuote, updateQuote } = useQuotes();
  const navigate = useNavigate();

  const [data, setData] = useState<QuoteFormData>(
    () => initial ?? createEmptyQuote(siteLang)
  );

  // A4 preview scaling
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      // 210mm ≈ 793.7px at 96dpi
      setPreviewScale(Math.min(width / 793.7, 1));
    });
    observer.observe(el);
    return () => observer.disconnect();
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
    setData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((l) => l.id !== id).length
        ? prev.lineItems.filter((l) => l.id !== id)
        : [createEmptyLineItem()],
    }));
  }

  async function handleDownloadPdf() {
    if (!quoteId) {
      toast.error(siteT("Sauvegardez d'abord le devis", "Please save the quote first"));
      return;
    }
    // Persist current edits, then print silently via hidden iframe
    const quote: Quote = { ...data, id: quoteId, createdAt: new Date().toISOString() };
    updateQuote(quoteId, quote);
    await new Promise((resolve) => setTimeout(resolve, 150));
    printViaIframe(`/quotes/${quoteId}/print`);
  }

  function handleSave() {
    const quote: Quote = {
      ...data,
      id: quoteId ?? crypto.randomUUID?.() ?? `q-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    if (quoteId) {
      updateQuote(quoteId, quote);
      toast.success(siteT(
        data.docType === 'invoice' ? "Facture mise à jour" : "Devis mis à jour",
        data.docType === 'invoice' ? "Invoice updated" : "Quote updated"
      ));
      if (onSaved) onSaved(quoteId);
    } else {
      addQuote(quote);
      toast.success(siteT(
        data.docType === 'invoice' ? "Facture enregistrée" : "Devis enregistré",
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
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            {isFr ? "Client" : "Client"}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isFr ? "Nom" : "Name"} *</Label>
              <Input
                value={data.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder={siteT("Nom du client", "Client name")}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
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
              <Label>
                {data.docType === 'invoice'
                  ? (isFr ? "N° de facture" : "Invoice number")
                  : (isFr ? "N° de devis" : "Quote number")}
              </Label>
              <Input
                value={data.quoteNumber}
                onChange={(e) => set("quoteNumber", e.target.value)}
                placeholder={data.docType === 'invoice' ? "FAC-2025-001" : "DQ-2025-01XXX"}
              />
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
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">
              {isFr ? "Prestations" : "Line items"}
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-4 h-4 mr-1" />
              {isFr ? "Ajouter" : "Add"}
            </Button>
          </div>
          <div className="space-y-3">
            {data.lineItems.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-4 sm:grid-cols-12 gap-2 items-end p-3 rounded-lg bg-secondary/30"
              >
                <div className="col-span-12 sm:col-span-6 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">{isFr ? "Prestation" : "Description"}</Label>
                    <button
                      type="button"
                      className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-accent"
                      onClick={() => {
                        const el = document.getElementById(`line-desc-${line.id}`) as HTMLDivElement | null;
                        if (!el) return;
                        const selection = window.getSelection();
                        if (!selection || selection.rangeCount === 0) return;
                        const range = selection.getRangeAt(0);
                        if (range.collapsed) return;

                        // Wrap selection in <strong>
                        const strong = document.createElement("strong");
                        try {
                          range.surroundContents(strong);
                        } catch {
                          // If surroundContents fails, extract and wrap
                          const contents = range.extractContents();
                          strong.appendChild(contents);
                          range.insertNode(strong);
                        }

                        // Update description from HTML
                        const html = el.innerHTML;
                        const markdown = htmlToMarkdown(html);
                        updateLine(line.id, { description: markdown });

                        // Restore selection
                        selection.removeAllRanges();
                        const newRange = document.createRange();
                        newRange.selectNodeContents(strong);
                        newRange.collapse(false);
                        selection.addRange(newRange);
                        el.focus();
                      }}
                      title={siteT("Mettre en gras la sélection", "Bold selection")}
                    >
                      {siteT("Gras", "Bold")}
                    </button>
                  </div>
                  <RichTextEditor
                    id={`line-desc-${line.id}`}
                    value={line.description}
                    onChange={(markdown) => updateLine(line.id, { description: markdown })}
                    placeholder={
                      isFr
                        ? "Détail de la prestation… (Entrée pour un saut de ligne)"
                        : "Service details… (Enter for line break)"
                    }
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs">{isFr ? "Qté" : "Qty"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity || ""}
                    onChange={(e) =>
                      updateLine(line.id, { quantity: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="h-9"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs">{isFr ? "Prix unit." : "Unit price"}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={line.unitPrice === 0 ? "" : line.unitPrice}
                    onChange={(e) =>
                      updateLine(line.id, {
                        unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 flex items-end gap-1">
                  <span className="text-xs text-muted-foreground pb-2">
                    {new Intl.NumberFormat("fr-CH", {
                      style: "currency",
                      currency: "CHF",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(line.quantity * line.unitPrice).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'")}
                  </span>
                </div>
                <div className="col-span-12 sm:col-span-1 flex justify-end sm:justify-start pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => removeLine(line.id)}
                    disabled={data.lineItems.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
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
          <textarea
            value={data.conditions}
            onChange={(e) => set("conditions", e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            placeholder={
              isFr
                ? "Paiement à 30 jours, conditions d’annulation…"
                : "Payment within 30 days, cancellation terms…"
            }
          />
        </div>

        {/* Payment terms (invoice only) */}
        {data.docType === "invoice" && (
          <div className="space-y-2">
            <Label>{isFr ? "Modalités de paiement" : "Payment terms"}</Label>
            <textarea
              value={data.paymentTerms ?? ""}
              onChange={(e) => set("paymentTerms", e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder={
                isFr
                  ? "IBAN: CH00 0000 0000 0000 0000 0\nPaiement à 30 jours net.\nMerci pour votre confiance."
                  : "IBAN: CH00 0000 0000 0000 0000 0\nNet 30 days.\nThank you for your business."
              }
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
          <Button onClick={handleSave} className="btn-primary-glow">
            <Save className="w-4 h-4 mr-2" />
            {quoteId
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

      {/* Live preview */}
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
          style={{ aspectRatio: "210 / 297" }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: "210mm",
              minHeight: "297mm",
              transform: `scale(${previewScale})`,
            }}
          >
            <QuotePreview quote={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
