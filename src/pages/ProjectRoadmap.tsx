import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { TimelineTask, SubTask } from "@/types/timeline";
import { TaskFormPanel, type FunnelPhaseOption } from "@/components/TaskFormPanel";
import { TimelineView } from "@/components/TimelineView";
import { HorizontalTimelineView } from "@/components/HorizontalTimelineView";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { SubtaskManager } from "@/components/SubtaskManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, AlignVerticalSpaceAround, AlignHorizontalSpaceAround, X, Download, GitBranch } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { getFunnelByProject, type ProjectFunnel } from "@/api/funnels";
import { getProjectModules } from "@/api/modules";
import { generateTasksFromModules } from "@/lib/moduleGenerators";
import { Blocks } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProjectRoadmap() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject, updateTaskSubtasks, toggleTaskComplete } = useProjects();
  const { toast } = useToast();
  const project = getProject(id!);

  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null);
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("vertical");
  const [managingTask, setManagingTask] = useState<TimelineTask | null>(null);
  const [funnelPhases, setFunnelPhases] = useState<FunnelPhaseOption[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showModuleImport, setShowModuleImport] = useState(false);
  const [moduleTaskPreview, setModuleTaskPreview] = useState<TimelineTask[]>([]);

  useEffect(() => {
    if (id) {
      getFunnelByProject(id)
        .then((f) => {
          if (f && f.phases) {
            setFunnelPhases(f.phases.map((p) => ({ id: p.id, title: p.title })));
          }
        })
        .catch(() => {});
    }
  }, [id]);

  async function handleImportFromModules() {
    if (!id) return;
    const data = await getProjectModules(id);
    if (!data || data.modules.length === 0) return;
    const generated = generateTasksFromModules(data.modules);
    // Filter out tasks whose module-based titles already exist
    const existingTitles = new Set(tasks.map((t) => t.title));
    const fresh = generated.filter((t) => !existingTitles.has(t.title));
    if (fresh.length === 0) {
      toast({ title: "Toutes les tâches modules sont déjà importées" });
      return;
    }
    setModuleTaskPreview(fresh);
    setShowModuleImport(true);
  }

  function confirmModuleImport() {
    const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), -1);
    const adjusted = moduleTaskPreview.map((t, i) => ({ ...t, order: maxOrder + 1 + i }));
    updateProject(id!, { tasks: [...tasks, ...adjusted] });
    setShowModuleImport(false);
    setModuleTaskPreview([]);
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Project not found</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft size={16} className="mr-2" />
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
    if (deleteConfirmId === taskId) {
      updateProject(id!, { tasks: tasks.filter((t) => t.id !== taskId) });
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(taskId);
    }
  }

  function cancelDelete() {
    setDeleteConfirmId(null);
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

  function handleToggleComplete(taskId: string) {
    toggleTaskComplete(id!, taskId);
  }

  function handleAddSubtask(taskId: string, title: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSubtask: SubTask = {
      id: crypto.randomUUID(),
      title,
      completed: false,
    };
    updateTaskSubtasks(id!, taskId, [...(task.subtasks || []), newSubtask]);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-6 no-print">
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
            onClick={() => window.print()}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs"
          >
            <Download size={14} className="mr-1.5" />
            Export PDF
          </Button>
        </div>
      </header>

      <div className="no-print"><ProjectStepNav projectId={id!} currentStep="planning" /></div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl md:text-3xl text-foreground font-bold mb-6">
          {project.title} - Roadmap
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar */}
          <div className="roadmap-sidebar w-full lg:w-80 shrink-0 lg:sticky lg:top-8 flex flex-col gap-4">
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
              </div>
            ) : (
              <TaskFormPanel
                onAdd={handleAdd}
                onEdit={handleEdit}
                editingTask={editingTask}
                onCancelEdit={() => setEditingTask(null)}
                taskCount={tasks.length}
                funnelPhases={funnelPhases}
              />
            )}

            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleImportFromModules}>
              <Blocks size={14} />
              Importer depuis les modules
            </Button>

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
                onClick={() => navigate(`/project/${id}/feedback`)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body gap-2"
              >
                Continue to Feedback
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="roadmap-timeline flex-1 min-w-0">
            {viewMode === "vertical" ? (
              <TimelineView
                tasks={tasks}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                onManageSubtasks={handleManageSubtasks}
                onToggleComplete={handleToggleComplete}
                onAddSubtask={handleAddSubtask}
                phaseMap={Object.fromEntries(funnelPhases.map((p) => [p.id, p.title]))}
                onPhaseClick={() => navigate(`/project/${id}/suivi`)}
              />
            ) : (
              <HorizontalTimelineView
                tasks={tasks}
                onEdit={handleStartEdit}
                onDelete={handleDelete}
                onManageSubtasks={handleManageSubtasks}
              />
            )}
          </div>
        </div>
      </main>

      <Dialog open={showModuleImport} onOpenChange={setShowModuleImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importer des tâches depuis les modules</DialogTitle>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {moduleTaskPreview.map((t) => (
              <div key={t.id} className="text-sm font-body flex items-start gap-2 py-1">
                <span className="text-primary mt-0.5">&#x2022;</span>
                <div>
                  <div className="font-medium">{t.title}</div>
                  {t.subtasks && t.subtasks.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">{t.subtasks.length} sous-tâches</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowModuleImport(false)}>Annuler</Button>
            <Button size="sm" onClick={confirmModuleImport}>
              Ajouter {moduleTaskPreview.length} tâches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
