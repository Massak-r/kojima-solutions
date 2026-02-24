export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface FeedbackRequest {
  id: string;
  type: "feedback" | "file";
  message: string;
  createdAt: string;
  resolved: boolean;
  response?: string;
  respondedAt?: string;
}

export interface TimelineTask {
  id: string;
  order: number;
  title: string;
  description: string;
  date: string;
  dateLabel: string;
  color?: "primary" | "accent" | "secondary" | "rose" | "sage" | "amber" | "violet";
  subtasks?: SubTask[];
  feedbackRequests?: FeedbackRequest[];
}
