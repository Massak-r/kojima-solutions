# Session 2026-05-02 — Refonte TDAH : Sprint cap, SubtaskCard, Fusion Objectifs/Sprint/Projets

## Contexte

Session longue de refonte UX axée TDAH. Point de départ : le user signale qu'il flagge trop d'items au quotidien par peur d'oublier, et que l'app a 5 surfaces fragmentées pour gérer le travail (KojimaSpace, ObjectiveWorkspace, Sprint, Dashboard projets, ProjectSteps). Objectif : unifier sans perdre de fonctionnalité métier (notamment billing / suivi client côté projets).

---

## Ce qui a été shippé (par ordre chronologique)

### 1. Sprint cap (5 items) + vue "À ne pas oublier" — `0094ea2`
- Constante `DAILY_SPRINT_CAP = 5` dans `src/lib/sprintLimits.ts`
- Hook centralisé `useFlagSubtask()` qui check le cap avant de flagger
- `SprintCapProvider` (React Context) + `SprintCapOverloadDialog` : quand on essaie un 6e flag, dialog "lequel tu retires ?" avec options Remplacer / Annuler / Garder les 6
- Migration des 3 call sites de flag : SubtaskCard (étoile), WeekPlanner (drag-to-today), ObjectiveWorkspace (`onSetFocus`)
- Nouveau composant `UrgentBacklog` en haut de SprintPage : surface les subtasks urgentes non-flaggées (priority=high, en retard, due ≤ 3j, ou récurrentes)
- Compteur sprint en rouge avec ⚠ quand au-dessus du cap

### 2. Récurrents dans "À ne pas oublier" — `d1401a4`
- `urgentSubtaskFilter` étendu : `s.recurrence` rend toujours urgent
- Badge bleu sky avec icône Repeat : QUOTIDIEN / LUN-VEN / HEBDO / MENSUEL

### 3. SubtaskCard TDAH — progressive disclosure radicale — `2edfdf7`
**Niveau 0 (carte fermée)** : badges statut / estimation supprimés (sauf Bloqué)
**Niveau 1 (carte ouverte)** : 10 boutons (4 statuts + 3 priorités + 3 efforts) → 2 toggles binaires (Urgent / Bloqué) + effort inchangé
**Niveau 2 (Avancé ▸)** : statut précis, priorité précise, estimation, récurrence, SMART — collapsé par défaut

### 4. Phase 1 — Sprint unifié (objectifs + projets) — `7bc83f4`
**Backend**
- `ALTER TABLE tasks ADD flagged_today + sprint_tier` (idempotent)
- `ALTER TABLE todo_subtasks ADD sprint_tier`
- `mapTask()` expose ; `syncTasks()` persiste ; workflow respecté (seules tâches `status='open'` flaggables)

**Frontend**
- `SprintCapProvider` devient polymorphe via `SprintItem` discriminé : `{ kind: 'subtask' } | { kind: 'task' }`
- `SprintCapOverloadDialog` gère les deux types dans le swap
- Nouveau `useFlagProjectTask` parallèle de `useFlagSubtask`, partage le même cap
- `UnifiedStepCard` : étoile sur tâches `status='open'`
- `ProjectsContext.updateProjectTask` : mutation optimiste avec rollback
- SprintPage agrège les deux sources, badges contextuels
- UrgentBacklog inclut tâches projet `status='open'` deadline ≤ 3j

### 5. Phase 2 — Must / Nice — `43d379d`
- 2 zones distinctes dans SprintBacklog : Must-have (🔥 rouge) / Nice-to-have (✨ bleu)
- Default à création = `nice` (DB DEFAULT + reset explicite à chaque (ré)flag)
- Toggle 🔥/✨ sur chaque card pour basculer
- Cap reste 5 total, pas de quota séparé
- Header : `X must · Y nice · Z done`
- Message subtil "Pas de must-have aujourd'hui — jour léger ?" quand 0 must

### 6. Phase 3 — Home unifié — `7f7ba77`
- Nouvelle page `/home` avec 2 onglets initialement (Streams / Statut projets)
- BottomNav : 6 → 5 entrées (Home / Sprint / Finance / Trésorerie / Documents)
- Redirects : `/space` → `/home`, `/projects` → `/home?tab=kanban`
- KojimaSpace conservé à `/space-full` ; Dashboard à `/projects-board`
- Composants nouveaux : `AlertsZone`, `PendingFeedback`, `SprintSummary`, `StreamsList`, `ProjectStatusKanban`

