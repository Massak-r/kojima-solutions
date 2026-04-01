import { apiFetch } from "./client";

export interface Cadrage {
  id: string;
  projectId: string;
  objectives: string;
  inScope: string;
  outScope: string;
  deliverables: string;
  milestones: string;
  constraints: string;
  budgetValidated: string;
  createdAt: string;
  updatedAt: string;
}

export async function getCadrage(projectId: string): Promise<Cadrage | null> {
  return apiFetch<Cadrage | null>(`cadrage.php?project_id=${projectId}`);
}

export async function saveCadrage(
  projectId: string,
  data: Partial<Omit<Cadrage, "id" | "projectId" | "createdAt" | "updatedAt">>
): Promise<Cadrage> {
  return apiFetch<Cadrage>(`cadrage.php?project_id=${projectId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
