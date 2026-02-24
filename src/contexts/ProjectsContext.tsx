import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ProjectData, DEFAULT_PROJECT } from "@/types/project";
import { TimelineTask, SubTask, FeedbackRequest } from "@/types/timeline";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const STORAGE_KEY = "projects_data";

const SAMPLE_TASKS: TimelineTask[] = [
  {
    id: "1",
    order: 1,
    title: "Discovery & Research",
    description: "**Stakeholder interviews**, competitive analysis, and defining project goals.\n- User research\n- Market analysis\n- Goal setting",
    date: "Week 1",
    dateLabel: "Week 1 · Jan 6",
    color: "primary",
  },
  {
    id: "2",
    order: 2,
    title: "Design System",
    description: "Establish typography, color tokens, component library and visual language.",
    date: "Week 2",
    dateLabel: "Week 2 · Jan 13",
    color: "accent",
  },
  {
    id: "3",
    order: 3,
    title: "Prototype & Testing",
    description: "Interactive prototypes reviewed with real users for feedback and iteration.",
    date: "Week 4",
    dateLabel: "Week 4 · Jan 27",
    color: "secondary",
  },
];

export interface TaskFeedback {
  id: string;
  taskId: string;
  author: string;
  comment: string;
  status: "approved" | "needs-changes" | "pending";
  createdAt: string;
}

export interface StoredProject extends ProjectData {
  id: string;
  createdAt: string;
  feedbacks: TaskFeedback[];
}

interface ProjectsContextValue {
  projects: StoredProject[];
  createProject: (title?: string) => StoredProject;
  updateProject: (id: string, updates: Partial<ProjectData>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => StoredProject | undefined;
  addFeedback: (projectId: string, taskId: string, feedback: Omit<TaskFeedback, "id" | "createdAt">) => void;
  updateFeedback: (projectId: string, feedbackId: string, updates: Partial<Pick<TaskFeedback, "comment" | "status" | "author">>) => void;
  updateTaskSubtasks: (projectId: string, taskId: string, subtasks: SubTask[]) => void;
  addFeedbackRequest: (projectId: string, taskId: string, request: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) => void;
  respondToFeedbackRequest: (projectId: string, taskId: string, requestId: string, response: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function loadProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      ...DEFAULT_PROJECT,
      id: "demo",
      title: "My Project Roadmap",
      createdAt: new Date().toISOString(),
      tasks: SAMPLE_TASKS,
      feedbacks: [],
    },
  ];
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<StoredProject[]>(loadProjects);

  // Persist to localStorage on every change
  const persist = useCallback((updated: StoredProject[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
  }, []);

  const createProject = useCallback((title?: string) => {
    const newProject: StoredProject = {
      ...DEFAULT_PROJECT,
      id: generateId(),
      title: title || "Untitled Project",
      createdAt: new Date().toISOString(),
      tasks: [],
      feedbacks: [],
    };
    setProjects((prev) => { const next = [...prev, newProject]; persist(next); return next; });
    return newProject;
  }, [persist]);

  const updateProject = useCallback((id: string, updates: Partial<ProjectData>) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      persist(next);
      return next;
    });
  }, [persist]);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => { const next = prev.filter((p) => p.id !== id); persist(next); return next; });
  }, [persist]);

  const addFeedback = useCallback((projectId: string, taskId: string, feedback: Omit<TaskFeedback, "id" | "createdAt">) => {
    const newFeedback: TaskFeedback = {
      ...feedback,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId ? { ...p, feedbacks: [...(p.feedbacks || []), newFeedback] } : p
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const updateFeedback = useCallback((projectId: string, feedbackId: string, updates: Partial<Pick<TaskFeedback, "comment" | "status" | "author">>) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? { ...p, feedbacks: (p.feedbacks || []).map((f) => f.id === feedbackId ? { ...f, ...updates } : f) }
          : p
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const updateTaskSubtasks = useCallback((projectId: string, taskId: string, subtasks: SubTask[]) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, subtasks } : t) }
          : p
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const addFeedbackRequest = useCallback((projectId: string, taskId: string, request: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) => {
    const newReq: FeedbackRequest = { ...request, id: generateId(), createdAt: new Date().toISOString(), resolved: false };
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, feedbackRequests: [...(t.feedbackRequests || []), newReq] } : t) }
          : p
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const respondToFeedbackRequest = useCallback((projectId: string, taskId: string, requestId: string, response: string) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      feedbackRequests: (t.feedbackRequests || []).map((r) =>
                        r.id === requestId ? { ...r, resolved: true, response, respondedAt: new Date().toISOString() } : r
                      ),
                    }
                  : t
              ),
            }
          : p
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects]
  );

  return (
    <ProjectsContext.Provider value={{ projects, createProject, updateProject, deleteProject, getProject, addFeedback, updateFeedback, updateTaskSubtasks, addFeedbackRequest, respondToFeedbackRequest }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
