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

export interface ProjectData {
  title: string;
  client: string;
  clientId?: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "draft" | "in-progress" | "completed" | "on-hold";
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
