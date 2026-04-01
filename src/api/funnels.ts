import { apiFetch } from "./client";

// ── Types ───────────────────────────────────────────────────

export type FunnelStatus = "intake" | "proposal" | "active" | "completed";
export type PhaseStatus = "pending" | "active" | "completed" | "skipped";
export type GateStatus = "locked" | "open" | "approved" | "revision";
export type GateType = "choice" | "approval" | "feedback";
export type ChangeOrderStatus = "proposed" | "accepted" | "rejected";
export type IntakeStatus = "new" | "reviewed" | "converted";
export type Tier = "essential" | "professional" | "custom";

export interface GateOption {
  id: string;
  gateId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  images: string[];
  linkUrl: string | null;
  isRecommended: boolean;
  isSelected: boolean;
  optionOrder: number;
}

export interface GateComment {
  id: string;
  gateId: string;
  authorName: string;
  authorEmail: string;
  authorRole: "client" | "admin" | "stakeholder";
  message: string;
  createdAt: string;
}

export interface FunnelGate {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  gateType: GateType;
  gateOrder: number;
  status: GateStatus;
  deadline: string | null;
  revisionLimit: number;
  revisionCount: number;
  approvedAt: string | null;
  approvedBy: string | null;
  options: GateOption[];
  comments: GateComment[];
}

export interface FunnelPhase {
  id: string;
  funnelId: string;
  title: string;
  description: string;
  phaseOrder: number;
  budget: number | null;
  status: PhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  gates: FunnelGate[];
}

export interface ProjectFunnel {
  id: string;
  projectId: string;
  templateId: string | null;
  tier: Tier | null;
  status: FunnelStatus;
  decisionMakerName: string | null;
  decisionMakerEmail: string | null;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
  phases: FunnelPhase[];
  projectTitle?: string; // included in list view
}

export interface ChangeOrder {
  id: string;
  funnelId: string;
  gateId: string | null;
  quoteId: string | null;
  title: string;
  description: string;
  costImpact: number | null;
  timeImpactDays: number | null;
  status: ChangeOrderStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  defaultTier: Tier | null;
  phasesJson: PhaseTemplate[];
  budgetRangeMin: number | null;
  budgetRangeMax: number | null;
  createdAt: string;
}

export interface PhaseTemplate {
  title: string;
  description?: string;
  budget?: number;
  gates: GateTemplate[];
}

export interface GateTemplate {
  title: string;
  description?: string;
  gateType: GateType;
  revisionLimit?: number;
  options?: { title: string; description?: string }[];
}

export interface IntakeResponse {
  id: string;
  projectId: string | null;
  clientName: string;
  clientEmail: string;
  responses: Record<string, unknown>;
  suggestedTier: Tier | null;
  suggestedTemplateId: string | null;
  status: IntakeStatus;
  createdAt: string;
}

// ── Funnel CRUD ─────────────────────────────────────────────

export function listFunnels() {
  return apiFetch<ProjectFunnel[]>("funnels.php");
}

export function getFunnel(id: string) {
  return apiFetch<ProjectFunnel>(`funnels.php?id=${id}`);
}

export function getFunnelByShareToken(token: string) {
  return apiFetch<ProjectFunnel>(`funnels.php?share_token=${token}`);
}

export function shareFunnel(id: string) {
  return apiFetch<ProjectFunnel>(`funnels.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'share' }),
  });
}

export function unshareFunnel(id: string) {
  return apiFetch<ProjectFunnel>(`funnels.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ action: 'unshare' }),
  });
}

export function getFunnelByProject(projectId: string) {
  return apiFetch<ProjectFunnel | null>(`funnels.php?project_id=${projectId}`);
}

