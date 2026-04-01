import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, X, ArrowUp, ArrowDown, Zap, Pencil, Plus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { upsertProgress, deleteProgressByMove } from "@/api/classProgress";
import type { ClassProgressItem } from "@/api/classProgress";
import type { SalsaMoveItem } from "@/api/salsaMoves";

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export interface ClassColumnProps {
  classKey:         string;
  className:        string;
  coursMoves:       SalsaMoveItem[];
  progress:         ClassProgressItem[];
  onProgressChange: (items: ClassProgressItem[]) => void;
  onRename:         (name: string) => void;
  readOnly?:        boolean;
}

export function ClassColumn({
  classKey, className, coursMoves, progress, onProgressChange, onRename, readOnly = false,
}: ClassColumnProps) {
  const { toast } = useToast();
  const [editingName,    setEditingName]    = useState(false);
  const [nameInput,      setNameInput]      = useState(className);
  const [addingMove,     setAddingMove]     = useState(false);
  const [selectedMoveId, setSelectedMoveId] = useState("");
  const [viewMove,       setViewMove]       = useState<SalsaMoveItem | null>(null);

  const done    = [...progress.filter(p => p.status === "done")].sort((a, b) => (a.doneOrder ?? 999) - (b.doneOrder ?? 999));
  const next    = [...progress.filter(p => p.status === "next")].sort((a, b) => (a.doneOrder ?? 999) - (b.doneOrder ?? 999));
  const planned = [...progress.filter(p => p.status === "planned")].sort((a, b) => (a.doneOrder ?? 999) - (b.doneOrder ?? 999));
  const assignedIds = new Set(progress.map(p => p.moveId));
  const unassigned  = coursMoves.filter(m => !assignedIds.has(m.id));

  function getMove(moveId: string) { return coursMoves.find(m => m.id === moveId); }
  function getMoveTitle(moveId: string) { return getMove(moveId)?.title ?? moveId; }

  function nextDoneOrder() {
    return done.length > 0 ? Math.max(...done.map(d => d.doneOrder ?? 0)) + 1 : 1;
  }
  function nextOrderFor(status: "done" | "next" | "planned"): number {
    const items = progress.filter(p => p.status === status);
    if (items.length === 0) return 1;
    const orders = items.map(p => p.doneOrder ?? 0).filter(n => n > 0);
    return orders.length > 0 ? Math.max(...orders) + 1 : items.length + 1;
  }

  async function doUpsert(moveId: string, data: Omit<ClassProgressItem, "id" | "createdAt">) {
    const existing = progress.find(p => p.moveId === moveId);
    const optimistic: ClassProgressItem = {
      id: existing?.id ?? `temp-${moveId}`,
      classKey, moveId, ...data,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const updated = existing
      ? progress.map(p => p.moveId === moveId ? optimistic : p)
      : [...progress, optimistic];
    onProgressChange(updated);
    try {
      const result = await upsertProgress(data);
      onProgressChange(updated.map(p => p.moveId === moveId ? result : p));
    } catch {
      onProgressChange(progress);
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function doDelete(moveId: string) {
    onProgressChange(progress.filter(p => p.moveId !== moveId));
    try { await deleteProgressByMove(classKey, moveId); } catch {}
  }

  async function reorder(moveId: string, dir: "up" | "down", items: ClassProgressItem[]) {
    const idx     = items.findIndex(p => p.moveId === moveId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const curr = items[idx], swap = items[swapIdx];
    const currOrder = curr.doneOrder ?? idx + 1;
    const swapOrder = swap.doneOrder ?? swapIdx + 1;
    const updated = progress.map(p =>
      p.moveId === curr.moveId ? { ...p, doneOrder: swapOrder } :
      p.moveId === swap.moveId ? { ...p, doneOrder: currOrder } : p
    );
    onProgressChange(updated);
    try {
      await Promise.all([
        upsertProgress({ classKey, moveId: curr.moveId, status: curr.status, doneOrder: swapOrder, doneAt: curr.doneAt }),
        upsertProgress({ classKey, moveId: swap.moveId, status: swap.status, doneOrder: currOrder, doneAt: swap.doneAt }),
      ]);
    } catch {
      onProgressChange(progress);
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  function MoveLabel({ moveId, items, className: cls }: { moveId: string; items: ClassProgressItem[]; className?: string }) {
    const m = getMove(moveId);
    return (
      <button
        onClick={() => m && setViewMove(m)}
        className={cn("text-sm font-body flex-1 min-w-0 text-left truncate hover:underline cursor-pointer", cls)}
      >
        {getMoveTitle(moveId)}
      </button>
    );
  }

  function ReorderBtns({ moveId, items }: { moveId: string; items: ClassProgressItem[] }) {
    if (readOnly || items.length <= 1) return null;
    const idx = items.findIndex(p => p.moveId === moveId);
    return (
      <div className="flex flex-col gap-px shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => reorder(moveId, "up", items)} disabled={idx === 0}
          className={cn("p-0.5 text-muted-foreground hover:text-foreground transition-colors", idx === 0 && "opacity-20 cursor-default")}>
          <ArrowUp size={10} />
        </button>
        <button onClick={() => reorder(moveId, "down", items)} disabled={idx === items.length - 1}
          className={cn("p-0.5 text-muted-foreground hover:text-foreground transition-colors", idx === items.length - 1 && "opacity-20 cursor-default")}>
          <ArrowDown size={10} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Class name */}
      <div className="flex items-center gap-2">
        {!readOnly && editingName ? (
          <>
            <Input value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { onRename(nameInput); setEditingName(false); }
                if (e.key === "Escape") setEditingName(false);
              }}
              className="h-8 text-sm font-semibold" autoFocus />
            <Button size="sm" className="h-8 text-xs px-2"
              onClick={() => { onRename(nameInput); setEditingName(false); }}>OK</Button>
          </>
        ) : (
          <>
            <h3 className="font-body font-semibold text-base">{className}</h3>
            {!readOnly && (
              <button onClick={() => { setNameInput(className); setEditingName(true); }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <Pencil size={12} />
              </button>
            )}
          </>
        )}
      </div>

      {/* FAIT */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-100 dark:border-green-900">
          <CheckCircle2 size={13} className="text-green-600" />
          <span className="text-xs font-body font-semibold text-green-700 dark:text-green-400">Fait</span>
          <span className="ml-auto text-xs text-green-500/60">{done.length}</span>
        </div>
        {done.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-2.5 italic">Aucun mouvement encore.</p>
        ) : (
          <ol className="divide-y divide-border">
            {done.map((p, idx) => (
              <li key={p.moveId} className="flex items-center gap-2 px-3 py-2 group hover:bg-secondary/30 transition-colors">
                <span className="text-xs font-mono text-muted-foreground/50 w-5 shrink-0 text-right">{idx + 1}.</span>
                <MoveLabel moveId={p.moveId} items={done} />
                <ReorderBtns moveId={p.moveId} items={done} />
                {!readOnly && (
                  <button
                    onClick={() => doUpsert(p.moveId, { classKey, moveId: p.moveId, status: "planned", doneOrder: nextOrderFor("planned"), doneAt: null })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                    title="Retirer de Fait">
                    <X size={12} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* PROCHAIN COURS */}
      <div className="glass-card rounded-xl overflow-hidden ring-1 ring-amber-200 dark:ring-amber-800">
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900">
          <Zap size={13} className="text-amber-600" />
          <span className="text-xs font-body font-semibold text-amber-700 dark:text-amber-400">Prochain cours</span>
          <span className="ml-auto text-xs text-amber-500/60">{next.length}</span>
        </div>
        {next.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-2.5 italic">Rien de planifié.</p>
        ) : (
          <div className="divide-y divide-border">
            {next.map(p => (
              <div key={p.moveId} className="flex items-center gap-2 px-3 py-2.5 group">
                <MoveLabel moveId={p.moveId} items={next} />
                <ReorderBtns moveId={p.moveId} items={next} />
                {!readOnly && (
                  <>
                    <Button size="sm" variant="outline"
                      className="h-6 text-xs px-2 shrink-0 border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => doUpsert(p.moveId, { classKey, moveId: p.moveId, status: "done", doneOrder: nextDoneOrder(), doneAt: todayStr() })}>
                      ✓ Fait
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 shrink-0 text-muted-foreground"
                      onClick={() => doUpsert(p.moveId, { classKey, moveId: p.moveId, status: "planned", doneOrder: nextOrderFor("planned") })}>
                      Retirer
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OPTIONS */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border-b border-border">
          <span className="text-xs font-body font-semibold text-muted-foreground">Options</span>
          <span className="ml-auto text-xs text-muted-foreground/50">{planned.length}</span>
        </div>
        {planned.length === 0 && (readOnly || !addingMove) ? (
          <p className="text-xs text-muted-foreground px-3 py-2.5 italic">Aucune option.</p>
        ) : (
          <div className="divide-y divide-border">
            {planned.map(p => (
              <div key={p.moveId} className="flex items-center gap-2 px-3 py-2 group">
                <MoveLabel moveId={p.moveId} items={planned} />
                <ReorderBtns moveId={p.moveId} items={planned} />
                {!readOnly && (
                  <>
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0"
                      onClick={() => doUpsert(p.moveId, { classKey, moveId: p.moveId, status: "next", doneOrder: nextOrderFor("next") })}>
                      → Prochain
                    </Button>
                    <button onClick={() => doDelete(p.moveId)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                      <X size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="px-3 py-2 border-t border-border">
            {addingMove ? (
              <div className="flex flex-col gap-2">
                <select
                  className="w-full text-xs border border-input rounded-md px-2 py-1.5 bg-background font-body"
                  value={selectedMoveId} onChange={e => setSelectedMoveId(e.target.value)}>
                  <option value="" disabled>Choisir un mouvement…</option>
                  {unassigned.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
                {selectedMoveId && (
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                      onClick={() => {
                        doUpsert(selectedMoveId, { classKey, moveId: selectedMoveId, status: "planned", doneOrder: nextOrderFor("planned") });
                        setAddingMove(false); setSelectedMoveId("");
                      }}>
                      + Options
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => {
                        doUpsert(selectedMoveId, { classKey, moveId: selectedMoveId, status: "next", doneOrder: nextOrderFor("next") });
                        setAddingMove(false); setSelectedMoveId("");
                      }}>
                      ⚡ Prochain cours
                    </Button>
                  </div>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs self-start"
                  onClick={() => { setAddingMove(false); setSelectedMoveId(""); }}>
                  Annuler
                </Button>
              </div>
            ) : unassigned.length > 0 ? (
              <button onClick={() => setAddingMove(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5">
                <Plus size={12} /> Ajouter un mouvement
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Move detail dialog */}
      {viewMove && (
        <Dialog open={!!viewMove} onOpenChange={v => !v && setViewMove(null)}>
          <DialogContent className="max-w-sm font-body">
            <DialogHeader><DialogTitle>{viewMove.title}</DialogTitle></DialogHeader>
            {viewMove.videoUrl && extractYouTubeId(viewMove.videoUrl) && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(viewMove.videoUrl)}?autoplay=1`}
                  className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen
                />
              </div>
            )}
            {viewMove.topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {viewMove.topics.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            )}
            {viewMove.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{viewMove.description}</p>
            )}
            {viewMove.linkUrl && (
              <a href={viewMove.linkUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={11} /> Lien externe
              </a>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
