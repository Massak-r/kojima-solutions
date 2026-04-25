import { useEffect, useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, CalendarDays, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getWeekStart, getWeekDays, toISODate, formatWeekRange, isPastDay, isToday,
  recurrenceMatchesDate,
} from "@/lib/weekDates";

const SHOW_WEEKEND_KEY = "sprint-show-weekend";
import { WeekPlannerColumn } from "./WeekPlannerColumn";
import { WeekPlannerPool, POOL_DROP_ID } from "./WeekPlannerPool";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource, UnifiedObjective } from "@/api/objectiveSource";

interface WeekPlannerProps {
  objectives: UnifiedObjective[];
  allSubtasks: SubtaskItem[];
  objectivesById: Record<string, UnifiedObjective>;
  onUpdateSubtask: (id: string, patch: Partial<SubtaskItem>) => void;
  onJump: (source: ObjectiveSource, objectiveId: string) => void;
}

export function WeekPlanner({
  objectives, allSubtasks, objectivesById, onUpdateSubtask, onJump,
}: WeekPlannerProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [showWeekend, setShowWeekend] = useState<boolean>(() => {
    try { return localStorage.getItem(SHOW_WEEKEND_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(SHOW_WEEKEND_KEY, showWeekend ? "1" : "0"); } catch { /* ignore */ }
  }, [showWeekend]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const allWeekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekDays = useMemo(
    () => showWeekend ? allWeekDays : allWeekDays.slice(0, 5),
    [allWeekDays, showWeekend],
  );
  const weekDates = useMemo(() => weekDays.map(toISODate), [weekDays]);
  const allWeekDates = useMemo(() => allWeekDays.map(toISODate), [allWeekDays]);
  const todayISO = toISODate(new Date());
  const isCurrentWeek = allWeekDates.includes(todayISO);

  const objectiveTextById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of objectives) m[o.id] = o.text;
    return m;
  }, [objectives]);

  const objectiveOrder = useMemo(
    () => [...objectives].sort((a, b) => a.order - b.order).map(o => o.id),
    [objectives],
  );

  const { byDay, recurringByDay, pool } = useMemo(() => {
    const days: Record<string, SubtaskItem[]> = {};
    const recDays: Record<string, SubtaskItem[]> = {};
    const poolArr: SubtaskItem[] = [];
    for (const d of allWeekDates) { days[d] = []; recDays[d] = []; }

    for (const sub of allSubtasks) {
      if (!objectivesById[sub.parentId]) continue;
      if (sub.completed) continue;

      if (sub.recurrence) {
        let matched = false;
        for (let i = 0; i < allWeekDays.length; i++) {
          if (recurrenceMatchesDate(sub.recurrence, sub.recurrenceDay, allWeekDays[i])) {
            recDays[allWeekDates[i]].push(sub);
            matched = true;
          }
        }
        if (matched) continue;
      }

      if (sub.flaggedToday) {
        if (allWeekDates.includes(todayISO)) days[todayISO].push(sub);
        else poolArr.push(sub);
        continue;
      }

      if (sub.scheduledFor && allWeekDates.includes(sub.scheduledFor)) {
        days[sub.scheduledFor].push(sub);
        continue;
      }

      if (!sub.scheduledFor) {
        poolArr.push(sub);
      }
    }

    const sortFn = (a: SubtaskItem, b: SubtaskItem) => {
      if (a.flaggedToday !== b.flaggedToday) return a.flaggedToday ? -1 : 1;
      return a.order - b.order;
    };
    for (const d of allWeekDates) { days[d].sort(sortFn); recDays[d].sort(sortFn); }
    poolArr.sort(sortFn);

    return { byDay: days, recurringByDay: recDays, pool: poolArr };
  }, [allSubtasks, objectivesById, allWeekDates, allWeekDays, todayISO]);

  const hiddenWeekendCount = useMemo(() => {
    if (showWeekend) return 0;
    const sat = allWeekDates[5];
    const sun = allWeekDates[6];
    return (byDay[sat]?.length ?? 0) + (byDay[sun]?.length ?? 0)
      + (recurringByDay[sat]?.length ?? 0) + (recurringByDay[sun]?.length ?? 0);
  }, [showWeekend, allWeekDates, byDay, recurringByDay]);

  function handleDragEnd(event: DragEndEvent) {
    const subId = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    if (!overId) return;

    const sub = allSubtasks.find(s => s.id === subId);
    if (!sub) return;

    if (overId === POOL_DROP_ID) {
      if (!sub.flaggedToday && !sub.scheduledFor) return;
      void onUpdateSubtask(subId, { flaggedToday: false, scheduledFor: null });
      return;
    }

    if (overId.startsWith("day:")) {
      const targetDate = overId.slice(4);
      const targetDateObj = new Date(targetDate + "T00:00:00");
      if (isPastDay(targetDateObj)) return;

      if (isToday(targetDateObj)) {
        if (sub.flaggedToday) return;
        void onUpdateSubtask(subId, { flaggedToday: true, scheduledFor: null });
      } else {
        if (sub.scheduledFor === targetDate && !sub.flaggedToday) return;
        void onUpdateSubtask(subId, { flaggedToday: false, scheduledFor: targetDate });
      }
    }
  }

  function handleOpen(sub: SubtaskItem) {
    const source: ObjectiveSource = sub.source === "personal" ? "personal" : "admin";
    onJump(source, sub.parentId);
  }

  return (
    <div className="space-y-3">
      {/* Week nav */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-display font-semibold text-foreground">
            Sem. du {formatWeekRange(weekStart)}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 rounded-full text-[11px] gap-1.5"
            onClick={() => setShowWeekend(v => !v)}
            title={showWeekend ? "Masquer le week-end" : "Afficher le week-end"}
          >
            {showWeekend ? <EyeOff size={13} /> : <Eye size={13} />}
            <span className="hidden sm:inline">
              {showWeekend ? "Week-end" : `W-E${hiddenWeekendCount > 0 ? ` · ${hiddenWeekendCount}` : ""}`}
            </span>
          </Button>
          <div className="w-px h-5 bg-border/40 mx-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 rounded-full"
            onClick={() => setWeekStart(getWeekStart(new Date(weekStart.getTime() - 7 * 86400000)))}
            title="Semaine précédente"
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            size="sm"
            variant={isCurrentWeek ? "ghost" : "outline"}
            className="h-7 px-3 rounded-full text-[11px]"
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            disabled={isCurrentWeek}
          >
            Cette semaine
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 rounded-full"
            onClick={() => setWeekStart(getWeekStart(new Date(weekStart.getTime() + 7 * 86400000)))}
            title="Semaine suivante"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        {/* Mobile: pool as a drawer at top, then vertical column stack */}
        <div className="lg:hidden space-y-2">
          <WeekPlannerPool
            items={pool}
            objectiveTextById={objectiveTextById}
            objectiveOrder={objectiveOrder}
            mobileMode
            onOpen={handleOpen}
          />
          <div className="space-y-2">
            {weekDays.map(d => (
              <WeekPlannerColumn
                key={toISODate(d)}
                date={d}
                items={byDay[toISODate(d)] ?? []}
                recurringItems={recurringByDay[toISODate(d)] ?? []}
                objectiveTextById={objectiveTextById}
                mobileMode
                defaultExpanded={isToday(d)}
                onOpen={handleOpen}
              />
            ))}
          </div>
        </div>

        {/* Desktop (≥lg): pool sidebar + dynamic-col grid (5 or 7) */}
        <div className="hidden lg:grid lg:grid-cols-[220px_1fr] gap-3">
          <WeekPlannerPool
            items={pool}
            objectiveTextById={objectiveTextById}
            objectiveOrder={objectiveOrder}
            onOpen={handleOpen}
          />
          <div
            className="grid gap-2 min-w-0"
            style={{ gridTemplateColumns: `repeat(${weekDays.length}, minmax(0, 1fr))` }}
          >
            {weekDays.map(d => (
              <WeekPlannerColumn
                key={toISODate(d)}
                date={d}
                items={byDay[toISODate(d)] ?? []}
                recurringItems={recurringByDay[toISODate(d)] ?? []}
                objectiveTextById={objectiveTextById}
                onOpen={handleOpen}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
