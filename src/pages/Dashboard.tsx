import { useNavigate } from "react-router-dom";
import { useProjects, StoredProject } from "@/contexts/ProjectsContext";
import { STATUS_LABELS } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Plus, LayoutList, User, CalendarDays, Trash2, GripVertical } from "lucide-react";
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
import { useState } from "react";
import { ProjectData } from "@/types/project";

const COLUMNS: { status: StoredProject["status"]; label: string; accent: string; emptyColor: string }[] = [
  { status: "draft",       label: "Draft",       accent: "border-muted-foreground/30", emptyColor: "border-muted-foreground/10" },
  { status: "in-progress", label: "In Progress", accent: "border-primary/40",          emptyColor: "border-primary/10" },
  { status: "completed",   label: "Completed",   accent: "border-palette-sage/40",     emptyColor: "border-palette-sage/10" },
  { status: "on-hold",     label: "On Hold",     accent: "border-palette-amber/40",    emptyColor: "border-palette-amber/10" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, createProject, deleteProject, updateProject } = useProjects();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleCreate() {
    const p = createProject();
    navigate(`/project/${p.id}/details`);
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

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;

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
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl leading-tight font-bold">
                Dashboard
              </h1>
              <p className="font-body text-primary-foreground/65 mt-1 text-sm max-w-lg">
                Manage your projects, track progress, and build roadmaps.
              </p>
            </div>
            <Button
              onClick={handleCreate}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-2"
            >
              <Plus size={16} />
              New Project
            </Button>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {COLUMNS.map((col) => {
              const items = projects.filter((p) => p.status === col.status);
              return (
                <DroppableColumn key={col.status} col={col} items={items} activeId={activeId}>
                  {items.map((project) => (
                    <DraggableCard
                      key={project.id}
                      project={project}
                      onClick={() => navigate(`/project/${project.id}/details`)}
                      onDelete={() => deleteProject(project.id)}
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
                isOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
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
  isDragging,
}: {
  project: StoredProject;
  onClick: () => void;
  onDelete: () => void;
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
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  onDelete,
  dragHandleProps,
  isOverlay,
}: {
  project: StoredProject;
  onClick: () => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isOverlay?: boolean;
}) {
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

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
        title="Delete project"
      >
        <Trash2 size={13} />
      </button>

      <h3 className="font-display text-sm font-semibold text-foreground mb-1 px-5 line-clamp-2">
        {project.title}
      </h3>

      {project.client && (
        <div className="flex items-center gap-1.5 text-muted-foreground font-body text-xs mb-2">
          <User size={11} />
          <span>{project.client}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {project.tasks.length > 0 && (
          <span className="text-xs font-body text-muted-foreground">
            {project.tasks.length} {project.tasks.length === 1 ? "task" : "tasks"}
          </span>
        )}
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
