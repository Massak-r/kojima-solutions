// Smart proposal builder. Takes a raw intake submission and returns a ready-
// to-create draft that includes everything the operator usually pastes by
// hand: module lines, base project, page extras, hosting, maintenance,
// project description summarising the modules + budget + timeline, and
// pre-selected conditions/payment presets that match the project shape.
//
// Pure function — no React, no API. The hook useConvertIntake calls it and
// hands the output to the existing createProject / addQuote / addClient
// pipeline. The preview dialog reads the same output to show the user what
// they're about to commit.
//
// Per memory feedback_no_anthropic_api: no LLM. Mapping is keyword + slug
// driven, so the operator can predict it.

import type { IntakeResponse } from "@/api/funnels";
import type { QuoteLineItem } from "@/types/quote";
import type { Client } from "@/types/client";
import type { CompanySettings } from "@/types/companySettings";
import type { ModuleComplexity } from "@/types/module";
import { ModuleResolver } from "@/lib/moduleResolver";
import { getModuleById } from "@/data/moduleCatalog";

export interface ProposalDraft {
  /** Snapshot of the resolved client identity. */
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  /** Existing client we matched, or null if a new client must be created. */
  existingClientId: string | null;

  /** Project metadata that flows into createProject() + the quote. */
  projectTitle: string;
  projectDescription: string;

  /** All quote line items (base + modules + page + hosting + maintenance). */
  lineItems: QuoteLineItem[];

  /** Pre-selected presets, sourced from companySettings.*Presets. */
  conditions: string;
  paymentTerms: string;

  /** Yearly recurring fees worth surfacing in the description (already
   *  included in the line items only when they apply this year). */
  yearlyTotal: number;
  yearlyBreakdown: { label: string; amount: number }[];

  /** Total of all one-shot line items (excludes yearly fees). */
  oneTimeTotal: number;

  /** Estimate band echoed from the intake — informational. */
  estimateBand: { low: number; high: number } | null;

  /** Source intake — kept around so the converter can flip status to
   *  "converted" after the actual creation succeeds. */
  intake: IntakeResponse;

  /** Internal — what fed the choice of conditions/payment terms. */
  reasons: string[];
}

const BASE_PROJECT_PRICE = 1500;

const PAGE_EXTRAS: Record<string, { amount: number; label: string }> = {
  multi: { amount: 500,  label: "Multi-pages (3-10)" },
  large: { amount: 1500, label: "Site étendu (10+)" },
};

const HOSTING_LINES: Record<string, { amount: number; label: string }> = {
  simple: { amount: 360, label: "Hébergement Suisse - 1 an" },
};

const MAINTENANCE_LINES: Record<string, { amount: number; label: string }> = {
  basic:  { amount: 500,  label: "Maintenance basique - 1 an (mises à jour + 1h)" },
  custom: { amount: 1000, label: "Maintenance sur mesure - 1 an (10h incluses)" },
};

const PROJECT_TYPE_LABEL: Record<string, string> = {
  "webapp":         "Web App / Outil interne",
  "pme-corporate":  "Site PME / Corporate",
  "restaurant":     "Site Restaurant / Hôtellerie",
  "evenementiel":   "Site Événementiel",
  "landing-page":   "Landing Page",
  "autre":          "Projet web",
};

/** Pick the conditions preset id that best fits the project type. */
function pickConditionsPresetId(projectSlug: string, hasCommerceModule: boolean): string {
  if (hasCommerceModule) return "cd-dev-web";
  if (projectSlug === "landing-page") return "cd-design";
  if (projectSlug === "webapp")       return "cd-dev-web";
  return "cd-dev-web";
}

/** Pick the payment terms preset id based on total + timeline. */
function pickPaymentTermsPresetId(total: number, timeline: string): string {
  // Big or urgent projects → 50/50 to lock cashflow. Otherwise end-of-service.
  if (total >= 5000) return "pt-acompte-50-50";
  if (timeline === "urgent") return "pt-acompte-50-50";
  return "pt-end-of-service";
}

