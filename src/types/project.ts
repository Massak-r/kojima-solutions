import { TimelineTask } from "./timeline";

export interface ProjectData {
  title: string;
  client: string;
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
