export interface ProjectPhase {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  phaseOrder: number;
  budget?: number | null;
  status: "pending" | "active" | "completed";
}
