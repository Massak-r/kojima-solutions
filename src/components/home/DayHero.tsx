import { useEffect, useMemo, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateWithWeekday } from "@/lib/dateFormat";
import { useTodaysSprint } from "@/hooks/useTodaysSprint";
import { useWeekRhythm } from "@/hooks/useWeekRhythm";

/**
 * The opening of the day, on the mobile landing screen.
 *
 * It replaced a bare date heading. A page that starts with a plain string and
 * then stacks four identically-weighted cards has no focal point, so the eye
 * finds nothing and the app reads as a document. This is the one loud element
 * on /jour; everything below it stays quiet on purpose.
 *
 * The ring is the day's own finish line, in the same language as the month
 * strip further down — two scales of the same idea. It only ever shows real
 * completions, and an empty day gets an invitation rather than a zero, because
 * "0 %" first thing in the morning is a scolding, not information.
 */

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function greeting(hour: number): string {
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function DayHero() {
  const { counts, loading } = useTodaysSprint();
  const rhythm = useWeekRhythm();
  const now = useMemo(() => new Date(), []);
  const reduceMotion = useReducedMotion();

  // Terminer une tâche doit se voir, pas seulement se sentir : l'anneau
  // tressaille au moment où le compteur bouge. C'est le battement du jeu,
  // et il ne se déclenche que sur une complétion réelle.
  const ringControls = useAnimationControls();
  const prevDone = useRef<number | null>(null);
  useEffect(() => {
    if (prevDone.current !== null && counts.done > prevDone.current && !reduceMotion) {
      void ringControls.start({
        scale: [1, 1.14, 1],
        transition: { duration: 0.45, ease: "easeOut" },
      });
    }
    prevDone.current = counts.done;
  }, [counts.done, ringControls, reduceMotion]);

  const total = counts.pending + counts.done;
  const cleared = total > 0 && counts.pending === 0;
  const ratio = total === 0 ? 0 : counts.done / total;

  const state =
    total === 0
      // Pas « rien d'engagé » : la carte du plan le dit déjà deux cartes plus
      // bas, et une invitation vaut mieux qu'un constat de vide.
      ? "Ta journée est encore libre."
      : cleared
        ? `Journée bouclée. ${counts.done} tâche${counts.done > 1 ? "s" : ""} derrière toi.`
        : `${counts.pending} à faire${counts.done > 0 ? ` · ${counts.done} déjà fait${counts.done > 1 ? "es" : "e"}` : ""}.`;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl px-5 py-5 sm:px-6 sm:py-6 mb-5",
        "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
        "border border-primary/15",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
            {greeting(now.getHours())}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 first-letter:uppercase">
            {formatDateWithWeekday(now)}
          </p>
          {/* Tant qu'on ne sait pas, on ne prétend rien : annoncer « journée
              libre » puis se dédire une demi-seconde plus tard est le pire
              accueil du matin. */}
          {loading ? (
            <span className="mt-3 block h-4 w-44 max-w-full rounded bg-foreground/10 animate-pulse" />
          ) : (
            <p className={cn(
              "text-sm mt-2.5 font-medium",
              cleared ? "text-emerald-700 dark:text-emerald-300" : "text-foreground/80",
            )}>
              {state}
            </p>
          )}
        </div>

        {/* Aucun bouton ici : la carte du plan, juste dessous, porte déjà deux
            fois « Planifier ». Le héros informe, elle agit. */}
        {loading && (
          <div className="h-[68px] w-[68px] shrink-0 rounded-full bg-foreground/10 animate-pulse" aria-hidden="true" />
        )}

        {!loading && total > 0 && (
          <motion.div animate={ringControls} className="relative shrink-0" aria-hidden="true">
            <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
              <circle
                cx="34" cy="34" r={RADIUS}
                fill="none" strokeWidth="5"
                className="stroke-border"
              />
              {/* L'anneau se dessine à l'ouverture : c'est le petit moment qui
                  fait qu'on lit une app et non une page. Respecte le réglage
                  système « animations réduites ». */}
              <motion.circle
                cx="34" cy="34" r={RADIUS}
                fill="none" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: reduceMotion ? CIRCUMFERENCE * (1 - ratio) : CIRCUMFERENCE }}
                animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - ratio) }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                className={cleared ? "stroke-emerald-500" : "stroke-primary"}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center">
              {cleared ? (
                <Check size={24} className="text-emerald-600 dark:text-emerald-400" strokeWidth={2.6} />
              ) : (
                <span className="font-display text-xl font-bold tabular-nums leading-none">
                  {counts.pending}
                </span>
              )}
            </span>
          </motion.div>
        )}
      </div>

      {/* Le rythme de la semaine — une histoire, pas une série. Un jour creux
          est un fait, rien ne se casse et rien ne repart à zéro. Masqué tant
          que la semaine n'a rien produit, pour ne pas ouvrir sur sept vides. */}
      {!loading && rhythm.total > 0 && (
        <div className="mt-4 pt-3 border-t border-primary/10">
          <div className="flex items-end gap-1">
            {rhythm.days.map((d, i) => {
              // Barre étroite dans un rail de hauteur fixe : c'est ce qui rend
              // l'écart entre les jours lisible. En pleine largeur, les barres
              // se lisaient comme des pastilles toutes semblables.
              const h = d.count === 0 ? 3 : 4 + Math.round((d.count / rhythm.best) * 20);
              return (
                <div key={d.iso} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="flex h-6 w-full items-end justify-center">
                    <motion.span
                      initial={reduceMotion ? false : { height: 3 }}
                      animate={{ height: h }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        "w-[6px] rounded-full",
                        d.isFuture ? "bg-border/40"
                          : d.isToday ? "bg-primary"
                          : d.count === 0 ? "bg-border"
                          : "bg-primary/40",
                      )}
                    />
                  </span>
                  <span className={cn(
                    "text-[10px] leading-none",
                    d.isToday ? "font-bold text-primary"
                      : d.isWeekend ? "text-muted-foreground/40"
                      : "text-muted-foreground/70",
                  )}>
                    {d.letter}
                  </span>
                </div>
              );
            })}
            <span className="ml-2 shrink-0 pb-4 text-[11px] text-muted-foreground tabular-nums">
              {rhythm.total} cette semaine
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