export function createFunnel(data: {
  projectId: string;
  templateId?: string;
  tier?: Tier;
  status?: FunnelStatus;
  decisionMakerName?: string;
  decisionMakerEmail?: string;
  phases?: Array<{
    title: string;
    description?: string;
    budget?: number;
    gates?: Array<{
      title: string;
      description?: string;
      gateType?: GateType;
      deadline?: string;
      revisionLimit?: number;
      options?: Array<{ title: string; description?: string; imageUrl?: string; linkUrl?: string; isRecommended?: boolean }>;
    }>;
  }>;
}) {
  return apiFetch<ProjectFunnel>("funnels.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateFunnel(id: string, data: Partial<Pick<ProjectFunnel, "tier" | "status" | "decisionMakerName" | "decisionMakerEmail" | "templateId">>) {
  return apiFetch<ProjectFunnel>(`funnels.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteFunnel(id: string) {
  return apiFetch<void>(`funnels.php?id=${id}`, { method: "DELETE" });
}

/** Public — client confirms proposal, transitions status proposal → active */
export function confirmProposal(funnelId: string, tier?: Tier) {
  return apiFetch<{ confirmed: boolean }>(`funnels.php?id=${funnelId}&action=confirm`, {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
}

// ── Phase CRUD ──────────────────────────────────────────────

export function createPhase(data: { funnelId: string; title: string; description?: string; phaseOrder?: number; budget?: number }) {
  return apiFetch<FunnelPhase>("funnel_gates.php?action=phase", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePhase(id: string, data: Partial<Pick<FunnelPhase, "title" | "description" | "phaseOrder" | "budget" | "status">>) {
  return apiFetch<FunnelPhase>(`funnel_gates.php?id=${id}&action=phase`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePhase(id: string) {
  return apiFetch<void>(`funnel_gates.php?id=${id}&action=phase`, { method: "DELETE" });
}

// ── Gate CRUD ───────────────────────────────────────────────

export function createGate(data: { phaseId: string; title: string; description?: string; gateType?: GateType; gateOrder?: number; deadline?: string; revisionLimit?: number }) {
  return apiFetch<FunnelGate>("funnel_gates.php?action=gate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateGate(id: string, data: Partial<Pick<FunnelGate, "title" | "description" | "gateType" | "gateOrder" | "status" | "deadline" | "revisionLimit">>) {
  return apiFetch<FunnelGate>(`funnel_gates.php?id=${id}&action=gate`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteGate(id: string) {
  return apiFetch<void>(`funnel_gates.php?id=${id}&action=gate`, { method: "DELETE" });
}

// ── Gate Option CRUD ────────────────────────────────────────

export function createOption(data: { gateId: string; title: string; description?: string; imageUrl?: string; imagesJson?: string[]; linkUrl?: string; isRecommended?: boolean; optionOrder?: number }) {
  return apiFetch<GateOption>("funnel_gates.php?action=option", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateOption(id: string, data: Partial<GateOption> & { imagesJson?: string[] }) {
  return apiFetch<GateOption>(`funnel_gates.php?id=${id}&action=option`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteOption(id: string) {
  return apiFetch<void>(`funnel_gates.php?id=${id}&action=option`, { method: "DELETE" });
}

// ── Client Gate Actions ─────────────────────────────────────

export function approveGate(gateId: string, approvedBy: string) {
  return apiFetch<{ approved: boolean; nextGateId: string | null }>(`funnel_gates.php?id=${gateId}&action=approve`, {
    method: "POST",
    body: JSON.stringify({ approvedBy }),
  });
}

export function selectOption(gateId: string, optionId: string) {
  return apiFetch<{ selected: string }>(`funnel_gates.php?id=${gateId}&action=select`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}

export function requestRevision(gateId: string, data: { message: string; authorName?: string; authorEmail?: string }) {
  return apiFetch<{ revisionCount: number; overLimit: boolean }>(`funnel_gates.php?id=${gateId}&action=revision`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function addGateComment(gateId: string, data: { message: string; authorName?: string; authorEmail?: string; authorRole?: "client" | "admin" | "stakeholder" }) {
  return apiFetch<GateComment>(`funnel_gates.php?id=${gateId}&action=comment`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Change Orders ───────────────────────────────────────────

export function listChangeOrders(funnelId: string) {
  return apiFetch<ChangeOrder[]>(`change_orders.php?funnel_id=${funnelId}`);
}

export function createChangeOrder(data: { funnelId: string; gateId?: string; quoteId?: string; title: string; description?: string; costImpact?: number; timeImpactDays?: number }) {
  return apiFetch<ChangeOrder>("change_orders.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateChangeOrder(id: string, data: Partial<ChangeOrder>) {
  return apiFetch<ChangeOrder>(`change_orders.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteChangeOrder(id: string) {
  return apiFetch<void>(`change_orders.php?id=${id}`, { method: "DELETE" });
}

// ── Templates ───────────────────────────────────────────────

export function listTemplates() {
  return apiFetch<ProjectTemplate[]>("templates.php");
}

export function getTemplate(id: string) {
  return apiFetch<ProjectTemplate>(`templates.php?id=${id}`);
}

export function createTemplate(data: Partial<Omit<ProjectTemplate, "id" | "createdAt">>) {
  return apiFetch<ProjectTemplate>("templates.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTemplate(id: string, data: Partial<Omit<ProjectTemplate, "id" | "createdAt">>) {
  return apiFetch<ProjectTemplate>(`templates.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTemplate(id: string) {
  return apiFetch<void>(`templates.php?id=${id}`, { method: "DELETE" });
}

// ── Intake ──────────────────────────────────────────────────

export function listIntakeResponses() {
  return apiFetch<IntakeResponse[]>("intake.php");
}

export function getIntakeByProject(projectId: string) {
  return apiFetch<IntakeResponse[]>(`intake.php?project_id=${projectId}`);
}

export function getIntakeResponse(id: string) {
  return apiFetch<IntakeResponse>(`intake.php?id=${id}`);
}

/** Public — no auth needed */
export function submitIntake(data: { clientName: string; clientEmail: string; responses: Record<string, unknown>; suggestedTier?: Tier; suggestedTemplateId?: string }) {
  return apiFetch<{ id: string; status: string }>("intake.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateIntakeResponse(id: string, data: Partial<Pick<IntakeResponse, "status" | "projectId" | "suggestedTier" | "suggestedTemplateId">>) {
  return apiFetch<IntakeResponse>(`intake.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteIntakeResponse(id: string) {
  return apiFetch<void>(`intake.php?id=${id}`, { method: "DELETE" });
}
