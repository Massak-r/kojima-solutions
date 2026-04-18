import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Loader2, AlertCircle, StickyNote, Paperclip, Link as LinkIcon, GitBranch, Activity,
  Sparkles, BookmarkPlus, Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getObjective, updateObjectiveBySource, type ObjectiveSource, type UnifiedObjective } from "@/api/objectiveSource";
import { listSubtasks, createSubtask, updateSubtask, deleteSubtask } from "@/api/todoSubtasks";
import { listSessions, type ObjectiveSession } from "@/api/objectiveSessions";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { ObjectiveHeader } from "@/components/objective/ObjectiveHeader";
import { ObjectiveSmartPanel } from "@/components/objective/ObjectiveSmartPanel";
import { LinkedItemsPanel } from "@/components/objective/LinkedItemsPanel";
import { NextUpQueue } from "@/components/objective/NextUpQueue";
import { FocusStrip } from "@/components/objective/FocusStrip";
import { NotesPanel } from "@/components/objective/NotesPanel";
import { FilesPanel } from "@/components/objective/FilesPanel";
import { LinksPanel } from "@/components/objective/LinksPanel";
import { DecisionsPanel } from "@/components/objective/DecisionsPanel";
import { ActivityTimeline } from "@/components/objective/ActivityTimeline";
import { WeekFocusSummary } from "@/components/objective/WeekFocusSummary";
import { TemplatePicker } from "@/components/objective/TemplatePicker";
import { SaveAsTemplateDialog } from "@/components/objective/SaveAsTemplateDialog";
import { AIBreakdownDialog, type ParsedSubtask } from "@/components/objective/AIBreakdownDialog";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import type { TodoPriority, TodoStatus } from "@/api/objectives";

