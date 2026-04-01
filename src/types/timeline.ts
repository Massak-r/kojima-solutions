export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;          // cover image (backward compat)
  images?: string[];          // multi-image carousel
  linkUrl?: string;           // external preview link
  isRecommended?: boolean;    // admin recommendation badge
}

export interface GuidedQuestion {
  id: string;
  question: string;
  type: "text" | "rating" | "checkbox" | "yesno";
  options?: string[];         // for checkbox type
  required?: boolean;
}

export interface ResponseHistoryEntry {
  id: string;
  response: string;
  respondedAt: string;
  respondedBy?: string;
  revisionRound: number;
}

export interface StakeholderVote {
  id: string;
  name: string;
  optionId?: string;       // for choice/vote requests
  vote?: "approve" | "revise"; // for approval requests
  comment?: string;
  votedAt: string;
}

export interface FeedbackRequest {
  id: string;
  type: "text" | "file" | "validation" | "vote";
  message: string;
  images?: string[];                        // type="validation": image URLs shown to client
  options?: VoteOption[];                    // type="vote": named versions to pick from
  guidedQuestions?: GuidedQuestion[];        // structured questions (any type)
  deadline?: string;                        // ISO date
  revisionLimit?: number;                   // max revision rounds
  revisionCount?: number;                   // current count
  responseHistory?: ResponseHistoryEntry[]; // audit log of all rounds
  respondedBy?: string;                     // who approved/responded
  stakeholderVotes?: StakeholderVote[];     // stakeholder input
  stakeholderHighlight?: boolean;           // flagged for stakeholder attention
  createdAt: string;
  resolved: boolean;
  response?: string;
  respondedAt?: string;
}

export type StepStatus = "locked" | "open" | "completed";

export interface StepComment {
  id: string;
  taskId: string;
  authorName: string;
  authorEmail?: string;
  authorRole: "client" | "admin" | "stakeholder";
  message: string;
  createdAt: string;
}

export interface TimelineTask {
  id: string;
  order: number;
  title: string;
  description: string;
  date: string;
  dateLabel: string;
  color?: "primary" | "accent" | "secondary" | "rose" | "sage" | "amber" | "violet";
  completed?: boolean;
  status?: StepStatus;
  completedAt?: string;
  completedBy?: string;
  deadline?: string;
  subtasks?: SubTask[];
  feedbackRequests?: FeedbackRequest[];
  comments?: StepComment[];
  phaseId?: string;
}
