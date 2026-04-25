import { useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ProjectData, DEFAULT_PROJECT, Delivery } from "@/types/project";
import type { SubTask, FeedbackRequest, StepComment, StepStatus } from "@/types/timeline";
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

const PROJECTS_KEY = ["projects"] as const;

// Provider is now a no-op pass-through. The cache lives in react-query
// (QueryClientProvider in App.tsx); `useProjects()` reads from it directly.
export function ProjectsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function notifyError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "Erreur inconnue");
  toast({ title: label, description: message.slice(0, 240), variant: "destructive" });
}

function setCache(qc: QueryClient, updater: (prev: StoredProject[]) => StoredProject[]) {
  qc.setQueryData<StoredProject[]>(PROJECTS_KEY, (prev) => updater(prev ?? []));
}

function snapshot(qc: QueryClient): StoredProject[] {
  return qc.getQueryData<StoredProject[]>(PROJECTS_KEY) ?? [];
}

/**
 * Apply an optimistic local update + sync to the API. On error, rolls the
 * cache back to the snapshot taken before the update and surfaces a toast.
 */
function applyAndSync(
  qc: QueryClient,
  updater: (prev: StoredProject[]) => StoredProject[],
  apiCall: (() => Promise<unknown>) | undefined,
  errorLabel: string,
) {
  const before = snapshot(qc);
  setCache(qc, updater);
  if (!apiCall) return;
  apiCall()
    .then(() => qc.invalidateQueries({ queryKey: PROJECTS_KEY }))
    .catch((err) => {
      qc.setQueryData(PROJECTS_KEY, before);
      notifyError(errorLabel, err);
    });
}