export default function ObjectiveWorkspace() {
  const { source, id } = useParams<{ source: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromRoute = (location.state as { from?: string } | null)?.from;

  const [objective, setObjective] = useState<UnifiedObjective | null>(null);
  const [subtasks,  setSubtasks]  = useState<SubtaskItem[]>([]);
  const [sessions,  setSessions]  = useState<ObjectiveSession[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [showSave,   setShowSave]   = useState(false);
  const [showAI,     setShowAI]     = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const { projects } = useProjects();
  const { clients }  = useClients();

  const validSource = source === "personal" || source === "admin";
  const src = source as ObjectiveSource;

  const reloadSubtasks = useCallback(async () => {
    if (!id) return;
    try { setSubtasks(await listSubtasks(id, src)); } catch {}
  }, [id, src]);

  // Compute actuals per subtask from sessions
  const actualsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      if (!s.subtaskId || !s.durationSec) continue;
      map[s.subtaskId] = (map[s.subtaskId] ?? 0) + Math.round(s.durationSec / 60);
    }
    return map;
  }, [sessions]);

  // Load objective + subtasks + sessions in parallel
  useEffect(() => {
    if (!validSource || !id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getObjective(src, id),
      listSubtasks(id, src),
      listSessions(src, id).catch(() => [] as ObjectiveSession[]),
    ])
      .then(([o, subs, sess]) => {
        if (!o) { setError("Objectif introuvable"); return; }
        setObjective(o);
        setSubtasks(subs);
        setSessions(sess);
      })
      .catch(e => setError(e?.message ?? "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [src, id, validSource]);

  // Refetch sessions when a focus session ends in the background (cross-tab or this tab)
  useEffect(() => {
    function refreshSessions() {
      if (!id) return;
      listSessions(src, id).then(setSessions).catch(() => {});
    }
    window.addEventListener("focus-session-change", refreshSessions);
    return () => window.removeEventListener("focus-session-change", refreshSessions);
  }, [src, id]);

  // Keyboard shortcuts: F (toggle focus), N (new subtask input), ? (help), Esc (close)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const isInput = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape") {
        setShowShortcuts(false);
        return;
      }
      if (isInput) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-next-up-input]");
        input?.focus();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-focus"));
      } else if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(v => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const goBack = useCallback(() => {
    if (fromRoute) navigate(fromRoute);
    else navigate(source === "personal" ? "/personal" : "/space");
  }, [fromRoute, navigate, source]);

  const applyObjectiveUpdate = useCallback(
    (patch: Partial<UnifiedObjective>) => {
      if (!objective) return;
      const next = { ...objective, ...patch };
      setObjective(next);
      updateObjectiveBySource(src, objective.id, patch).catch(() => {});
    },
    [objective, src],
  );

  // Add subtask (top-level if parentSubtaskId is null, sub-subtask otherwise)
  const handleSubtaskAdd = useCallback((text: string, dueDate: string | undefined, parentSubtaskId: string | null) => {
    if (!objective) return;
    // Compute order scoped to siblings at the same level
    const siblings = subtasks.filter(s => (s.parentSubtaskId ?? null) === parentSubtaskId);
    const nextOrder = siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.order)) + 1;

    const temp: SubtaskItem = {
      id: crypto.randomUUID(),
      source: src,
      parentId: objective.id,
      parentSubtaskId,
      text,
      completed: false,
      dueDate,
      order: nextOrder,
      priority: "medium",
      status: "not_started",
      flaggedToday: false,
      createdAt: new Date().toISOString(),
    };
    setSubtasks(prev => [...prev, temp]);
    createSubtask({
      parentId: objective.id,
      parentSubtaskId: parentSubtaskId ?? undefined,
      text,
      dueDate,
      source: src,
    })
      .then(real => setSubtasks(prev => prev.map(s => s.id === temp.id ? real : s)))
      .catch(() => {});
  }, [objective, src, subtasks]);

  const handleSubtaskToggle = useCallback((id: string) => {
    const target = subtasks.find(s => s.id === id);
    if (!target) return;
    const nextCompleted = !target.completed;
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed: nextCompleted } : s));
    updateSubtask(id, { completed: nextCompleted }).catch(() => {});
  }, [subtasks]);

  const handleSubtaskDelete = useCallback((id: string) => {
    // Cascade locally: also drop any children
    setSubtasks(prev => prev.filter(s => s.id !== id && s.parentSubtaskId !== id));
    deleteSubtask(id).catch(() => {});
  }, []);

  const handleSubtaskUpdate = useCallback((id: string, data: Partial<SubtaskItem>) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    updateSubtask(id, data as any).catch(() => {});
  }, []);

  const handleAIImport = useCallback(async (items: ParsedSubtask[]) => {
    if (!objective || items.length === 0) return;
    const topLevel = subtasks.filter(s => (s.parentSubtaskId ?? null) === null);
    const baseOrder = topLevel.length === 0 ? 0 : Math.max(...topLevel.map(s => s.order)) + 1;

    const temps: SubtaskItem[] = items.map((it, i) => ({
      id: crypto.randomUUID(),
      source: src,
      parentId: objective.id,
      parentSubtaskId: null,
      text: it.text,
      completed: false,
      order: baseOrder + i,
      priority: "medium",
      status: "not_started",
      flaggedToday: false,
      effortSize: it.effortSize ?? null,
      estimatedMinutes: it.estimatedMinutes ?? null,
      createdAt: new Date().toISOString(),
    }));
    setSubtasks(prev => [...prev, ...temps]);

    await Promise.all(temps.map((t, i) => {
      const it = items[i];
      return createSubtask({
        parentId: objective.id,
        text: t.text,
        source: src,
        effortSize: it.effortSize,
        estimatedMinutes: it.estimatedMinutes,
      })
        .then(real => setSubtasks(prev => prev.map(s => s.id === t.id ? real : s)))
        .catch(() => {});
    }));
  }, [objective, src, subtasks]);

  const completedSubs = subtasks.filter(s => s.completed).length;

  if (!validSource || !id) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-semibold">URL invalide</h2>
            <p className="text-sm text-muted-foreground mt-1">Format attendu : /objective/&lt;personal|admin&gt;/&lt;id&gt;</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/space")}>Retour</Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }

  if (error || !objective) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-display font-semibold">Objectif introuvable</h2>
            <p className="text-sm text-muted-foreground mt-1">{error ?? "Erreur inconnue"}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={goBack}>Retour</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <ObjectiveHeader
        objective={objective}
        completedSubtasks={completedSubs}
        totalSubtasks={subtasks.length}
        onBack={goBack}
        onTitleSave={next => next && next !== objective.text && applyObjectiveUpdate({ text: next })}
        onStatusChange={(s: TodoStatus) => applyObjectiveUpdate({ status: s })}
        onPriorityChange={(p: TodoPriority) => applyObjectiveUpdate({ priority: p })}
        onDueDateChange={d => applyObjectiveUpdate({ dueDate: d || null })}
      />

      <FocusStrip
        source={src}
        objectiveId={objective.id}
        objectiveTitle={objective.text}
        subtasks={subtasks}
        onSetFocus={id => handleSubtaskUpdate(id, { flaggedToday: true })}
        onClearFocus={id => handleSubtaskUpdate(id, { flaggedToday: false })}
        onComplete={id => handleSubtaskUpdate(id, { completed: true })}
      />

      <NextUpQueue
        subtasks={subtasks}
        onToggle={handleSubtaskToggle}
        onAdd={handleSubtaskAdd}
        onDelete={handleSubtaskDelete}
        onUpdate={handleSubtaskUpdate}
        actualsMap={actualsMap}
      />

      {/* Template + shortcut toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAI(true)}
          className="h-8 rounded-full border-primary/40 text-primary hover:bg-primary/5"
        >
          <Sparkles size={13} className="mr-1.5" />
          Décomposer avec l'IA
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowPicker(true)}
          className="h-8 rounded-full"
        >
          <Sparkles size={13} className="mr-1.5" />
          Appliquer un modèle
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowSave(true)}
          disabled={subtasks.length === 0}
          className="h-8 rounded-full"
          title={subtasks.length === 0 ? "Ajoutez au moins une étape pour créer un modèle" : undefined}
        >
          <BookmarkPlus size={13} className="mr-1.5" />
          Enregistrer comme modèle
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowShortcuts(v => !v)}
          className="h-8 rounded-full text-muted-foreground ml-auto hidden sm:inline-flex"
          title="Raccourcis clavier (?)"
        >
          <Keyboard size={13} className="mr-1.5" /> Raccourcis
        </Button>
      </div>

      {showShortcuts && (
        <div className="rounded-2xl border border-border/40 bg-card/60 p-4 text-sm font-body">
          <div className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider mb-2">Raccourcis</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-6 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border/40">F</kbd> Démarrer / arrêter le focus</li>
            <li className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border/40">N</kbd> Nouvelle étape</li>
            <li className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border/40">Enter</kbd> Ajouter + focus</li>
            <li className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border/40">?</kbd> Afficher / masquer</li>
            <li className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] border border-border/40">Esc</kbd> Fermer</li>
          </ul>
        </div>
      )}

      <ObjectiveSmartPanel
        objective={objective}
        onSmartSave={(field, value) => applyObjectiveUpdate({ [field]: value || null } as Partial<UnifiedObjective>)}
        onDefinitionOfDoneSave={v => applyObjectiveUpdate({ definitionOfDone: v || null })}
      />

      <LinkedItemsPanel
        objective={objective}
        onLinkedProjectChange={id => applyObjectiveUpdate({ linkedProjectId: id })}
        onLinkedClientChange={id => applyObjectiveUpdate({ linkedClientId: id })}
      />

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto bg-card/40 border border-border/40 rounded-xl p-1">
          <TabsTrigger value="notes" className="gap-1.5"><StickyNote size={13} /> Notes</TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5"><Paperclip size={13} /> Fichiers</TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5"><LinkIcon size={13} /> Liens</TabsTrigger>
          <TabsTrigger value="decisions" className="gap-1.5"><GitBranch size={13} /> Décisions</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity size={13} /> Activité</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4">
          <NotesPanel source={src} objectiveId={objective.id} />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <FilesPanel source={src} objectiveId={objective.id} />
        </TabsContent>
        <TabsContent value="links" className="mt-4">
          <LinksPanel source={src} objectiveId={objective.id} />
        </TabsContent>
        <TabsContent value="decisions" className="mt-4">
          <DecisionsPanel source={src} objectiveId={objective.id} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4 space-y-4">
          <WeekFocusSummary source={src} objectiveId={objective.id} />
          <ActivityTimeline source={src} objectiveId={objective.id} />
        </TabsContent>
      </Tabs>

      <TemplatePicker
        open={showPicker}
        onOpenChange={setShowPicker}
        source={src}
        objectiveId={objective.id}
        onApplied={reloadSubtasks}
      />
      <SaveAsTemplateDialog
        open={showSave}
        onOpenChange={setShowSave}
        source={src}
        objectiveId={objective.id}
        defaultName={objective.text}
      />
      <AIBreakdownDialog
        open={showAI}
        onOpenChange={setShowAI}
        objective={objective}
        subtasks={subtasks}
        linkedProjectName={objective.linkedProjectId ? projects.find(p => p.id === objective.linkedProjectId)?.title ?? null : null}
        linkedClientName={objective.linkedClientId ? clients.find(c => c.id === objective.linkedClientId)?.name ?? null : null}
        onImport={handleAIImport}
      />
    </div>
  );
}
