import { useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useToast } from "@/hooks/use-toast";
import {
  updateIntakeResponse,
  type IntakeResponse,
} from "@/api/funnels";
import { ModuleResolver } from "@/lib/moduleResolver";
import type { ModuleComplexity } from "@/types/module";
import { createEmptyQuote } from "@/types/quote";

function formatCHF(n: number): string {
  return n.toLocaleString("fr-CH");
}

/**
 * Shared intake → (project + draft quote + client) conversion. Used by both
 * IntakeManager (the full intake list in KojimaSpace / Home Overview) and
 * NewIntakes (the compact alert on Home Streams) so the same one-tap flow
 * works from either entry point.
 *
 * `onConverted` is invoked after the intake row mutation succeeds — typically
 * to splice the updated intake back into local state.
 */
export function useConvertIntake(onConverted?: (updated: IntakeResponse) => void) {
  const navigate = useNavigate();
  const { createProject, updateProject } = useProjects();
  const { addQuote } = useQuotes();
  const { clients, addClient } = useClients();
  const { toast } = useToast();

  return async function convertToProject(intake: IntakeResponse) {
    const responses = intake.responses ?? {};
    const projectType = (responses.projectType as string) ?? "";
    const selectedModules = (responses.selectedModules as { id: string; complexity: string }[]) ?? [];
    const estimate = responses.estimate as { low?: number; high?: number; yearly?: number } | undefined;
    const pageCount = (responses.pageCount as string) ?? "multi";
    const company = (responses.company as string) ?? "";

    // Find or create client by email — avoids dupes when the intake's email
    // already matches an existing client record.
    let clientId: string | undefined;
    if (intake.clientEmail) {
      const existing = clients.find(
        (c) => c.email?.toLowerCase() === intake.clientEmail.toLowerCase()
      );
      if (existing) {
        clientId = existing.id;
      } else {
        const newClient = addClient({
          name: intake.clientName || "Client",
          email: intake.clientEmail,
          organization: company || undefined,
        });
        clientId = newClient.id;
      }
    }

    // Create project
    const p = createProject();
    updateProject(p.id, {
      title: projectType || intake.clientName || "Nouveau projet",
      client: intake.clientName || "",
      clientId,
    });

    // Build quote line items from intake modules
    const moduleLines = selectedModules.length > 0
      ? new ModuleResolver(
          selectedModules.map((m) => ({
            moduleId: m.id,
            complexity: m.complexity as ModuleComplexity,
          }))
        ).toQuoteLines()
      : [];

    // Add base project line
    const baseLineId = crypto.randomUUID?.() ?? `line-${Date.now()}`;
    const baseLine = {
      id: baseLineId,
      description: "Base projet (design, responsive, mise en ligne)",
      quantity: 1,
      unitPrice: 1500,
    };

    // Page count surcharge if applicable
    const pageExtras: Record<string, number> = { single: 0, multi: 500, large: 1500 };
    const pageExtra = pageExtras[pageCount] ?? 0;
    const lines = [baseLine, ...moduleLines];
    if (pageExtra > 0) {
      const pageLabels: Record<string, string> = { multi: "Multi-pages (3-10)", large: "Site étendu (10+)" };
      lines.push({
        id: crypto.randomUUID?.() ?? `line-page-${Date.now()}`,
        description: `Pages supplémentaires (${pageLabels[pageCount] ?? pageCount})`,
        quantity: 1,
        unitPrice: pageExtra,
      });
    }

    // Create draft quote
    const quoteBase = createEmptyQuote("fr");
    const now = new Date();
    const quoteId = crypto.randomUUID?.() ?? `q-${Date.now()}`;
    const quote = {
      ...quoteBase,
      id: quoteId,
      createdAt: now.toISOString(),
      projectId: p.id,
      clientName: intake.clientName || "",
      clientEmail: intake.clientEmail || "",
      clientCompany: company,
      projectTitle: projectType || "Nouveau projet",
      projectDescription: estimate
        ? `Estimation: CHF ${formatCHF(estimate.low ?? 0)} – ${formatCHF(estimate.high ?? 0)}`
        : "",
      lineItems: lines,
    };
    addQuote(quote);

    // Mark intake as converted server-side + propagate the updated row to
    // whichever caller wired up onConverted.
    try {
      const updated = await updateIntakeResponse(intake.id, {
        status: "converted" as IntakeResponse["status"],
        projectId: p.id,
      });
      onConverted?.(updated);
    } catch {}

    toast({
      title: "Projet + devis créés",
      description: `${moduleLines.length} module(s) importé(s)`,
    });
    navigate(`/quotes/${quoteId}`);
  };
}
