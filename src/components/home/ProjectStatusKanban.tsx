import { useNavigate } from "react-router-dom";
import { useProjects, type StoredProject } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { Button } from "@/components/ui/button";
import { Plus, User, CalendarDays, Trash2, GripVertical, Link2, MessageSquare, Loader2, Search, Eye, EyeOff, ArrowRightLeft, ChevronRight, LayoutList, CheckSquare, CheckCheck, Check, X, MoreVertical } from "lucide-react";
import { totalQuote } from "@/types/quote";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useMemo, memo, useRef, useCallback, useEffect } from "react";
import { toast as sonnerToast } from "sonner";
import { type ProjectData, type ProjectKind, KIND_LABELS, KIND_ORDER } from "@/types/project";
import { useToast } from "@/hooks/use-toast";
import { useQuickCreate } from "@/contexts/QuickCreateContext";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";

type Status = StoredProject["status"];

const COLUMNS: { status: Status; label: string; accent: string; emptyColor: string }[] = [
  { status: "draft",       label: "Brouillon",  accent: "border-muted-foreground/30", emptyColor: "border-muted-foreground/10" },
  { status: "in-progress", label: "En cours",   accent: "border-primary/40",          emptyColor: "border-primary/10" },
  { status: "completed",   label: "Terminé",    accent: "border-palette-sage/40",     emptyColor: "border-palette-sage/10" },
  { status: "on-hold",     label: "En pause",   accent: "border-palette-amber/40",    emptyColor: "border-palette-amber/10" },
];

const plural = (n: number) => (n > 1 ? "s" : "");

/**
 * Project status kanban — drag-drop between Draft / In-Progress / Completed / On-hold.
 * Self-contained: filters, search, "À facturer" banner, new project button.
 * No outer page header — designed to embed inside Home tab or any page.
 *
 * Beyond desktop drag, every card carries a tap "Déplacer vers" menu (no
 * hover-drag needed — the path mobile users actually have), and a selection
 * mode (toolbar toggle or long-press a card) batches move/delete across many
 * projects at once via a sticky action bar.
 */