### 7. Fix : réintroduire calendrier en onglet "Aperçu" — `ff1c1b1`
- Le user signale qu'il a "perdu le calendrier etc"
- 3e onglet `Aperçu` ajouté avec : StatsBar, ObjectiveHealthCard, CalendarWidget, IntakeManager, AnalyticsWidget, EmailQueue, CostsDueSoon, RecentActivity
- Layout 3/5 + 2/5 (repris de KojimaSpace)

---

## Modèle mental établi (pour les futures sessions)

**3 concepts, frontières claires :**
- **Stream** (durable) = projet *ou* objectif. Conceptuellement le même, séparé en DB pour préserver les features projet (phases, feedback client, billing).
- **Tâche / Étape** (atomique) = unité d'action. `tasks` (TimelineTask) côté projet, `todo_subtasks` côté objectif. Mêmes au niveau métier.
- **Sprint** (transient) = aujourd'hui. Cross-streams. Cap 5 total. Zones Must / Nice.

**Aucune fusion DB** — toute la fusion vit au niveau UI.

---

## Décisions design TDAH validées avec le user

- **Cap soft 5** sur le sprint, dialog "lequel tu retires ?" plutôt que blocage dur
- **Default Nice → toggle Must** (pas l'inverse) — friction minimale, signal clair
- **Workflow projet respecté** : seules tâches `open` sont flaggables ; les `locked` n'ont pas d'étoile
- **Kanban statut** = sous-onglet de Home, pas page séparée
- **Garder les projets intacts** : aucune fusion DB, aucune feature business perdue

---

## Pain points UX restants à traiter (non shippés)

User a évoqué que la section Streams peut être améliorée. Mon top combo proposé :
- **A** Grouper par état d'urgence (`🔥 Urgent` / `🎯 En cours` / `💤 Au repos`)
- **C** Top 3 actions en haut de Streams (cross-streams)
- **D** Bordure colorée selon urgence

Autres idées proposées mais non validées :
- B : Next action visible sur chaque stream (texte de la prochaine tâche)
- E : Expand inline au click au lieu de navigation forcée
- F : Filtres simplifiés `[Urgents] [Actifs] [Tous]`

---

## Idée évoquée mais non planifiée

- **Suivi historique des récurrentes** : tracker quand une récurrente a été faite ou sautée (nouvelle table `subtask_completion_log`). Reporté.

---

## Fichiers critiques touchés

- `public/api/projects.php` — migration tasks + mapTask + syncTasks
- `public/api/todo_subtasks.php` — migration sprint_tier + PATCH whitelist
- `src/types/timeline.ts` — `flaggedToday` + `sprintTier` sur TimelineTask
- `src/api/todoSubtasks.ts` — `sprintTier` sur SubtaskItem
- `src/components/sprint/SprintCapProvider.tsx` — `SprintItem` polymorphe
- `src/components/sprint/SprintCapOverloadDialog.tsx` — gère 2 types
- `src/components/sprintPage/SprintBacklog.tsx` — zones Must/Nice + types polymorphes
- `src/components/sprintPage/UrgentBacklog.tsx` — récurrents + tâches projet
- `src/components/steps/UnifiedStepCard.tsx` — étoile sur tâches open
- `src/components/todos/SubtaskCard.tsx` — progressive disclosure 3 niveaux
- `src/contexts/ProjectsContext.tsx` — `updateProjectTask`
- `src/hooks/useFlagSubtask.tsx` — central avec cap check
- `src/hooks/useFlagProjectTask.tsx` — nouveau, parallèle
- `src/lib/sprintLimits.ts` — `DAILY_SPRINT_CAP = 5` + filtres urgence
- `src/pages/Home.tsx` — 3 onglets
- `src/components/home/*` — 7 nouveaux composants
- `src/components/BottomNav.tsx` — 5 entrées
- `src/App.tsx` — route /home + redirects

---

## Commits dans l'ordre

1. `0094ea2` — feat: sprint cap (5 items) + vue "À ne pas oublier"
2. `d1401a4` — feat: récurrents dans "À ne pas oublier" + badge RÉCURRENT
3. `2edfdf7` — refactor(ux): SubtaskCard TDAH — progressive disclosure radicale
4. `7bc83f4` — feat: Phase 1 — Sprint unifié (objectifs + projets)
5. `43d379d` — feat: Phase 2 — Sprint Must / Nice
6. `7f7ba77` — feat: Phase 3 — Home unifié
7. `ff1c1b1` — fix: Home — réintroduire calendrier + widgets KojimaSpace en 3e onglet "Aperçu"
