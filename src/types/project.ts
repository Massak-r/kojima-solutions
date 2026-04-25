import { TimelineTask } from "./timeline";

export interface Delivery {
  id: string;
  title: string;
  description?: string;
  type: "link" | "image" | "text" | "file";
  content: string;       // primary URL (link/file) or first image URL (backward compat)
  images?: string[];     // multiple image URLs — used when type === "image"
  taskId?: string;       // if set → step delivery attached to that task; undefined → final delivery
  createdAt: string;
}

export type ProjectKind = "client" | "internal" | "personal";

export interface ProjectData {
  title: string;
  client: string;
  clientId?: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "draft" | "in-progress" | "completed" | "on-hold";
  kind: ProjectKind;
  initialQuote: string;
  revisedQuote: string;
  invoiceNumber: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  notes: string;
  tasks: TimelineTask[];
  deliveries?: Delivery[];
  clientSlug?: string;
}

export const DEFAULT_PROJECT: ProjectData = {
  title: "My Project Roadmap",
  client: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "draft",
  kind: "client",
  initialQuote: "",
  revisedQuote: "",
  invoiceNumber: "",
  paymentStatus: "unpaid",
  notes: "",
  tasks: [],
};

export interface ProjectStakeholder {
  id: string;
  projectId: string;
  name: string;
  email: string;
  role?: string;
  addedAt: string;
  lastAccessedAt?: string;
}

export const STATUS_LABELS: Record<ProjectData["status"], string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  completed: "Completed",
  "on-hold": "On Hold",
};

export const PAYMENT_LABELS: Record<ProjectData["paymentStatus"], string> = {
  unpaid: "Unpaid",
  partial: "Partially Paid",
  paid: "Paid",
};

export const KIND_LABELS: Record<ProjectKind, string> = {
  client:   "Externe",
  internal: "Interne",
  personal: "Personnel",
};

export const KIND_ORDER: ProjectKind[] = ["client", "internal", "personal"];

/** Tailwind classes for each kind badge (consistent with the subtask "Perso" violet and sky for recurring) */
export const KIND_BADGE_CLASSES: Record<ProjectKind, string> = {
  client:   "bg-muted text-muted-foreground border-border",
  internal: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30",
  personal: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30",
};