function uid(): string {
  return crypto.randomUUID?.() ?? `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findPreset(presets: { id: string; content: string }[] | undefined, id: string): string {
  return presets?.find((p) => p.id === id)?.content ?? "";
}

function detectExistingClient(intake: IntakeResponse, clients: Client[]): Client | null {
  if (!intake.clientEmail) return null;
  const target = intake.clientEmail.toLowerCase();
  return clients.find((c) => c.email?.toLowerCase() === target) ?? null;
}

function sumLineItems(lines: QuoteLineItem[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

function buildDescription(intake: IntakeResponse, modules: { id: string; complexity: ModuleComplexity }[]): string {
  const r = intake.responses ?? {};
  const projectTypeLabel = (r.projectType as string) ?? "";
  const message = (r.message as string)?.trim() ?? "";
  const timeline = (r.timeline as string) ?? "";

  const lines: string[] = [];
  if (projectTypeLabel) lines.push(`Type : ${projectTypeLabel}`);
  if (timeline === "urgent")    lines.push("Timing : urgent (≤ 1 mois)");
  else if (timeline === "normal")   lines.push("Timing : 1 à 3 mois");
  else if (timeline === "flexible") lines.push("Timing : 3 mois ou plus");

  if (modules.length > 0) {
    const moduleNames = modules
      .map((m) => getModuleById(m.id)?.name)
      .filter(Boolean)
      .slice(0, 8);
    lines.push(`Modules retenus : ${moduleNames.join(", ")}`);
  }

  if (message) {
    lines.push("");
    lines.push("Message du client :");
    lines.push(message);
  }
  return lines.join("\n");
}

export function generateProposal(
  intake: IntakeResponse,
  clients: Client[],
  settings: CompanySettings,
): ProposalDraft {
  const r = intake.responses ?? {};
  const projectSlug   = (r.projectSlug as string) ?? "autre";
  const projectLabel  = (r.projectType as string) ?? PROJECT_TYPE_LABEL[projectSlug] ?? "Projet web";
  const selectedRaw   = (r.selectedModules as { id: string; complexity: string }[]) ?? [];
  const modules       = selectedRaw.map((m) => ({ id: m.id, complexity: m.complexity as ModuleComplexity }));
  const hostingTier   = (r.hostingTier as string) ?? "simple";
  const maintenance   = (r.maintenance as string) ?? "none";
  const pageCount     = (r.pageCount as string) ?? "single";
  const timeline      = (r.timeline as string) ?? "normal";
  const estimate      = r.estimate as { low?: number; high?: number; yearly?: number } | undefined;
  const company       = (r.company as string) ?? "";

  const existing      = detectExistingClient(intake, clients);
  const reasons: string[] = [];

  // ── Build line items ───────────────────────────────────────────────
  const lineItems: QuoteLineItem[] = [];

  // Base project (design + responsive + deploy)
  lineItems.push({
    id: uid(),
    description: "Base projet (design, responsive, mise en ligne)",
    quantity: 1,
    unitPrice: BASE_PROJECT_PRICE,
  });
  reasons.push("base 1500");

  // Module lines (already richly described by ModuleResolver)
  const moduleLines = new ModuleResolver(
    modules.map((m) => ({ moduleId: m.id, complexity: m.complexity })),
  ).toQuoteLines();
  lineItems.push(...moduleLines);
  if (moduleLines.length > 0) reasons.push(`${moduleLines.length} modules`);

  // Page count extra
  const pageRule = PAGE_EXTRAS[pageCount];
  if (pageRule) {
    lineItems.push({
      id: uid(),
      description: `Pages supplémentaires (${pageRule.label})`,
      quantity: 1,
      unitPrice: pageRule.amount,
    });
    reasons.push(`page extra ${pageRule.amount}`);
  }

  // Hosting (yearly fee — included as a line for transparency)
  const hostingRule = HOSTING_LINES[hostingTier];
  const yearlyBreakdown: { label: string; amount: number }[] = [];
  if (hostingRule) {
    lineItems.push({
      id: uid(),
      description: `${hostingRule.label} · récurrent`,
      quantity: 1,
      unitPrice: hostingRule.amount,
    });
    yearlyBreakdown.push({ label: hostingRule.label, amount: hostingRule.amount });
    reasons.push(`hosting ${hostingRule.amount}`);
  }

  // Maintenance (yearly fee — also included as a line)
  const maintRule = MAINTENANCE_LINES[maintenance];
  if (maintRule) {
    lineItems.push({
      id: uid(),
      description: `${maintRule.label} · récurrent`,
      quantity: 1,
      unitPrice: maintRule.amount,
    });
    yearlyBreakdown.push({ label: maintRule.label, amount: maintRule.amount });
    reasons.push(`maintenance ${maintRule.amount}`);
  }

  const oneTimeTotal = sumLineItems(lineItems) - yearlyBreakdown.reduce((s, y) => s + y.amount, 0);
  const yearlyTotal  = yearlyBreakdown.reduce((s, y) => s + y.amount, 0);

  // ── Detect commerce signal for conditions preset ──────────────────
  const hasCommerceModule = modules.some((m) => {
    const meta = getModuleById(m.id);
    return meta?.category === "commerce";
  });

  // ── Pre-select presets ────────────────────────────────────────────
  const conditionsId  = pickConditionsPresetId(projectSlug, hasCommerceModule);
  const paymentId     = pickPaymentTermsPresetId(oneTimeTotal + yearlyTotal, timeline);
  const conditions    = findPreset(settings.conditionsPresets, conditionsId) || settings.defaultConditions;
  const paymentTerms  = findPreset(settings.paymentTermsPresets, paymentId);
  reasons.push(`conditions=${conditionsId}`, `payment=${paymentId}`);

  // ── Project title & description ────────────────────────────────────
  const projectTitle =
    company ? `${projectLabel} - ${company}`
    : intake.clientName ? `${projectLabel} - ${intake.clientName}`
    : projectLabel;

  const projectDescription = buildDescription(intake, modules);

  return {
    clientName:   intake.clientName ?? "",
    clientEmail:  intake.clientEmail ?? "",
    clientCompany: company,
    existingClientId: existing?.id ?? null,

    projectTitle,
    projectDescription,

    lineItems,
    conditions,
    paymentTerms,

    yearlyTotal,
    yearlyBreakdown,
    oneTimeTotal,

    estimateBand: estimate ? { low: estimate.low ?? 0, high: estimate.high ?? 0 } : null,
    intake,
    reasons,
  };
}
