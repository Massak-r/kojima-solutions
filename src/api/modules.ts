import { apiFetch } from "./client";
import type { SelectedModule, MaintenanceTier } from "@/types/module";

export interface ProjectModulesData {
  id: string;
  projectId: string;
  modules: SelectedModule[];
  maintenance: MaintenanceTier;
  createdAt: string;
  updatedAt: string;
}

export async function getProjectModules(projectId: string): Promise<ProjectModulesData | null> {
  return apiFetch<ProjectModulesData | null>(`modules.php?project_id=${projectId}`);
}

export async function saveProjectModules(
  projectId: string,
  modules: SelectedModule[],
  maintenance: MaintenanceTier,
): Promise<ProjectModulesData> {
  return apiFetch<ProjectModulesData>(`modules.php?project_id=${projectId}`, {
    method: "PUT",
    body: JSON.stringify({ modules, maintenance }),
  });
}
