import { useDroppable } from "@dnd-kit/core";
import { Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { WeekPlannerCard, objectiveColor } from "./WeekPlannerCard";
import type { SubtaskItem } from "@/api/todoSubtasks";

export const POOL_DROP_ID = "pool";

interface WeekPlannerPoolProps {
  items: SubtaskItem[];
  objectiveTextById: Record<string, string>;
  objectiveOrder: string[];
  mobileMode?: boolean;
  onOpen: (sub: SubtaskItem) => void;
}

export function WeekPlannerPool({
  items, objectiveTextById, objectiveOrder, mobileMode, onOpen,
}: WeekPlannerPoolProps) {
  const droppable = useDroppable({ id: POOL_DROP_ID });
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(s =>
      s.text.toLowerCase().includes(q) ||
      (objectiveTextById[s.parentId] ?? "").toLowerCase().includes(q),
    );
  }, [items, query, objectiveTextById]);

  /** Flatten into [{objectiveHeader}, ...items, {objectiveHeader}, ...] */
  const rendered = useMemo(() => {
    const grouped = new Map<string, SubtaskItem[]>();
    for (const sub of filtered) {
      const arr = grouped.get(sub.parentId) ?? [];
      arr.push(sub);
      grouped.set(sub.parentId, arr);
    }
    const parents = objectiveOrder.filter(id => grouped.has(id));
    return parents.map(pid => ({
      parentId: pid,
      text: objectiveTextById[pid] ?? "(objectif)",
      subs: grouped.get(pid) ?? [],
    }));
  }, [filtered, objectiveOrder, objectiveTextById]);

  const inner = (
    <>
      <div className="relative px-1 mb-2">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filtrer…"
          className="w-full h-7 text-[12px] font-body bg-muted/30 border border-border/30 rounded-md pl-7 pr-2 focus:outline-none focus:border-primary/40 focus:bg-background"
        />
      </div>

      <div
        ref={droppable.setNodeRef}
        className={cn(
          "flex-1 rounded-lg p-1.5 space-y-2 overflow-y-auto transition-colors",
          droppable.isOver && "bg-primary/10 ring-2 ring-primary/40",
          mobileMode ? "max-h-[55vh]" : "max-h-[calc(100vh-220px)]",
        )}
      >
        {items.length === 0 ? (
          <div className="text-center text-[11px] font-body text-muted-foreground/40 italic py-8">
            Tout est planifié ✓
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-[11px] font-body text-muted-foreground/40 italic py-6">
            Aucun résultat.
          </div>
        ) : (
          rendered.map(group => (
            <div key={group.parentId} className="space-y-1">
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", objectiveColor(group.parentId))} />
                <span className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider truncate flex-1">
                  {group.text}
                </span>
                <span className="text-[9px] font-mono tabular-nums text-muted-foreground/50 shrink-0">
                  {group.subs.length}
                </span>
              </div>
              <div className="space-y-1">
                {group.subs.map(sub => (
                  <WeekPlannerCard
                    key={sub.id}
                    sub={sub}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (mobileMode) {
    return (
      <details className="group rounded-xl border border-border/40 bg-card/30 overflow-hidden">
        <summary className="cursor-pointer list-none select-none px-3 py-2.5 flex items-center gap-2 hover:bg-muted/20">
          <Inbox size={13} className="text-muted-foreground/60" />
          <span className="text-[12px] font-display font-semibold text-foreground/80 flex-1">
            Pool — non planifié
          </span>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
            {items.length}
          </span>
        </summary>
        <div className="p-2 flex flex-col">{inner}</div>
      </details>
    );
  }

  return (
    <aside className="rounded-xl border border-border/40 bg-card/30 p-2 flex flex-col lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-center gap-2 px-1 py-1 mb-1">
        <Inbox size={13} className="text-muted-foreground/70" />
        <span className="text-[11px] font-display font-bold text-foreground/80 uppercase tracking-wider flex-1">
          Pool
        </span>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60">
          {items.length}
        </span>
      </div>
      {inner}
    </aside>
  );
}