export function useProjects(): ProjectsContextValue {
  const qc = useQueryClient();
  const { data: projects = [], isLoading } = useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => api.listProjects(),
    staleTime: 30_000,
  });

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
      qc,
      (prev) => [...prev, newProject],
      () => api.createProject(newProject),
      "Création projet échouée",
    );
    return newProject;
  }, [qc]);

  const updateProject = useCallback((id: string, updates: Partial<ProjectData>) => {
    applyAndSync(
      qc,
      (prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      () => api.updateProject(id, updates as Partial<StoredProject>),
      "Mise à jour projet échouée",
    );
  }, [qc]);

  const deleteProject = useCallback((id: string) => {
    applyAndSync(
      qc,
      (prev) => prev.filter((p) => p.id !== id),
      () => api.deleteProject(id),
      "Suppression projet échouée",
    );
  }, [qc]);

  const addFeedback = useCallback((projectId: string, taskId: string, feedback: Omit<TaskFeedback, "id" | "createdAt">) => {
    const newFeedback: TaskFeedback = { ...feedback, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId ? { ...p, feedbacks: [...(p.feedbacks || []), newFeedback] } : p,
      ),
      () => api.createReview({ ...newFeedback, projectId }),
      "Ajout retour échoué",
    );
  }, [qc]);

  const updateFeedback = useCallback((projectId: string, feedbackId: string, updates: Partial<Pick<TaskFeedback, "comment" | "status" | "author">>) => {
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, feedbacks: (p.feedbacks || []).map((f) => f.id === feedbackId ? { ...f, ...updates } : f) }
          : p,
      ),
      () => api.updateReview(feedbackId, updates as Pick<TaskFeedback, "comment" | "status">),
      "Mise à jour retour échouée",
    );
  }, [qc]);

  const deleteFeedback = useCallback((projectId: string, feedbackId: string) => {
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, feedbacks: (p.feedbacks || []).filter((f) => f.id !== feedbackId) }
          : p,
      ),
      () => api.deleteReview(feedbackId),
      "Suppression retour échouée",
    );
  }, [qc]);

  const updateTaskSubtasks = useCallback((projectId: string, taskId: string, subtasks: SubTask[]) => {
    const before = snapshot(qc);
    const next = before.map((p) =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, subtasks } : t) }
        : p,
    );
    setCache(qc, () => next);
    const updated = next.find((p) => p.id === projectId);
    if (updated) {
      api.updateProject(projectId, { tasks: updated.tasks } as Partial<StoredProject>)
        .then(() => qc.invalidateQueries({ queryKey: PROJECTS_KEY }))
        .catch((err) => {
          qc.setQueryData(PROJECTS_KEY, before);
          notifyError("Mise à jour étape échouée", err);
        });
    }
    void taskId;
  }, [qc]);

  const toggleTaskComplete = useCallback((projectId: string, taskId: string) => {
    const before = snapshot(qc);
    const next = before.map((p) =>
      p.id === projectId
        ? {
            ...p,
            tasks: p.tasks.map((t) =>
              t.id === taskId ? { ...t, completed: !t.completed } : t,
            ),
          }
        : p,
    );
    setCache(qc, () => next);
    const updated = next.find((p) => p.id === projectId);
    if (updated) {
      api.updateProject(projectId, { tasks: updated.tasks } as Partial<StoredProject>)
        .then(() => qc.invalidateQueries({ queryKey: PROJECTS_KEY }))
        .catch((err) => {
          qc.setQueryData(PROJECTS_KEY, before);
          notifyError("Mise à jour étape échouée", err);
        });
    }
  }, [qc]);

  const addFeedbackRequest = useCallback((projectId: string, taskId: string, request: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) => {
    const newReq: FeedbackRequest = {
      ...request,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, feedbackRequests: [...(t.feedbackRequests || []), newReq] } : t) }
          : p,
      ),
      () => api.createFeedbackRequest({ ...newReq, taskId }),
      "Demande de retour échouée",
    );
  }, [qc]);

  const deleteFeedbackRequest = useCallback((projectId: string, taskId: string, requestId: string) => {
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, feedbackRequests: (t.feedbackRequests || []).filter((r) => r.id !== requestId) }
                  : t,
              ),
            }
          : p,
      ),
      () => api.deleteFeedbackRequest(requestId),
      "Suppression demande échouée",
    );
  }, [qc]);

  const respondToFeedbackRequest = useCallback((projectId: string, taskId: string, requestId: string, response: string) => {
    const isApproval = response === "approved";
    const isRevision = response.startsWith("changes:");
    const now = new Date().toISOString();

    applyAndSync(
      qc,
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
            : t,
        );

        // Sequential locking: if approved, check if all requests on this step are resolved.
        // If so, mark step as completed and open the next locked step.
        if (isApproval) {
          const currentTask = updatedTasks.find((t) => t.id === taskId);
          const allResolved = currentTask?.feedbackRequests?.every((r) => r.resolved) ?? true;

          if (allResolved && currentTask) {
            updatedTasks = updatedTasks.map((t) =>
              t.id === taskId
                ? { ...t, status: "completed" as const, completed: true, completedAt: now }
                : t,
            );

            const sortedTasks = [...updatedTasks].sort((a, b) => a.order - b.order);
            const currentOrder = currentTask.order;
            const nextLocked = sortedTasks.find(
              (t) => t.order > currentOrder && t.status === "locked",
            );
            if (nextLocked) {
              updatedTasks = updatedTasks.map((t) =>
                t.id === nextLocked.id
                  ? { ...t, status: "open" as const }
                  : t,
              );
            }
          }
        }

        return { ...p, tasks: updatedTasks };
      }),
      () => api.resolveFeedbackRequest(requestId, response),
      "Réponse retour échouée",
    );
  }, [qc]);

  const toggleStakeholderHighlight = useCallback((projectId: string, taskId: string, requestId: string) => {
    const current = snapshot(qc);
    const project = current.find((p) => p.id === projectId);
    const task = project?.tasks.find((t) => t.id === taskId);
    const req = task?.feedbackRequests?.find((r) => r.id === requestId);
    const newValue = !req?.stakeholderHighlight;

    applyAndSync(
      qc,
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
                          : r,
                      ),
                    }
                  : t,
              ),
            }
          : p,
      ),
      () => api.updateFeedbackRequest(requestId, { stakeholderHighlight: newValue }),
      "Mise à jour surlignage échouée",
    );
  }, [qc]);

  const addDelivery = useCallback((projectId: string, delivery: Omit<Delivery, "id" | "createdAt">) => {
    const newDelivery: Delivery = {
      ...delivery,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const before = snapshot(qc);
    const updated = before.find((p) => p.id === projectId);
    const updatedDeliveries = [...(updated?.deliveries || []), newDelivery];
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, deliveries: [...(p.deliveries || []), newDelivery] }
          : p,
      ),
      () => api.updateProject(projectId, { deliveries: updatedDeliveries } as Partial<StoredProject>),
      "Ajout livrable échoué",
    );
  }, [qc]);

  const deleteDelivery = useCallback((projectId: string, deliveryId: string) => {
    const before = snapshot(qc);
    const updated = before.find((p) => p.id === projectId);
    const updatedDeliveries = (updated?.deliveries || []).filter((d) => d.id !== deliveryId);
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? { ...p, deliveries: (p.deliveries || []).filter((d) => d.id !== deliveryId) }
          : p,
      ),
      () => api.updateProject(projectId, { deliveries: updatedDeliveries } as Partial<StoredProject>),
      "Suppression livrable échouée",
    );
  }, [qc]);

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
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, comments: [...(t.comments || []), newComment] }
                  : t,
              ),
            }
          : p,
      ),
      () => apiAddStepComment(taskId, comment),
      "Ajout commentaire échoué",
    );
  }, [qc]);

  const updateStepStatus = useCallback((projectId: string, taskId: string, status: StepStatus) => {
    const now = new Date().toISOString();
    applyAndSync(
      qc,
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
                  : t,
              ),
            }
          : p,
      ),
      () => api.updateProject(projectId, {} as Partial<StoredProject>),
      "Mise à jour statut échouée",
    );
  }, [qc]);

  const updateProjectPhases = useCallback((projectId: string, phases: ProjectPhase[]) => {
    setCache(qc, (prev) => prev.map((p) =>
      p.id === projectId ? { ...p, phases } : p,
    ));
  }, [qc]);

  const setShareToken = useCallback((projectId: string, token: string | null) => {
    applyAndSync(
      qc,
      (prev) => prev.map((p) =>
        p.id === projectId ? { ...p, shareToken: token } : p,
      ),
      () => api.updateProject(projectId, { shareToken: token } as Partial<StoredProject>),
      "Partage projet échoué",
    );
  }, [qc]);

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id || p.clientSlug === id),
    [projects],
  );

  return {
    projects,
    loading: isLoading,
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
  };
}
