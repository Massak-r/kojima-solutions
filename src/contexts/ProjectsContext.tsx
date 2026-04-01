import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { ProjectData, DEFAULT_PROJECT, Delivery } from "@/types/project";
import { TimelineTask, SubTask, FeedbackRequest, StepComment, StepStatus } from "@/types/timeline";
import type { ProjectPhase } from "@/types/phase";
import * as api from "@/api/projects";
import { addStepComment as apiAddStepComment } from "@/api/steps";

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
  phases?: ProjectPhase[];
  shareToken?: string | null;
}

interface ProjectsContextValue {
  projects: StoredProject[];
  loading: boolean;
  createProject: (title?: string) => StoredProject;
  updateProject: (id: string, updates: Partial<ProjectData>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => StoredProject | undefined;
  addFeedback: (projectId: string, taskId: string, feedback: Omit<TaskFeedback, "id" | "createdAt">) => void;
  updateFeedback: (projectId: string, feedbackId: string, updates: Partial<Pick<TaskFeedback, "comment" | "status" | "author">>) => void;
  deleteFeedback: (projectId: string, feedbackId: string) => void;
  updateTaskSubtasks: (projectId: string, taskId: string, subtasks: SubTask[]) => void;
  toggleTaskComplete: (projectId: string, taskId: string) => void;
  addFeedbackRequest: (projectId: string, taskId: string, request: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) => void;
  deleteFeedbackRequest: (projectId: string, taskId: string, requestId: string) => void;
  respondToFeedbackRequest: (projectId: string, taskId: string, requestId: string, response: string) => void;
  toggleStakeholderHighlight: (projectId: string, taskId: string, requestId: string) => void;
  addDelivery: (projectId: string, delivery: Omit<import("@/types/project").Delivery, "id" | "createdAt">) => void;
  deleteDelivery: (projectId: string, deliveryId: string) => void;
  addStepComment: (projectId: string, taskId: string, comment: { message: string; authorName?: string; authorEmail?: string; authorRole?: "client" | "admin" | "stakeholder" }) => void;
  updateStepStatus: (projectId: string, taskId: string, status: StepStatus) => void;
  updateProjectPhases: (projectId: string, phases: ProjectPhase[]) => void;
  setShareToken: (projectId: string, token: string | null) => void;
}
const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);

  // Load from API on mount
  useEffect(() => {
    api.listProjects()
      .then((data) => {
        setProjects(data);
        setApiAvailable(true);
      })
      .catch(() => {
        setApiAvailable(false);
        try {
          const raw = localStorage.getItem("projects_data");
          setProjects(raw ? JSON.parse(raw) : []);
        } catch {
          setProjects([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // localStorage fallback persist
  const persist = useCallback((updated: StoredProject[]) => {
    try { localStorage.setItem("projects_data", JSON.stringify(updated)); } catch {}
  }, []);

  // Optimistic update + async API sync
  const applyAndSync = useCallback(
    (updater: (prev: StoredProject[]) => StoredProject[], apiCall?: () => Promise<unknown>) => {
      setProjects((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
      if (apiCall && apiAvailable) {
        apiCall().catch(() => {});
      }
    },
    [persist, apiAvailable]
  );

  // Project CRUD

  const createProject = useCallback((title?: string) => {
    const newProject: StoredProject = {
      ...DEFAULT_PROJECT,
      id: crypto.randomUUID(),
      title: title || "Untitled Project",
      createdAt: new Date().toISOString(),
      tasks: [],
      feedbacks: [],
    };
    applyAndSync(
      (prev) => [...prev, newProject],
      () => api.createProject(newProject)
    );
    return newProject;
  }, [applyAndSync]);

  const updateProject = useCallback((id: string, updates: Partial<ProjectData>) => {
    applyAndSync(
      (prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      () => api.updateProject(id, updates as Partial<StoredProject>)
    );
  }, [applyAndSync]);

  const deleteProject = useCallback((id: string) => {
    applyAndSync(
      (prev) => prev.filter((p) => p.id !== id),
      () => api.deleteProject(id)
    );
  }, [applyAndSync]);

  const addFeedback = useCallback((projectId: string, taskId: string, feedback: Omit<TaskFeedback, "id" | "createdAt">) => {
    const newFeedback: TaskFeedback = { ...feedback, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId ? { ...p, feedbacks: [...(p.feedbacks || []), newFeedback] } : p
      ),
      () => api.createReview({ ...newFeedback, projectId })
    );
  }, [applyAndSync]);

  const updateFeedback = useCallback((projectId: string, feedbackId: string, updates: Partial<Pick<TaskFeedback, "comment" | "status" | "author">>) => {
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, feedbacks: (p.feedbacks || []).map((f) => f.id === feedbackId ? { ...f, ...updates } : f) }
          : p
      ),
      () => api.updateReview(feedbackId, updates as Pick<TaskFeedback, "comment" | "status">)
    );
  }, [applyAndSync]);

  const deleteFeedback = useCallback((projectId: string, feedbackId: string) => {
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, feedbacks: (p.feedbacks || []).filter((f) => f.id !== feedbackId) }
          : p
      ),
      () => api.deleteReview(feedbackId)
    );
  }, [applyAndSync]);

  const updateTaskSubtasks = useCallback((projectId: string, taskId: string, subtasks: SubTask[]) => {
    applyAndSync(
      (prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, subtasks } : t) }
            : p
        );
        if (apiAvailable) {
          const updated = next.find((p) => p.id === projectId);
          if (updated) {
            api.updateProject(projectId, { tasks: updated.tasks } as Partial<StoredProject>)
              .catch(() => {});
          }
        }
        return next;
      }
    );
  }, [applyAndSync, apiAvailable]);

  const toggleTaskComplete = useCallback((projectId: string, taskId: string) => {
    applyAndSync(
      (prev) => {
        const next = prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                tasks: p.tasks.map((t) =>
                  t.id === taskId ? { ...t, completed: !t.completed } : t
                ),
              }
            : p
        );
        if (apiAvailable) {
          const updated = next.find((p) => p.id === projectId);
          if (updated) {
            api.updateProject(projectId, { tasks: updated.tasks } as Partial<StoredProject>)
              .catch(() => {});
          }
        }
        return next;
      }
    );
  }, [applyAndSync, apiAvailable]);

  const addFeedbackRequest = useCallback((projectId: string, taskId: string, request: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) => {
    const newReq: FeedbackRequest = {
      ...request,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, feedbackRequests: [...(t.feedbackRequests || []), newReq] } : t) }
          : p
      ),
      () => api.createFeedbackRequest({ ...newReq, taskId })
    );
  }, [applyAndSync]);

  const deleteFeedbackRequest = useCallback((projectId: string, taskId: string, requestId: string) => {
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, feedbackRequests: (t.feedbackRequests || []).filter((r) => r.id !== requestId) }
                  : t
              ),
            }
          : p
      ),
      () => api.deleteFeedbackRequest(requestId)
    );
  }, [applyAndSync]);

  const respondToFeedbackRequest = useCallback((projectId: string, taskId: string, requestId: string, response: string) => {
    const isApproval = response === "approved";
    const isRevision = response.startsWith("changes:");
    const now = new Date().toISOString();

    applyAndSync(
      (prev) => prev.map((p) => {
        if (p.id !== projectId) return p;

        // Update the feedback request
        let updatedTasks = p.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                feedbackRequests: (t.feedbackRequests || []).map((r) => {
                  if (r.id !== requestId) return r;
                  const newHistory = [
                    ...(r.responseHistory || []),
                    {
                      id: crypto.randomUUID(),
                      response,
                      respondedAt: now,
                      revisionRound: (r.revisionCount ?? 0) + (isRevision ? 1 : 0),
                    },
                  ];
                  return {
                    ...r,
                    resolved: isApproval,
                    response,
                    respondedAt: now,
                    revisionCount: isRevision ? (r.revisionCount ?? 0) + 1 : r.revisionCount,
                    responseHistory: newHistory,
                  };
                }),
              }
            : t
        );

        // Sequential locking: if approved, check if all requests on this step are resolved
        // If so, mark step as completed and open the next locked step
        if (isApproval) {
          const currentTask = updatedTasks.find((t) => t.id === taskId);
          const allResolved = currentTask?.feedbackRequests?.every((r) => r.resolved) ?? true;

          if (allResolved && currentTask) {
            // Mark current step as completed
            updatedTasks = updatedTasks.map((t) =>
              t.id === taskId
                ? { ...t, status: "completed" as const, completed: true, completedAt: now }
                : t
            );

            // Find the next locked step (by order) and open it
            const sortedTasks = [...updatedTasks].sort((a, b) => a.order - b.order);
            const currentOrder = currentTask.order;
            const nextLocked = sortedTasks.find(
              (t) => t.order > currentOrder && t.status === "locked"
            );
            if (nextLocked) {
              updatedTasks = updatedTasks.map((t) =>
                t.id === nextLocked.id
                  ? { ...t, status: "open" as const }
                  : t
              );
            }
          }
        }

        return { ...p, tasks: updatedTasks };
      }),
      () => api.resolveFeedbackRequest(requestId, response)
    );
  }, [applyAndSync]);

  const toggleStakeholderHighlight = useCallback((projectId: string, taskId: string, requestId: string) => {
    // Find current value to compute the toggled state for the API call
    const project = projects.find((p) => p.id === projectId);
    const task = project?.tasks.find((t) => t.id === taskId);
    const req = task?.feedbackRequests?.find((r) => r.id === requestId);
    const newValue = !req?.stakeholderHighlight;

    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      feedbackRequests: (t.feedbackRequests || []).map((r) =>
                        r.id === requestId
                          ? { ...r, stakeholderHighlight: newValue }
                          : r
                      ),
                    }
                  : t
              ),
            }
          : p
      ),
      () => api.updateFeedbackRequest(requestId, { stakeholderHighlight: newValue })
    );
  }, [applyAndSync, projects]);

  const addDelivery = useCallback((projectId: string, delivery: Omit<Delivery, "id" | "createdAt">) => {
    const newDelivery: Delivery = {
      ...delivery,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, deliveries: [...(p.deliveries || []), newDelivery] }
          : p
      ),
      () => {
        const updated = projects.find((p) => p.id === projectId);
        if (updated) {
          const updatedDeliveries = [...(updated.deliveries || []), newDelivery];
          return api.updateProject(projectId, { deliveries: updatedDeliveries } as Partial<StoredProject>);
        }
        return Promise.resolve();
      }
    );
  }, [applyAndSync, projects]);

  const deleteDelivery = useCallback((projectId: string, deliveryId: string) => {
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, deliveries: (p.deliveries || []).filter((d) => d.id !== deliveryId) }
          : p
      ),
      () => {
        const updated = projects.find((p) => p.id === projectId);
        if (updated) {
          const updatedDeliveries = (updated.deliveries || []).filter((d) => d.id !== deliveryId);
          return api.updateProject(projectId, { deliveries: updatedDeliveries } as Partial<StoredProject>);
        }
        return Promise.resolve();
      }
    );
  }, [applyAndSync, projects]);

  const addStepComment = useCallback((projectId: string, taskId: string, comment: { message: string; authorName?: string; authorEmail?: string; authorRole?: "client" | "admin" | "stakeholder" }) => {
    const newComment: StepComment = {
      id: crypto.randomUUID(),
      taskId,
      authorName: comment.authorName || "Admin",
      authorEmail: comment.authorEmail,
      authorRole: comment.authorRole || "admin",
      message: comment.message,
      createdAt: new Date().toISOString(),
    };
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, comments: [...(t.comments || []), newComment] }
                  : t
              ),
            }
          : p
      ),
      () => apiAddStepComment(taskId, comment)
    );
  }, [applyAndSync]);

  const updateStepStatus = useCallback((projectId: string, taskId: string, status: StepStatus) => {
    const now = new Date().toISOString();
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      status,
                      completed: status === "completed",
                      completedAt: status === "completed" ? now : undefined,
                    }
                  : t
              ),
            }
          : p
      ),
      () => api.updateProject(projectId, {} as Partial<StoredProject>).then(() => {
        // Status update is sent via the project sync
      })
    );
  }, [applyAndSync]);

  const updateProjectPhases = useCallback((projectId: string, phases: ProjectPhase[]) => {
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId ? { ...p, phases } : p
      )
    );
  }, [applyAndSync]);

  const setShareToken = useCallback((projectId: string, token: string | null) => {
    applyAndSync(
      (prev) => prev.map((p) =>
        p.id === projectId ? { ...p, shareToken: token } : p
      ),
      () => api.updateProject(projectId, { shareToken: token } as Partial<StoredProject>)
    );
  }, [applyAndSync]);

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id || p.clientSlug === id),
    [projects]
  );

  return (
    <ProjectsContext.Provider value={{
      projects,
      loading,
      createProject,
      updateProject,
      deleteProject,
      getProject,
      addFeedback,
      updateFeedback,
      deleteFeedback,
      updateTaskSubtasks,
      toggleTaskComplete,
      addFeedbackRequest,
      deleteFeedbackRequest,
      respondToFeedbackRequest,
      toggleStakeholderHighlight,
      addDelivery,
      deleteDelivery,
      addStepComment,
      updateStepStatus,
      updateProjectPhases,
      setShareToken,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}