import { apiFetch } from "./client";

export type LeadStatus = "new" | "contacted" | "proposal" | "won" | "lost";

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  value: number;            // estimated CHF
  notes: string | null;
  nextFollowUp: string | null; // YYYY-MM-DD
  convertedClientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadCreate = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  value?: number;
  notes?: string;
  nextFollowUp?: string;
};

export function listLeads(): Promise<Lead[]> {
  return apiFetch<Lead[]>("leads.php");
}
export function createLead(data: LeadCreate): Promise<Lead> {
  return apiFetch<Lead>("leads.php", { method: "POST", body: JSON.stringify(data) });
}
export function updateLead(id: string, patch: Partial<Lead>): Promise<Lead> {
  return apiFetch<Lead>(`leads.php?id=${id}`, { method: "PUT", body: JSON.stringify(patch) });
}
export function deleteLead(id: string): Promise<void> {
  return apiFetch<void>(`leads.php?id=${id}`, { method: "DELETE" });
}
