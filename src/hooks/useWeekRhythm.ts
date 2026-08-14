import { useMemo } from "react";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useProjects } from "@/contexts/ProjectsContext";
import { getWeekStart, getWeekDays, toISODate, isToday } from "@/lib/weekDates";

export interface RhythmDay {
  iso: string;
  /** Une seule lettre : L M M J V S D. */
  letter: string;
  /** Tâches réellement terminées ce jour-là. */
  count: number;
  isToday: boolean;
  isFuture: boolean;
  isWeekend: boolean;
}

export interface WeekRhythm {
  days: RhythmDay[];
  /** Meilleur jour de la semaine — sert d'échelle aux barres. */
  best: number;
  /** Total terminé depuis lundi. */
  total: number;
}

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Le rythme de la semaine : ce qui a été terminé chaque jour depuis lundi.
 *
 * C'est une **histoire, pas une série**. Un jour creux est un fait, pas un
 * échec : rien ne se « casse », rien ne repart à zéro, et les week-ends sont
 * marqués à part pour qu'un samedi vide ne ressemble pas à un manquement.
 * On ne compte que des complétions horodatées — jamais du temps passé, dont
 * les mesures ne sont pas fiables ici.
 */
export function useWeekRhythm(): WeekRhythm {
  const { data: allSubtasks = [] } = useAllSubtasks();
  const { projects } = useProjects();

  return useMemo(() => {
    const today = new Date();
    const todayISO = toISODate(today);
    const week = getWeekDays(getWeekStart(today));

    const perDay = new Map<string, number>();
    const bump = (stamp?: string | null) => {
      if (!stamp) return;
      const iso = stamp.slice(0, 10);
      perDay.set(iso, (perDay.get(iso) ?? 0) + 1);
    };

    for (const s of allSubtasks) if (s.completed) bump(s.completedAt);
    for (const p of projects) {
      for (const t of p.tasks ?? []) {
        if (t.status === "completed" || t.completed) bump(t.completedAt);
      }
    }

    const days: RhythmDay[] = week.map((d, i) => {
      const iso = toISODate(d);
      return {
        iso,
        letter: LETTERS[i],
        count: perDay.get(iso) ?? 0,
        isToday: isToday(d),
        isFuture: iso > todayISO,
        isWeekend: i >= 5,
      };
    });

    return {
      days,
      best: Math.max(1, ...days.map((d) => d.count)),
      total: days.reduce((sum, d) => sum + d.count, 0),
    };
  }, [allSubtasks, projects]);
}
