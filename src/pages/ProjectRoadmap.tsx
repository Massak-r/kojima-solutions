import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { TimelineTask } from "@/types/timeline";
import { TaskFormPanel } from "@/components/TaskFormPanel";
import { TimelineView } from "@/components/TimelineView";
import { HorizontalTimelineView } from "@/components/HorizontalTimelineView";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { SubtaskManager, FeedbackRequestCreator } from "@/components/SubtaskManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, AlignVerticalSpaceAround, AlignHorizontalSpaceAround, X, Download } from "lucide-react";
import { useState } from "react";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProjectRoadmap() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject, updateTaskSubtasks, addFeedbackRequest } = useProjects();
  const project = getProject(id!);

  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null);
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("vertical");
  const [managingTask, setManagingTask] = useState<TimelineTask | null>(null);

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Project not found</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft size={14} className="mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const tasks = project.tasks;

  // Keep managingTask in sync with latest data
  const currentManagingTask = managingTask ? tasks.find((t) => t.id === managingTask.id) || null : null;

  function handleAdd(task: Omit<TimelineTask, "id">) {
    updateProject(id!, { tasks: [...tasks, { ...task, id: generateId() }] });
  }

  function handleEdit(updated: TimelineTask) {
    updateProject(id!, { tasks: tasks.map((t) => (t.id === updated.id ? updated : t)) });
    setEditingTask(null);
  }

  function handleDelete(taskId: string) {
    updateProject(id!, { tasks: tasks.filter((t) => t.id !== taskId) });
  }

  function handleStartEdit(task: TimelineTask) {
    setEditingTask(task);
    setManagingTask(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleManageSubtasks(task: TimelineTask) {
    setManagingTask(task);
    setEditingTask(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(`/project/${id}/details`)}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft size={16} className="mr-2" />
            Project Details
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate(`/project/${id}/overview`)}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs"
          >
            <Download size={14} className="mr-1.5" />
            Export PDF
          </Button>
        </div>
      </header>

      <ProjectStepNav projectId={id!} currentStep="roadmap" />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl md:text-3xl text-foreground font-bold mb-6">
          {project.title} — Roadmap
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-8 flex flex-col gap-4">
            {currentManagingTask ? (
              <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-foreground">{currentManagingTask.title}</h2>
                  <button onClick={() => setManagingTask(null)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>

                <SubtaskManager
                  subtasks={currentManagingTask.subtasks || []}
                  onChange={(subtasks) => updateTaskSubtasks(id!, currentManagingTask.id, subtasks)}
                />

                <div className="border-t border-border pt-4">
                  <FeedbackRequestCreator
                    onAdd={(type, message) => addFeedbackRequest(id!, currentManagingTask.id, { type, message })}
                  />
                </div>

                {/* Show existing requests */}
                {(currentManagingTask.feedbackRequests || []).length > 0 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="font-display text-xs font-semibold text-muted-foreground">Requests</p>
                    {(currentManagingTask.feedbackRequests || []).map((req) => (
                      <div key={req.id} className={`rounded p-2 text-xs font-body ${req.resolved ? "bg-palette-sage/10 text-palette-sage" : "bg-palette-amber/10 text-palette-amber"}`}>
                        <span className="font-medium">{req.type === "file" ? "📎" : "💬"}</span>{" "}
                        {req.message}
                        {req.resolved && req.response && (
                          <p className="mt-1 text-foreground/70">↳ {req.response}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <TaskFormPanel
                onAdd={handleAdd}
                onEdit={handleEdit}
                editingTask={editingTask}
                onCancelEdit={() => setEditingTask(null)}
                taskCount={tasks.length}
              />
            )}

            {tasks.length > 0 && (
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-3">
                  Summary
                </p>
                <div className="flex justify-between font-body text-sm mb-3">
                  <span className="text-foreground/70">Total tasks</span>
                  <span className="font-semibold text-foreground">{tasks.length}</span>
                </div>

                <div className="flex gap-1 mb-3 p-1 bg-secondary/50 rounded-lg">
                  <button
                    onClick={() => setViewMode("vertical")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-body font-medium transition-all ${
                      viewMode === "vertical"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <AlignVerticalSpaceAround size={13} />
                    Vertical
                  </button>
                  <button
                    onClick={() => setViewMode("horizontal")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-body font-medium transition-all ${
                      viewMode === "horizontal"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <AlignHorizontalSpaceAround size={13} />
                    Horizontal
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => navigate(`/project/${id}/overview`)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body gap-2"
              >
                View Overview
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 min-w-0">
            {viewMode === "vertical" ? (
              <TimelineView
                tasks={tasks}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                onManageSubtasks={handleManageSubtasks}
                onRequestFeedback={handleManageSubtasks}
              />
            ) : (
              <HorizontalTimelineView
                tasks={tasks}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                onManageSubtasks={handleManageSubtasks}
                onRequestFeedback={handleManageSubtasks}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
