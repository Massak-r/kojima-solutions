import { useNavigate } from "react-router-dom";
import { useProjects, StoredProject } from "@/contexts/ProjectsContext";
import { Button } from "@/components/ui/button";
import { Plus, LayoutList, User, CalendarDays, Trash2, GripVertical, Link2, MessageSquare, Loader2, Search, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useState, useMemo } from "react";
import { ProjectData } from "@/types/project";
import { useToast } from "@/hooks/use-toast";

const COLUMNS: { status: StoredProject["status"]; label: string; accent: string; emptyColor: string }[] = [
  { status: "draft",       label: "Draft",       accent: "border-muted-foreground/30", emptyColor: "border-muted-foreground/10" },
  { status: "in-progress", label: "In Progress", accent: "border-primary/40",          emptyColor: "border-primary/10" },
  { status: "completed",   label: "Completed",   accent: "border-palette-sage/40",     emptyColor: "border-palette-sage/10" },
  { status: "on-hold",     label: "On Hold",     accent: "border-palette-amber/40",    emptyColor: "border-palette-amber/10" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { projects, loading, createProject, deleteProject, updateProject } = useProjects();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(() => {
    try { return localStorage.getItem("dashboard_show_completed") === "true"; }
    catch { return false; }
  });

  const filteredProjects = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q));
    }
    return list;
  }, [projects, search]);

  const visibleColumns = useMemo(
    () => showCompleted ? COLUMNS : COLUMNS.filter((c) => c.status !== "completed"),
    [showCompleted],
  );

  function toggleShowCompleted() {
    setShowCompleted((prev) => {
      const next = !prev;
      localStorage.setItem("dashboard_show_completed", String(next));
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleCreate() {
    const p = createProject();
    navigate(`/project/${p.id}/brief`);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const newStatus = over.id as ProjectData["status"];
    const project = projects.find((p) => p.id === active.id);
    if (project && project.status !== newStatus) {
      updateProject(active.id as string, { status: newStatus });
    }
  }

  function handleCopyLink(project: StoredProject) {
    const url = `${window.location.origin}/client/${project.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Client link copied!", description: url });
    });
  }

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;

  // Count total pending client responses across all projects (for header badge)
  const totalPending = projects.reduce((sum, p) => {
    const pending = p.tasks.flatMap((t) => t.feedbackRequests || []).filter((r) => r.resolved && r.response).length;
    return sum + pending;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <LayoutList size={22} className="text-accent" />
            <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary-foreground/60">
              Project Management
            </span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-3xl md:text-4xl leading-tight font-bold">
                  Dashboard
                </h1>
                {totalPending > 0 && (
                  <span className="bg-palette-amber text-white text-xs font-bold font-body px-2 py-0.5 rounded-full">
                    {totalPending} new response{totalPending > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="font-body text-primary-foreground/65 mt-1 text-sm max-w-lg">
                Manage your projects, track progress, and build roadmaps.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={toggleShowCompleted}
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-body text-xs gap-1.5"
              >
                {showCompleted ? <EyeOff size={14} /> : <Eye size={14} />}
                {showCompleted ? "Masquer terminés" : "Terminés"}
              </Button>
              <Button
                onClick={handleCreate}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-2"
              >
                <Plus size={16} />
                New Project
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <LayoutList size={28} className="text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground mb-2">No projects yet</h2>
            <p className="font-body text-sm text-muted-foreground mb-6 max-w-sm">
              Create your first project to start building roadmaps and sharing them with clients.
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus size={16} />
              Create your first project
            </Button>
          </div>
        ) : (
          <>
            <div className="relative max-w-sm mb-6">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un projet..."
                className="pl-9 font-body text-sm"
              />
            </div>
            {search.trim() && filteredProjects.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-body text-sm">
                Aucun projet trouvé pour « {search} ».
              </div>
            ) : (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${visibleColumns.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-5`}>
                  {visibleColumns.map((col) => {
                    const items = filteredProjects.filter((p) => p.status === col.status);
                    return (
                      <DroppableColumn key={col.status} col={col} items={items} activeId={activeId}>
                        {items.map((project) => (
                          <DraggableCard
                            key={project.id}
                            project={project}
                            onClick={() => navigate(`/project/${project.id}/brief`)}
                            onDelete={() => deleteProject(project.id)}
                            onCopyLink={() => handleCopyLink(project)}
                            isDragging={activeId === project.id}
                          />
                        ))}
                      </DroppableColumn>
                    );
                  })}
                </div>

                <DragOverlay>
                  {activeProject && (
                    <ProjectCard
                      project={activeProject}
                      onClick={() => {}}
                      onDelete={() => {}}
                      onCopyLink={() => {}}
                      isOverlay
                    />
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DroppableColumn({
  col,
  items,
  activeId,
  children,
}: {
  col: typeof COLUMNS[number];
  items: StoredProject[];
  activeId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });

  return (
    <div className="flex flex-col">
      <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.accent}`}>
        <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          {col.label}
        </h2>
        <span className="text-xs font-body text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-3 min-h-[120px] rounded-xl p-2 transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-transparent"
        }`}
      >
        {items.length === 0 && !activeId && (
          <div className={`border-2 border-dashed ${col.emptyColor} rounded-lg h-[80px] flex items-center justify-center`}>
            <p className="text-xs font-body text-muted-foreground/50">Drop here</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function DraggableCard({
  project,
  onClick,
  onDelete,
  onCopyLink,
  isDragging,
}: {
  project: StoredProject;
  onClick: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: project.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40" : ""}
    >
      <ProjectCard
        project={project}
        onClick={onClick}
        onDelete={onDelete}
        onCopyLink={onCopyLink}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  onDelete,
  onCopyLink,
  dragHandleProps,
  isOverlay,
}: {
  project: StoredProject;
  onClick: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isOverlay?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Count client responses (resolved requests that the client has answered)
  const pendingResponses = project.tasks
    .flatMap((t) => t.feedbackRequests || [])
    .filter((r) => r.resolved && r.response).length;

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-shadow cursor-pointer group relative ${
        isOverlay ? "rotate-2 shadow-xl scale-105 opacity-95" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 p-1 rounded text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-all"
        title="Drag to move"
      >
        <GripVertical size={13} />
      </button>

      {/* Top-right actions */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => { e.stopPropagation(); onCopyLink(); }}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-all"
          title="Copy client link"
        >
          <Link2 size={12} />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="px-2 py-0.5 rounded text-[10px] bg-destructive text-white font-semibold"
            >
              Delete
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Delete project"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <h3 className="font-display text-sm font-semibold text-foreground mb-1 px-5 line-clamp-2">
        {project.title}
      </h3>

      {project.client && (
        <div className="flex items-center gap-1.5 text-muted-foreground font-body text-xs mb-2">
          <User size={11} />
          <span>{project.client}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {project.tasks.length > 0 && (
            <span className="text-xs font-body text-muted-foreground">
              {project.tasks.length} {project.tasks.length === 1 ? "task" : "tasks"}
            </span>
          )}
          {pendingResponses > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-body font-semibold bg-palette-amber/15 text-palette-amber border border-palette-amber/30 rounded-full px-2 py-0.5">
              <MessageSquare size={9} />
              {pendingResponses} response{pendingResponses > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {project.startDate && (
          <span className="text-xs font-body text-muted-foreground flex items-center gap-1">
            <CalendarDays size={10} />
            {new Date(project.startDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
