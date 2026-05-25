import { useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { useToast } from "@/hooks/use-toast";
import {
  updateIntakeResponse,
  type IntakeResponse,
} from "@/api/funnels";
import { createEmptyQuote } from "@/types/quote";
import { generateProposal, type ProposalDraft } from "@/lib/proposalGenerator";

/**
 * Shared intake → (project + draft quote + client) conversion. Used by both
 * IntakeManager (the full intake list, with preview dialog) and NewIntakes
 * (the compact alert on Home, one-tap), so the same enriched pipeline runs
 * from either entry point.
 *
 * If `proposal` is provided (typically by SmartProposalDialog after the
 * user reviewed and tweaked it), it's used as-is. Otherwise a fresh proposal
 * is generated from the intake on the fly.
 *
 * `onConverted` is invoked after the intake row mutation succeeds — typically
 * to splice the updated intake back into local state.
 */
export function useConvertIntake(onConverted?: (updated: IntakeResponse) => void) {
  const navigate = useNavigate();
  const { createProject, updateProject } = useProjects();
  const { addQuote } = useQuotes();
  const { clients, addClient } = useClients();
  const { settings } = useCompanySettings();
  const { toast } = useToast();

  return async function convertToProject(intake: IntakeResponse, proposal?: ProposalDraft) {
    const draft = proposal ?? generateProposal(intake, clients, settings);

    // Find or create client by email — avoids dupes when the intake's email
    // already matches an existing client record.
    let clientId: string | undefined = draft.existingClientId ?? undefined;
    if (!clientId && draft.clientEmail) {
      const newClient = addClient({
        name: draft.clientName || "Client",
        email: draft.clientEmail,
        organization: draft.clientCompany || undefined,
      });
      clientId = newClient.id;
    }

    // Create project
    const p = createProject();
    updateProject(p.id, {
      title: draft.projectTitle,
      client: draft.clientName,
      clientId,
    });

    // Create draft quote with the proposal's lines + presets.
    const quoteBase = createEmptyQuote("fr");
    const now = new Date();
    const quoteId = crypto.randomUUID?.() ?? `q-${Date.now()}`;
    const quote = {
      ...quoteBase,
      id: quoteId,
      createdAt: now.toISOString(),
      projectId: p.id,
      clientName:    draft.clientName,
      clientEmail:   draft.clientEmail,
      clientCompany: draft.clientCompany,
      projectTitle:  draft.projectTitle,
      projectDescription: draft.projectDescription,
      conditions:    draft.conditions,
      paymentTerms:  draft.paymentTerms,
      lineItems:     draft.lineItems,
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
    } catch {
      /* 401s already handled globally; transient errors are non-fatal here. */
    }

    const moduleCount = draft.lineItems.length - 1; // minus the base line
    toast({
      title: "Projet + devis créés",
      description: `${moduleCount} ligne${moduleCount > 1 ? "s" : ""} importée${moduleCount > 1 ? "s" : ""}`,
    });
    navigate(`/quotes/${quoteId}`);
  };
}
