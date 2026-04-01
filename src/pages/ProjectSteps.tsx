import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Plus, Link2, Check, Loader2, Blocks, Download, BookTemplate, Save,
  Printer, X, ArrowLeft, Users,
} from "lucide-react";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { TaskFormPanel, type FunnelPhaseOption } from "@/components/TaskFormPanel";
import { SubtaskManager } from "@/components/SubtaskManager";
import { UnifiedStepCard } from "@/components/steps/UnifiedStepCard";
import { PhaseGroupHeader } from "@/components/steps/PhaseGroupHeader";
import { StepRequestEditor } from "@/components/steps/StepRequestEditor";
import { StakeholderManager } from "@/components/steps/StakeholderManager";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/contexts/ProjectsContext";
import { useToast } from "@/hooks/use-toast";
import { shareProject, unshareProject } from "@/api/stakeholder";
import { createPhase as apiCreatePhase, updatePhase as apiUpdatePhase, deletePhase as apiDeletePhase, listProjectPhases } from "@/api/phases";
import { getProjectModules } from "@/api/modules";
import { generateTasksFromModules } from "@/lib/moduleGenerators";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { TimelineTask, SubTask, FeedbackRequest } from "@/types/timeline";
import type { ProjectPhase } from "@/types/phase";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProjectSteps() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getProject, updateProject, updateTaskSubtasks,
    addFeedbackRequest, deleteFeedbackRequest,
    addStepComment, updateStepStatus, updateProjectPhases, setShareToken,
  } = useProjects();
  const { toast } = useToast();
  const project = getProject(id!);

  const [editingTask, setEditingTask] = useState<TimelineTask | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [addingRequestForTask, setAddingRequestForTask] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedClientLink, setCopiedClientLink] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(true);
  const [showModuleImport, setShowModuleImport] = useState(false);
  const [showStakeholders, setShowStakeholders] = useState(false);
  const [moduleTaskPreview, setModuleTaskPreview] = useState<TimelineTask[]>([]);

  // Load phases
  useEffect(() => {
    if (!id) return;
    listProjectPhases(id)
      .then((data) => {
        setPhases(data);
        updateProjectPhases(id, data);
      })
      .catch(() => {})
      .finally(() => setLoadingPhases(false));
  }, [id]);

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Projet introuvable</p>
          <Button onClick={() => navigate("/projects")} variant="outline">
            <ArrowLeft size={16} className="mr-2" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const tasks = project.tasks;
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

  // Group tasks by phase
  const unphased = sortedTasks.filter((t) => !t.phaseId);
  const tasksByPhase = useMemo(() => {
    const map: Record<string, TimelineTask[]> = {};
    for (const t of sortedTasks) {
      if (t.phaseId) {
        if (!map[t.phaseId]) map[t.phaseId] = [];
        map[t.phaseId].push(t);
      }
    }
    return map;
  }, [sortedTasks]);

  const funnelPhaseOptions: FunnelPhaseOption[] = phases.map((p) => ({ id: p.id, title: p.title }));

  // --- Handlers ---

  function handleAdd(task: Omit<TimelineTask, "id">) {
    updateProject(id!, { tasks: [...tasks, { ...task, id: generateId(), status: "open" }] });
    setEditingTask(null);
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

  function handleStartEdit(task: TimelineTask) {
    setEditingTask(task);
    setAddingRequestForTask(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStatusChange(taskId: string, status: "locked" | "open" | "completed") {
    updateStepStatus(id!, taskId, status);
  }

  function handleAddRequest(taskId: string) {
    setAddingRequestForTask(taskId);
    setEditingTask(null);
  }

  function handleSubmitRequest(taskId: string, request: Omit<FeedbackRequest, "id" | "createdAt" | "resolved">) {
    addFeedbackRequest(id!, taskId, request);
    setAddingRequestForTask(null);
    toast({ title: "Demande ajoutee" });
  }

  function handleDeleteRequest(taskId: string, requestId: string) {
    deleteFeedbackRequest(id!, taskId, requestId);
  }

  function handleComment(taskId: string, data: { message: string; authorName?: string; authorRole?: "client" | "admin" | "stakeholder" }) {
    addStepComment(id!, taskId, data);
  }

  async function handleShareLink() {
    try {
      if (project!.shareToken) {
        const url = `${window.location.origin}/project/s/${project!.shareToken}`;
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        toast({ title: "Lien stakeholder copie" });
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        const token = await shareProject(id!);
        setShareToken(id!, token);
        const url = `${window.location.origin}/project/s/${token}`;
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        toast({ title: "Lien stakeholder cree et copie" });
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleAddPhase() {
    if (!newPhaseTitle.trim()) return;
    try {
      const phase = await apiCreatePhase({
        projectId: id!,
        title: newPhaseTitle.trim(),
      });
      setPhases((prev) => [...prev, phase]);
      updateProjectPhases(id!, [...phases, phase]);
      setNewPhaseTitle("");
      setAddingPhase(false);
      toast({ title: "Phase ajoutee" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleUpdatePhaseTitle(phaseId: string, title: string) {
    try {
      await apiUpdatePhase(phaseId, { title });
      setPhases((prev) => prev.map((p) => p.id === phaseId ? { ...p, title } : p));
    } catch {}
  }

  async function handleUpdatePhaseBudget(phaseId: string, budget: number) {
    try {
      await apiUpdatePhase(phaseId, { budget });
      setPhases((prev) => prev.map((p) => p.id === phaseId ? { ...p, budget } : p));
    } catch {}
  }

  async function handleDeletePhase(phaseId: string) {
    try {
      await apiDeletePhase(phaseId);
      setPhases((prev) => prev.filter((p) => p.id !== phaseId));
      // Move tasks from deleted phase to unphased
      const updated = tasks.map((t) => t.phaseId === phaseId ? { ...t, phaseId: undefined } : t);
      updateProject(id!, { tasks: updated });
      toast({ title: "Phase supprimee" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleImportFromModules() {
    if (!id) return;
    const data = await getProjectModules(id);
    if (!data || data.modules.length === 0) {
      toast({ title: "Aucun module selectionne", variant: "destructive" });
      return;
    }
    const generated = generateTasksFromModules(data.modules);
    const existingTitles = new Set(tasks.map((t) => t.title));
    const fresh = generated.filter((t) => !existingTitles.has(t.title));
    if (fresh.length === 0) {
      toast({ title: "Toutes les taches modules sont deja importees" });
      return;
    }
    setModuleTaskPreview(fresh);
    setShowModuleImport(true);
  }

  function confirmModuleImport() {
    const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), -1);
    const adjusted = moduleTaskPreview.map((t, i) => ({ ...t, order: maxOrder + 1 + i, status: "open" as const }));
    updateProject(id!, { tasks: [...tasks, ...adjusted] });
    setShowModuleImport(false);
    setModuleTaskPreview([]);
  }

  // Render a group of steps
  function renderStepList(stepList: TimelineTask[]) {
    return stepList.map((task, idx) => (
      <div key={task.id}>
        <UnifiedStepCard
          task={task}
          isLast={idx === stepList.length - 1}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onSubtasksChange={(taskId, subtasks) => updateTaskSubtasks(id!, taskId, subtasks)}
          onAddComment={handleComment}
          onAddRequest={handleAddRequest}
          onDeleteRequest={handleDeleteRequest}
          deleteConfirmId={deleteConfirmId}
          onDeleteConfirm={(taskId) => setDeleteConfirmId(taskId)}
          onCancelDelete={() => setDeleteConfirmId(null)}
        />
        {addingRequestForTask === task.id && (
          <div className="ml-8 mt-2 mb-3">
            <StepRequestEditor
              onAdd={(r) => handleSubmitRequest(task.id, r)}
              onCancel={() => setAddingRequestForTask(null)}
            />
          </div>
        )}
      </div>
    ));
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print"><ProjectStepNav projectId={id!} currentStep="etapes" /></div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="font-display text-2xl md:text-3xl text-foreground font-bold">
            {project.title} - Etapes
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const slug = project!.clientSlug || id;
                const url = `${window.location.origin}/client/${slug}`;
                await navigator.clipboard.writeText(url);
                setCopiedClientLink(true);
                toast({ title: "Lien portail client copie" });
                setTimeout(() => setCopiedClientLink(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-primary/40"
              title="Copier le lien portail client"
            >
              {copiedClientLink ? <Check size={13} className="text-emerald-500" /> : <Link2 size={13} />}
              <span className="hidden sm:inline">Lien client</span>
            </button>
            <button
              onClick={() => setShowStakeholders(!showStakeholders)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-body transition-colors px-2.5 py-1.5 rounded-lg border",
                showStakeholders
                  ? "text-primary border-primary/40 bg-primary/5"
                  : "text-muted-foreground hover:text-primary border-border/60 hover:border-primary/40",
              )}
              title="Gérer les parties prenantes"
            >
              <Users size={13} />
              <span className="hidden sm:inline">Stakeholders</span>
            </button>
            <button
              onClick={handleShareLink}
              className="flex items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg border border-border/60 hover:border-primary/40"
              title="Copier le lien stakeholder"
            >
              {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Link2 size={13} />}
              <span className="hidden sm:inline">Lien</span>
            </button>
            <Button
              variant="outline" size="sm"
              onClick={() => window.print()}
              className="text-xs gap-1.5"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
          </div>
        </div>

        {/* Stakeholder management panel */}
        {showStakeholders && (
          <div className="mb-6 no-print">
            <StakeholderManager projectId={id!} />
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar */}
          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-20 flex flex-col gap-3 no-print">
            <TaskFormPanel
              onAdd={handleAdd}
              onEdit={handleEdit}
              editingTask={editingTask}
              onCancelEdit={() => setEditingTask(null)}
              taskCount={tasks.length}
              funnelPhases={funnelPhaseOptions}
            />

            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={handleImportFromModules}>
              <Blocks size={14} />
              Importer depuis les modules
            </Button>

            {/* Summary */}
            {tasks.length > 0 && (
              <div className="rounded-xl bg-card border border-border p-3">
                <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Resume</p>
                <div className="space-y-1.5 text-xs font-body">
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Total etapes</span>
                    <span className="font-semibold text-foreground">{tasks.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Terminees</span>
                    <span className="font-semibold text-emerald-600">
                      {tasks.filter((t) => t.status === "completed" || t.completed).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/60">En attente</span>
                    <span className="font-semibold text-amber-500">
                      {tasks.filter((t) => (t.feedbackRequests || []).some((r) => !r.resolved)).length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main timeline */}
          <div className="flex-1 min-w-0 space-y-2">
            {loadingPhases ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-muted-foreground/40" />
              </div>
            ) : (
              <>
                {/* Phased tasks */}
                {phases.map((phase) => {
                  const phaseTasks = tasksByPhase[phase.id] || [];
                  const completedCount = phaseTasks.filter((t) => t.status === "completed" || t.completed).length;
                  const isCollapsed = collapsedPhases.has(phase.id);

                  return (
                    <div key={phase.id}>
                      <PhaseGroupHeader
                        phase={phase}
                        completedCount={completedCount}
                        totalCount={phaseTasks.length}
                        collapsed={isCollapsed}
                        onToggleCollapse={() => {
                          setCollapsedPhases((prev) => {
                            const next = new Set(prev);
                            next.has(phase.id) ? next.delete(phase.id) : next.add(phase.id);
                            return next;
                          });
                        }}
                        onTitleChange={(t) => handleUpdatePhaseTitle(phase.id, t)}
                        onBudgetChange={(b) => handleUpdatePhaseBudget(phase.id, b)}
                        onDelete={() => handleDeletePhase(phase.id)}
                      />

                      {!isCollapsed && (
                        <div className="mt-2 space-y-1">
                          {phaseTasks.length > 0 ? (
                            renderStepList(phaseTasks)
                          ) : (
                            <p className="ml-8 text-xs text-muted-foreground/40 font-body py-2">
                              Aucune etape dans cette phase
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unphased tasks */}
                {unphased.length > 0 && (
                  <div className={phases.length > 0 ? "mt-6" : ""}>
                    {phases.length > 0 && (
                      <div className="flex items-center gap-2 py-2 px-3 bg-secondary/10 rounded-lg mb-2">
                        <div className="w-0.5 h-4 rounded-full bg-muted-foreground/20" />
                        <span className="font-display text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">
                          Sans phase
                        </span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {renderStepList(unphased)}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {tasks.length === 0 && phases.length === 0 && (
                  <div className="text-center py-16">
                    <p className="font-body text-sm text-muted-foreground/50">
                      Ajoutez des etapes pour structurer le projet
                    </p>
                  </div>
                )}

                {/* Add phase button */}
                <div className="mt-4">
                  {addingPhase ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newPhaseTitle}
                        onChange={(e) => setNewPhaseTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddPhase()}
                        placeholder="Nom de la phase (ex: Phase 1 - Conception)"
                        className="flex-1 text-sm"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleAddPhase} disabled={!newPhaseTitle.trim()}>
                        Ajouter
                      </Button>
                      <button onClick={() => { setAddingPhase(false); setNewPhaseTitle(""); }}
                        className="text-sm text-muted-foreground">
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingPhase(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border/40 rounded-xl text-sm text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-colors font-body"
                    >
                      <Plus size={14} /> Ajouter une phase
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Module import dialog */}
      <Dialog open={showModuleImport} onOpenChange={setShowModuleImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importer des etapes depuis les modules</DialogTitle>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {moduleTaskPreview.map((t) => (
              <div key={t.id} className="text-sm font-body flex items-start gap-2 py-1">
                <span className="text-primary mt-0.5">&#x2022;</span>
                <div>
                  <div className="font-medium">{t.title}</div>
                  {t.subtasks && t.subtasks.length > 0 && (
                    <div className="text-[10px] text-muted-foreground">{t.subtasks.length} sous-taches</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowModuleImport(false)}>Annuler</Button>
            <Button size="sm" onClick={confirmModuleImport}>
              Ajouter {moduleTaskPreview.length} etapes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
