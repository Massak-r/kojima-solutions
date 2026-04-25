import { useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, FileCheck2, X, Variable } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  listTemplates, getTemplate, deleteTemplate,
  type ObjectiveTemplate, type ObjectiveTemplateItem,
} from "@/api/objectiveTemplates";
import { useCreateSubtask } from "@/hooks/useSubtasks";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ObjectiveSource;
  objectiveId: string;
  /** called after successful apply so the page can reload subtasks */
  onApplied?: () => void;
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

function extractVariables(items: ObjectiveTemplateItem[]): string[] {
  const set = new Set<string>();
  for (const i of items) {
    let m: RegExpExecArray | null;
    VAR_RE.lastIndex = 0;
    while ((m = VAR_RE.exec(i.text)) !== null) set.add(m[1]);
    if (i.description) {
      VAR_RE.lastIndex = 0;
      while ((m = VAR_RE.exec(i.description)) !== null) set.add(m[1]);
    }
  }
  return [...set];
}

function substitute(text: string, values: Record<string, string>): string {
  return text.replace(VAR_RE, (_full, name) => {
    const v = values[name];
    return v && v.trim() ? v : `{{${name}}}`;
  });
}

export function TemplatePicker({ open, onOpenChange, source, objectiveId, onApplied }: TemplatePickerProps) {
  const { toast } = useToast();
  const createSubtaskMut = useCreateSubtask();
  const [templates, setTemplates] = useState<ObjectiveTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<string | null>(null);
  const [preview,   setPreview]   = useState<ObjectiveTemplateItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying,  setApplying]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // User-supplied variable values + per-item include flags
  const [vars,    setVars]    = useState<Record<string, string>>({});
  const [include, setInclude] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listTemplates()
      .then(t => {
        setTemplates(t);
        if (t.length > 0) setSelected(t[0].id);
      })
      .catch(() => toast({ title: "Impossible de charger les modèles", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!selected || !open) { setPreview([]); setVars({}); setInclude({}); return; }
    setPreviewLoading(true);
    getTemplate(selected)
      .then(t => {
        const items = t.items ?? [];
        setPreview(items);
        // Reset variables + default everything to included
        const detected = extractVariables(items);
        const nextVars: Record<string, string> = {};
        for (const v of detected) nextVars[v] = "";
        setVars(nextVars);
        const nextInclude: Record<string, boolean> = {};
        for (const i of items) nextInclude[i.id] = true;
        setInclude(nextInclude);
      })
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
  }, [selected, open]);

  const variables = useMemo(() => extractVariables(preview), [preview]);

  // Build parent→children map
  const topItems    = useMemo(() => preview.filter(i => !i.parentItemId).sort((a, b) => a.order - b.order), [preview]);
  const childrenMap = useMemo(() => {
    const m: Record<string, ObjectiveTemplateItem[]> = {};
    for (const i of preview) {
      if (i.parentItemId) (m[i.parentItemId] ??= []).push(i);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.order - b.order);
    return m;
  }, [preview]);

  // Item is effectively included iff itself + all ancestors are included
  function effectivelyIncluded(itemId: string): boolean {
    let curr: ObjectiveTemplateItem | undefined = preview.find(i => i.id === itemId);
    while (curr) {
      if (!include[curr.id]) return false;
      if (!curr.parentItemId) return true;
      curr = preview.find(i => i.id === curr!.parentItemId);
    }
    return true;
  }

  const includedCount = useMemo(
    () => preview.filter(i => effectivelyIncluded(i.id)).length,
    [preview, include],
  );

  const missingVars = variables.filter(v => !vars[v]?.trim());

  function toggleItem(id: string) {
    setInclude(prev => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleApply() {
    if (!selected || preview.length === 0) return;
    setApplying(true);
    try {
      // Sort: top-level first (creation order matters for parent_subtask_id mapping)
      const toCreate = preview
        .filter(i => effectivelyIncluded(i.id))
        .sort((a, b) => {
          const aTop = a.parentItemId ? 1 : 0;
          const bTop = b.parentItemId ? 1 : 0;
          if (aTop !== bTop) return aTop - bTop;
          return a.order - b.order;
        });

      // Map template_item_id → newly-created subtask id
      const idMap: Record<string, string> = {};
      let created = 0;

      for (const it of toCreate) {
        const text = substitute(it.text, vars);
        const desc = it.description ? substitute(it.description, vars) : undefined;
        const parentSubtaskId = it.parentItemId ? idMap[it.parentItemId] : undefined;
        // If parent was excluded (no idMap entry), skip the child too
        if (it.parentItemId && !parentSubtaskId) continue;
        try {
          const real = await createSubtaskMut.mutateAsync({
            parentId: objectiveId,
            parentSubtaskId,
            text,
            description: desc,
            priority: it.priority,
            effortSize: it.effortSize ?? undefined,
            source,
          });
          idMap[it.id] = real.id;
          created++;
        } catch {}
      }

      toast({ title: `Modèle appliqué · ${created} étape${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}` });
      onApplied?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Échec de l'application", description: e?.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selected === id) {
        setSelected(null);
        setPreview([]);
      }
      setConfirmDelete(null);
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Appliquer un modèle</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-sm font-body text-muted-foreground">Aucun modèle enregistré pour l'instant.</div>
            <div className="text-xs font-body text-muted-foreground/60 mt-1">
              Créez un modèle à partir d'un objectif existant via "Enregistrer comme modèle".
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 overflow-hidden min-h-0 flex-1">
            {/* Left: template list */}
            <div className="sm:col-span-2 overflow-y-auto space-y-1.5 pr-1">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(t.id)}
                    className={cn(
                      "flex-1 text-left p-3 rounded-xl border transition-all",
                      selected === t.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/40 bg-card/30 hover:border-border/70 hover:bg-card/60",
                    )}
                  >
                    <div className="text-sm font-display font-semibold text-foreground truncate">{t.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground tabular-nums mt-0.5">
                      {t.itemCount ?? 0} étape{(t.itemCount ?? 0) > 1 ? "s" : ""}
                    </div>
                    {t.description && (
                      <div className="text-[11px] font-body text-muted-foreground/80 mt-1 line-clamp-2">{t.description}</div>
                    )}
                  </button>
                  {confirmDelete === t.id ? (
                    <div className="flex flex-col gap-0.5">
                      <Button size="sm" variant="destructive" className="h-6 px-1.5 text-[10px] rounded-md" onClick={() => handleDelete(t.id)}>Oui</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] rounded-md" onClick={() => setConfirmDelete(null)}>Non</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(t.id)}
                      className="text-muted-foreground/40 hover:text-destructive p-1 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Right: preview + variables */}
            <div className="sm:col-span-3 overflow-y-auto pl-0 sm:pl-2 border-t sm:border-t-0 sm:border-l border-border/30 pt-3 sm:pt-0 space-y-3">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : preview.length === 0 ? (
                <div className="text-xs font-body text-muted-foreground/60 italic p-3">Modèle vide.</div>
              ) : (
                <>
                  {/* Variables */}
                  {variables.length > 0 && (
                    <div className="sm:ml-2">
                      <div className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Variable size={12} />
                        Variables · {variables.length}
                      </div>
                      <div className="space-y-1.5">
                        {variables.map(v => (
                          <div key={v} className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0 min-w-[100px]">
                              {`{{${v}}}`}
                            </span>
                            <Input
                              value={vars[v] ?? ""}
                              onChange={e => setVars(prev => ({ ...prev, [v]: e.target.value }))}
                              placeholder={`Valeur pour ${v}…`}
                              className="h-7 text-xs font-body"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tree with checkboxes */}
                  <div className="sm:ml-2">
                    <div className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider mb-2">
                      Étapes · {includedCount}/{preview.length}
                    </div>
                    <div className="space-y-0.5">
                      {topItems.map(top => {
                        const topIncluded = include[top.id];
                        return (
                          <div key={top.id}>
                            <button
                              type="button"
                              onClick={() => toggleItem(top.id)}
                              className={cn(
                                "w-full text-left flex items-start gap-2 py-1 px-1.5 rounded-md hover:bg-muted/40 transition-colors",
                                !topIncluded && "opacity-50",
                              )}
                            >
                              <Checkbox checked={topIncluded} />
                              <span className="text-sm font-body font-medium text-foreground flex-1 break-words">
                                {substitute(top.text, vars)}
                              </span>
                            </button>
                            {(childrenMap[top.id] || []).map(child => {
                              const childIncluded = topIncluded && include[child.id];
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => toggleItem(child.id)}
                                  disabled={!topIncluded}
                                  className={cn(
                                    "w-full text-left flex items-start gap-2 py-0.5 px-1.5 ml-5 rounded-md hover:bg-muted/40 transition-colors",
                                    (!childIncluded || !topIncluded) && "opacity-50",
                                    !topIncluded && "cursor-not-allowed hover:bg-transparent",
                                  )}
                                >
                                  <Checkbox checked={childIncluded} />
                                  <span className="text-xs font-body text-muted-foreground flex-1 break-words">
                                    ↳ {substitute(child.text, vars)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/30 mt-1">
          {missingVars.length > 0 ? (
            <span className="text-[11px] font-body text-amber-600 dark:text-amber-400">
              {missingVars.length} variable{missingVars.length > 1 ? "s" : ""} non remplie{missingVars.length > 1 ? "s" : ""} (sera{missingVars.length > 1 ? "ont" : ""} laissée{missingVars.length > 1 ? "s" : ""} entre {`{{...}}`})
            </span>
          ) : <span />}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X size={14} className="mr-1" /> Annuler
            </Button>
            <Button onClick={handleApply} disabled={!selected || applying || includedCount === 0}>
              {applying ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileCheck2 size={14} className="mr-1" />}
              Appliquer {includedCount > 0 ? `${includedCount} étape${includedCount > 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors",
        checked ? "bg-primary border-primary" : "border-muted-foreground/40 bg-transparent",
      )}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
