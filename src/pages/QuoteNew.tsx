import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookmarkCheck, FilePlus2 } from "lucide-react";
import { createEmptyQuote, nextQuoteNumber } from "@/types/quote";

export default function QuoteNew() {
  const { t, lang } = useLanguage();
  const { quotes } = useQuotes();
  const { clients } = useClients();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("clientId");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Prefill from a client fiche (?clientId=…): seed a blank quote with that
  // client's coordinates. A chosen template still wins (it carries its own client).
  const prefillClient = clientId ? clients.find((c) => c.id === clientId) ?? null : null;
  const clientInitial = useMemo(() => {
    if (!prefillClient) return null;
    return {
      ...createEmptyQuote(lang),
      clientName: prefillClient.name,
      clientEmail: prefillClient.email ?? "",
      clientCompany: prefillClient.organization ?? "",
      clientAddress: prefillClient.address ?? "",
    };
  }, [prefillClient, lang]);

  const templates = useMemo(
    () => quotes.filter((q) => q.isTemplate === true),
    [quotes],
  );
  const selectedTemplate = useMemo(
    () => (templateId ? quotes.find((q) => q.id === templateId) ?? null : null),
    [templateId, quotes],
  );

  // Convert the picked template into a fresh, editable starting state for the
  // form: drop the template flag, generate a new auto-number, reset status,
  // and give every line a fresh ID so edits don't leak back to the template.
  const initial = useMemo(() => {
    if (!selectedTemplate) return null;
    const { id: _id, createdAt: _createdAt, ...rest } = selectedTemplate;
    const docType = rest.docType ?? "quote";
    return {
      ...rest,
      isTemplate: false,
      templateName: null,
      invoiceStatus: "draft" as const,
      quoteNumber: nextQuoteNumber(
        quotes.filter((q) => q.isTemplate !== true),
        docType,
      ),
      lineItems: rest.lineItems.map((line) => ({
        ...line,
        id: crypto.randomUUID?.() ?? `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })),
    };
  }, [selectedTemplate, quotes]);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <Link to="/quotes" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t("Liste des devis", "Back to quotes")}
          </Link>
          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              {selectedTemplate && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {t("Basé sur :", "Based on:")}{" "}
                  <span className="text-foreground font-medium">
                    {selectedTemplate.templateName
                      ?? selectedTemplate.projectTitle
                      ?? selectedTemplate.quoteNumber}
                  </span>
                </span>
              )}
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    {selectedTemplate
                      ? t("Changer de modèle", "Change template")
                      : t("Partir d'un modèle…", "Start from a template…")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="p-0 w-[320px]">
                  <Command>
                    <CommandInput placeholder={t("Rechercher un modèle…", "Search templates…")} />
                    <CommandList>
                      <CommandEmpty>{t("Aucun modèle trouvé.", "No templates found.")}</CommandEmpty>
                      {selectedTemplate && (
                        <CommandGroup>
                          <CommandItem
                            value="reset-blank"
                            onSelect={() => {
                              setTemplateId(null);
                              setPickerOpen(false);
                            }}
                            className="flex items-center gap-2"
                          >
                            <FilePlus2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">
                              {t("Repartir d'un devis vierge", "Start with a blank quote")}
                            </span>
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandGroup heading={t("Modèles", "Templates")}>
                        {templates.map((tpl) => (
                          <CommandItem
                            key={tpl.id}
                            value={`${tpl.templateName ?? ""} ${tpl.projectTitle ?? ""} ${tpl.clientName ?? ""}`}
                            onSelect={() => {
                              setTemplateId(tpl.id);
                              setPickerOpen(false);
                            }}
                            className="flex items-start gap-2"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">
                                {tpl.templateName ?? tpl.projectTitle ?? tpl.quoteNumber}
                              </div>
                              {(tpl.clientName || tpl.projectTitle) && tpl.templateName && (
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {[tpl.projectTitle, tpl.clientName].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <QuoteForm key={templateId ?? (clientId ? `client-${clientId}` : "blank")} initial={initial ?? clientInitial} />
      </div>
    </div>
  );
}