export function ProjectStatusKanban() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { projects, loading, deleteProject, restoreProject, updateProject } = useProjects();
  const { open: openQuickCreate } = useQuickCreate();
  const { getClient } = useClients();
  const { quotes } = useQuotes();

  const { deleteWithUndo: deleteProjectWithUndo } = useUndoableDelete<StoredProject>({
    hardDelete: (id) => deleteProject(id),
    restore: (project) => restoreProject(project),
    message: (p) => `Projet « ${p.title || "Sans titre"} » supprimé`,
  });

  const toInvoice = useMemo(
    () => quotes
      .filter((q) => q.docType !== "invoice" && q.invoiceStatus === "validated")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [quotes],
  );
  const toInvoiceTotal = useMemo(
    () => toInvoice.reduce((sum, q) => sum + totalQuote(q), 0),
    [toInvoice],
  );
  const clientName = (p: StoredProject) => (p.clientId ? getClient(p.clientId)?.name : null) || p.client;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(() => {
    try {
      const v = localStorage.getItem("dashboard_show_completed");
      return v === null ? true : v === "true";
    } catch { return true; }
  });
  const [kindFilter, setKindFilter] = useState<ProjectKind | "all">(() => {
    try {
      const v = localStorage.getItem("dashboard_kind_filter");
      return v === "client" || v === "internal" || v === "personal" ? v : "all";
    } catch { return "all"; }
  });

  // ── Selection (bulk) mode ─────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  function setKindFilterPersist(k: ProjectKind | "all") {
    setKindFilter(k);
    try { localStorage.setItem("dashboard_kind_filter", k); } catch { /* ignore */ }
  }

  const filteredProjects = useMemo(() => {
    let list = projects.filter(p => p && p.id);
    if (kindFilter !== "all") list = list.filter((p) => (p.kind ?? "client") === kindFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.title || "").toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q));
    }
    return list;
  }, [projects, search, kindFilter]);

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

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmBulkDelete(false);
  }, []);

  // While selecting, hide the app's floating FABs (quick-capture / quick-action)
  // so they don't collide with the sticky bulk-action bar at the bottom.
  useEffect(() => {
    if (selectMode) document.body.dataset.bulkSelecting = "true";
    else delete document.body.dataset.bulkSelecting;
    return () => { delete document.body.dataset.bulkSelecting; };
  }, [selectMode]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const enterSelectWith = useCallback((id: string) => {
    setSelectMode(true);
    setSelected(new Set([id]));
  }, []);

  function selectAllVisible() {
    const ids = filteredProjects
      .filter((p) => visibleColumns.some((c) => c.status === p.status))
      .map((p) => p.id);
    // Toggle: if everything's already picked, clear instead.
    setSelected((prev) => (prev.size >= ids.length && ids.length > 0 ? new Set() : new Set(ids)));
  }

  /** Move a single project (from its per-card menu). No-op if already there. */
  const moveOne = useCallback((id: string, status: Status) => {
    const project = projects.find((p) => p.id === id);
    if (project && project.status !== status) updateProject(id, { status });
  }, [projects, updateProject]);

  function bulkMove(status: Status) {
    const ids = [...selected];
    let moved = 0;
    ids.forEach((id) => {
      const p = projects.find((pp) => pp.id === id);
      if (p && p.status !== status) { updateProject(id, { status }); moved += 1; }
    });
    const label = COLUMNS.find((c) => c.status === status)?.label ?? status;
    toast({
      title: moved === 0 ? "Déjà à jour" : `${moved} projet${plural(moved)} → ${label}`,
      description: moved === 0 ? "Les projets choisis sont déjà dans cette colonne." : undefined,
    });
    exitSelect();
  }

  function bulkDelete() {
    const items = projects.filter((p) => selected.has(p.id));
    if (items.length === 0) { exitSelect(); return; }
    items.forEach((p) => deleteProject(p.id));
    let undone = false;
    sonnerToast(`${items.length} projet${plural(items.length)} supprimé${plural(items.length)}`, {
      duration: 6000,
      action: {
        label: "Annuler",
        onClick: () => {
          if (undone) return;
          undone = true;
          items.forEach((p) => restoreProject(p));
        },
      },
    });
    exitSelect();
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleCreate() {
    openQuickCreate("project");
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
      toast({ title: "Lien client copié", description: url });
    });
  }

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;
  const allVisibleSelected = useMemo(() => {
    const ids = filteredProjects.filter((p) => visibleColumns.some((c) => c.status === p.status));
    return ids.length > 0 && ids.every((p) => selected.has(p.id));
  }, [filteredProjects, visibleColumns, selected]);

  return (
    <div className="space-y-6">
      {/* À facturer banner */}
      {toInvoice.length > 0 && (
        <section className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-card/40 to-card/30 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft size={14} className="text-accent" />
            <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
              À facturer
            </span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
              · {toInvoice.length} devis validé{toInvoice.length > 1 ? "s" : ""}
            </span>
            <span className="ml-auto text-xs font-body font-semibold text-foreground/80 tabular-nums">
              {toInvoiceTotal.toLocaleString("fr-CH", { minimumFractionDigits: 0 })} CHF
            </span>
          </div>
          <ul className="space-y-1">
            {toInvoice.slice(0, 3).map((q) => {
              const ageDays = Math.max(0, Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 86400000));
              const target = q.projectId ? `/project/${q.projectId}/documents` : `/quotes/${q.id}`;
              return (
                <li key={q.id}>
                  <button
                    onClick={() => navigate(target)}
                    className="w-full text-left rounded-xl border border-transparent hover:border-border/40 hover:bg-card/60 transition-all flex items-center gap-2 px-3 py-2 group"
                  >
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-primary/40 text-primary shrink-0">DEV</span>
                    <span className="text-xs font-mono text-muted-foreground/60 shrink-0">{q.quoteNumber || "—"}</span>
                    <span className="text-sm font-body text-foreground truncate flex-1 min-w-0">
                      {q.clientName || q.projectTitle || "Sans client"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums shrink-0 hidden sm:inline">{ageDays}j</span>
                    <span className="text-xs font-body font-semibold text-foreground/80 tabular-nums shrink-0">
                      {totalQuote(q).toLocaleString("fr-CH", { minimumFractionDigits: 0 })} CHF
                    </span>
                    <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-accent transition-colors shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
          {toInvoice.length > 3 && (
            <div className="mt-2 pt-2 border-t border-border/40 text-[11px] font-body text-muted-foreground">
              + {toInvoice.length - 3} autre{toInvoice.length - 3 > 1 ? "s" : ""}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <LayoutList size={28} className="text-primary" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Aucun projet</h2>
          <p className="font-body text-sm text-muted-foreground mb-6 max-w-sm">
            Créez votre premier projet pour commencer à planifier et partager avec vos clients.
          </p>
          <Button onClick={handleCreate} className="gap-2">
            <Plus size={16} />
            Créer un projet
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un projet..."
                type="search"
                inputMode="search"
                enterKeyHint="search"
                className="pl-9 font-body text-sm"
              />
            </div>
            <div className="inline-flex rounded-md border border-border bg-background p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setKindFilterPersist("all")}
                className={`px-3 py-1.5 text-xs font-body font-medium rounded transition-colors ${kindFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              >
                Tous
              </button>
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindFilterPersist(k)}
                  className={`px-3 py-1.5 text-xs font-body font-medium rounded transition-colors ${kindFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {selectMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={selectAllVisible} className="gap-1.5 font-body text-xs">
                    <CheckCheck size={13} />
                    {allVisibleSelected ? "Aucun" : "Tout"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exitSelect} className="gap-1.5 font-body text-xs">
                    <X size={13} />
                    Terminer
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setSelectMode(true)} className="gap-1.5 font-body text-xs" aria-pressed={false}>
                    <CheckSquare size={13} />
                    Sélectionner
                  </Button>
                  <Button variant="outline" size="sm" onClick={toggleShowCompleted} className="gap-1.5 font-body text-xs">
                    {showCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showCompleted ? "Masquer terminés" : "Terminés"}
                  </Button>
                  <Button onClick={handleCreate} size="sm" className="gap-1.5 font-body text-xs">
                    <Plus size={14} />
                    Nouveau projet
                  </Button>
                </>
              )}
            </div>
          </div>

          {selectMode && (
            <p className="text-xs font-body text-muted-foreground -mt-2">
              Touche les cartes à sélectionner, puis choisis une action en bas.
            </p>
          )}

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
                    <DroppableColumn key={col.status} col={col} items={items} activeId={activeId} selectMode={selectMode}>
                      {items.map((project) => (
                        <DraggableCard
                          key={project.id}
                          project={project}
                          clientDisplayName={clientName(project)}
                          onClick={() => navigate(`/project/${project.id}/brief`)}
                          onDelete={() => deleteProjectWithUndo(project)}
                          onCopyLink={() => handleCopyLink(project)}
                          onMove={(status) => moveOne(project.id, status)}
                          isDragging={activeId === project.id}
                          selectMode={selectMode}
                          selected={selected.has(project.id)}
                          onToggleSelect={() => toggleSelect(project.id)}
                          onLongPressSelect={() => enterSelectWith(project.id)}
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
                    clientDisplayName={clientName(activeProject)}
                    isOverlay
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {/* Sticky bulk-action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 z-40 flex items-center gap-1.5 rounded-2xl border border-border bg-card/95 backdrop-blur px-2.5 py-2 shadow-xl max-w-[calc(100vw-1.5rem)]">
          <span className="text-xs font-body font-semibold px-1.5 tabular-nums whitespace-nowrap">
            {selected.size} sélectionné{plural(selected.size)}
          </span>
          {confirmBulkDelete ? (
            <>
              <span className="text-xs font-body text-muted-foreground whitespace-nowrap">Supprimer ?</span>
              <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={bulkDelete}>Confirmer</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirmBulkDelete(false)}>Non</Button>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 gap-1.5 text-xs">
                    <ArrowRightLeft size={13} /> Déplacer vers
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top">
                  <DropdownMenuLabel>Déplacer vers</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMNS.map((c) => (
                    <DropdownMenuItem key={c.status} onClick={() => bulkMove(c.status)}>
                      {c.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmBulkDelete(true)}
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Supprimer</span>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DroppableColumn({
  col, items, activeId, selectMode, children,
}: {
  col: typeof COLUMNS[number];
  items: StoredProject[];
  activeId: string | null;
  selectMode: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status, disabled: selectMode });

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
        className={`flex flex-col gap-3 min-h-[120px] rounded-xl p-2 transition-colors ${isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-transparent"}`}
      >
        {items.length === 0 && !activeId && (
          <div className={`border-2 border-dashed ${col.emptyColor} rounded-lg h-[80px] flex items-center justify-center`}>
            <p className="text-xs font-body text-muted-foreground/50">{selectMode ? "Vide" : "Déposer ici"}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function DraggableCard({
  project, clientDisplayName, onClick, onDelete, onCopyLink, onMove, isDragging,
  selectMode, selected, onToggleSelect, onLongPressSelect,
}: {
  project: StoredProject;
  clientDisplayName: string | null;
  onClick: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onMove: (status: Status) => void;
  isDragging: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onLongPressSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: project.id, disabled: selectMode });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <ProjectCard
        project={project}
        clientDisplayName={clientDisplayName}
        onClick={onClick}
        onDelete={onDelete}
        onCopyLink={onCopyLink}
        onMove={onMove}
        dragHandleProps={{ ...attributes, ...listeners }}
        selectMode={selectMode}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onLongPressSelect={onLongPressSelect}
      />
    </div>
  );
}

interface ProjectCardProps {
  project: StoredProject;
  clientDisplayName?: string | null;
  onClick?: () => void;
  onDelete?: () => void;
  onCopyLink?: () => void;
  onMove?: (status: Status) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isOverlay?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onLongPressSelect?: () => void;
}

const ProjectCard = memo(function ProjectCard({
  project, clientDisplayName, onClick, onDelete, onCopyLink, onMove, dragHandleProps, isOverlay,
  selectMode = false, selected = false, onToggleSelect, onLongPressSelect,
}: ProjectCardProps) {
  const pendingResponses = (project.tasks || [])
    .flatMap((t) => t.feedbackRequests || [])
    .filter((r) => r.resolved && r.response).length;

  // Long-press a card (where it isn't a button) to enter selection mode.
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);
  const lpStart = useRef<{ x: number; y: number } | null>(null);

  const clearLp = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
    lpStart.current = null;
  };

  function onPointerDown(e: React.PointerEvent) {
    if (selectMode || isOverlay) return;
    // Ignore presses that land on the grip / action buttons.
    if ((e.target as HTMLElement).closest("[data-no-longpress]")) return;
    lpFired.current = false;
    lpStart.current = { x: e.clientX, y: e.clientY };
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      try { navigator.vibrate?.(15); } catch { /* not supported */ }
      onLongPressSelect?.();
    }, 450);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!lpStart.current) return;
    if (Math.abs(e.clientX - lpStart.current.x) > 10 || Math.abs(e.clientY - lpStart.current.y) > 10) clearLp();
  }

  function handleClick() {
    // Swallow the click that follows a long-press so it doesn't also navigate.
    if (lpFired.current) { lpFired.current = false; return; }
    if (selectMode) onToggleSelect?.();
    else onClick?.();
  }

  const otherColumns = COLUMNS.filter((c) => c.status !== project.status);

  return (
    <div
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearLp}
      onPointerLeave={clearLp}
      className={`bg-card rounded-xl border p-4 shadow-card transition-all duration-200 cursor-pointer group relative ${
        selected ? "border-primary ring-2 ring-primary/60" : "border-border"
      } ${
        selectMode ? "" : "hover:shadow-card-hover hover:scale-[1.01] hover:-translate-y-0.5"
      } ${isOverlay ? "rotate-1 shadow-xl scale-105 opacity-95" : ""}`}
    >
      {/* Selection checkbox (replaces the drag grip while selecting) */}
      {selectMode ? (
        <div
          className={`absolute top-3 left-3 z-10 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            selected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-border"
          }`}
          aria-hidden
        >
          {selected && <Check size={13} />}
        </div>
      ) : !isOverlay && (
        <button
          {...dragHandleProps}
          data-no-longpress
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 left-3 p-1 rounded text-muted-foreground/30 md:opacity-0 md:group-hover:opacity-100 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-all"
          title="Glisser pour déplacer"
          aria-label="Glisser pour déplacer le projet"
        >
          <GripVertical size={13} />
        </button>
      )}

      {/* One overflow menu per card — move / copy / delete. A single subtle
          dot button keeps cards clean on every breakpoint and gives mobile a
          non-drag path to change status (no hover gate). */}
      {!selectMode && !isOverlay && (
        <div className="absolute top-2.5 right-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-no-longpress
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
                title="Actions"
                aria-label={`Actions pour ${project.title || "le projet"}`}
              >
                <MoreVertical size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Déplacer vers</DropdownMenuLabel>
              {otherColumns.map((c) => (
                <DropdownMenuItem key={c.status} onClick={(e) => { e.stopPropagation(); onMove?.(c.status); }}>
                  <ArrowRightLeft size={13} className="mr-2 text-muted-foreground" />
                  {c.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopyLink?.(); }}>
                <Link2 size={13} className="mr-2 text-muted-foreground" />
                Copier le lien client
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={13} className="mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <h3 className="font-display text-sm font-semibold text-foreground mb-1 px-5 line-clamp-2">{project.title}</h3>

      {clientDisplayName && (
        <div className="flex items-center gap-1.5 text-muted-foreground font-body text-xs mb-2 px-5">
          <User size={11} />
          <span>{clientDisplayName}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {(project.tasks || []).length > 0 && (
            <span className="text-xs font-body text-muted-foreground">
              {(project.tasks || []).length} tâche{(project.tasks || []).length > 1 ? "s" : ""}
            </span>
          )}
          {pendingResponses > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-body font-semibold bg-palette-amber/15 text-palette-amber border border-palette-amber/30 rounded-full px-2 py-0.5">
              <MessageSquare size={9} />
              {pendingResponses} réponse{pendingResponses > 1 ? "s" : ""}
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
});
