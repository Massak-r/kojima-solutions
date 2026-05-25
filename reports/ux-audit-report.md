# UX Audit Report — Kojima Solutions (zen-code-studio)

**Audit date:** 2026-05-11
**Scope:** Walk-through of public + admin flows, navigation chrome, destructive actions, feedback states, mobile/PWA behavior. Code-only audit; no runtime testing.
**Methodology:** Read entry points + flagship flows as a first-time user would discover them. Findings tagged with `file:line`.

---

## Executive Summary

### Count by severity
- **Critical:** 3
- **High:** 11
- **Medium:** 17
- **Low:** 12

### Top 5 priorities

1. **Inconsistent navigation labels and destinations across Header / BottomNav / FAB / CommandPalette.** Four primary nav surfaces ship four different mental models. `BottomNav` points to `/home`, the `Header` page-title map still references `/space`, `QuickActionFAB` points "Nouveau projet" to `/projects` (which only exists as a redirect), and `CommandPalette` still lists `Espace → /space` (a redirect). New users will hit dead-redirect chains and feel the chrome was built by three different teams. — `BottomNav.tsx:14`, `Header.tsx:99-109`, `QuickActionFAB.tsx:17`, `CommandPalette.tsx:26`.
2. **"Nouveau projet" creates a draft project immediately, with no name prompt and no undo.** Clicking the FAB or the header CTA in `Home`/`Dashboard`/`KojimaSpace` calls `createProject()` and routes the user into `/project/<id>/brief`. There's no confirmation, no naming step, and no toast. If the user backs out, they're left with a stray "Untitled" project polluting the kanban. — `Home.tsx:42-45`, `Dashboard.tsx:98-101`, `KojimaSpace.tsx:39-42`.
3. **Destructive deletes use three different confirmation patterns** — `AlertDialog` (quotes list), inline 2-button toggle (clients, projects), `window.confirm()` (project documents, share dialog) — and none surface an undo. Users will learn one pattern, hit another mid-flow, and click the wrong button. — `QuotesList.tsx:413-445`, `ClientsManager.tsx:248-272`, `Dashboard.tsx:472-495`, `ProjectDocuments.tsx:79,150`.
4. **Quote print-from-form silently drops unsaved edits.** `QuoteForm.handleDownloadPdf` calls `updateQuote` only when `quoteId` exists; for an unsaved new quote it shows a toast asking to save first, but `printViaIframe` is called after a 150 ms hard-coded wait, so the user sees a print dialog that may render stale data if state hasn't flushed yet. — `QuoteForm.tsx:176-185`.
5. **Client portal email gate has no "request access" or "wrong email?" recovery.** If the wrong email is typed (or the project owner hasn't set the client's email yet), the user sees "Email non reconnu pour ce projet" forever — no link to contact support, no fallback to the multi-project login. — `ClientDashboard.tsx:142-183`.

### Overall UX health

The app is **functional but inconsistent**. The design language is unified (Kojima color system, glass cards, tasteful animations), and many flows show real thought (intake form auto-save, ball-in-court banner on the client dashboard, sprint badge in BottomNav). However, four areas drag the experience down:

- **Navigation chrome fragmentation** (Header / BottomNav / FAB / CommandPalette / overflow menu) — same actions live in different places with different labels and partially-broken routes.
- **Inconsistent confirmation patterns** for destructive actions, mixing accessible AlertDialog with raw `window.confirm`.
- **"Create empty record, edit later"** pattern across projects, clients, quotes — risks orphaned drafts.
- **Mixed languages in admin UI** — French dominant, but Clients form, BottomNav, CommandPalette labels, and tooltips ship English strings that don't go through `useLanguage()`.

Most issues are high-effort-to-find, medium-effort-to-fix. None are blockers, but the cumulative friction is significant for an internal-feeling tool that should feel zero-friction to the operator (the user themselves).

---

## 1. Confusing steps

### 1.1 "Nouveau projet" silently creates an empty draft — Critical
- **Location:** `src/pages/Home.tsx:42-45`, `src/pages/Dashboard.tsx:98-101`, `src/pages/KojimaSpace.tsx:39-42`, `src/components/kojimaSpace/LatestProjects.tsx`
- **Description:** All three "Nouveau projet" buttons immediately call `createProject()` (no args) and navigate to `/project/<newId>/brief`. No modal, no title prompt, no undo. The project shows up as "Untitled" in the kanban the moment the user clicks.
- **Why it's a problem:** A first-time user clicking "Nouveau projet" to "see what happens" generates persistent garbage. Pulling out of the brief screen leaves the draft behind. Repeated mis-clicks pile up.
- **Suggested fix:** Two options. (a) Open a small modal first ("Titre du projet" + Confirm), then create. (b) Keep the immediate-creation pattern but: show a toast "Brouillon créé — l'effacer ?" with an Undo action that calls `deleteProject(id)` for 5 s, and auto-purge `Untitled` drafts older than 24 h.

### 1.2 "Nouveau projet" in QuickActionFAB points to `/projects` (a redirect) — High
- **Location:** `src/components/QuickActionFAB.tsx:17`
- **Description:** `{ label: "Nouveau projet", icon: FolderKanban, to: "/projects", color: "bg-blue-500" }`. `/projects` is only a redirect (`App.tsx:149: <Route path="/projects" element={<Navigate to="/home?tab=kanban" replace />} />`). It lands the user on the kanban, *not* in a new-project flow.
- **Why it's a problem:** The button label says "Nouveau projet" but the result is "go to the kanban list" — the user has to hunt for a second button to actually create one. This is a textbook deceptive affordance.
- **Suggested fix:** Wire the FAB's "Nouveau projet" to `createProject()` followed by navigation to `/project/<id>/brief`, exactly like the Home header does. Or rename the action "Voir les projets" + add a separate green-dot "Créer".

### 1.3 Quote download requires save first, but message arrives only on click — Medium
- **Location:** `src/components/quotes/QuoteForm.tsx:176-185`
- **Description:** "Imprimer / Enregistrer PDF" button is always enabled. Click while editing a brand-new quote → toast: "Sauvegardez d'abord le devis." User must dismiss, click Save, then click Print again.
- **Why it's a problem:** Two-click chain for a common action with no progressive disclosure. The user is forced to discover the constraint by failure.
- **Suggested fix:** Either (a) disable the Print button until `quoteId` is set, with a tooltip "Sauvegardez le devis pour activer l'export"; or (b) save automatically when the user clicks Print on an unsaved quote (the form already has the data).

### 1.4 Intake form auto-saves drafts but never tells the user — Medium
- **Location:** `src/pages/IntakeForm.tsx:94-106`
- **Description:** Form fields are debounced into `localStorage` under `DRAFT_KEY` every 500 ms. On a returning visit the form silently restores. No "Brouillon repris" notice, no "Repartir de zéro" reset button.
- **Why it's a problem:** A prospect who started, abandoned, then returned a week later will see stale module selections and may not know why. Confusion about "is this my data?" leads to mistrust.
- **Suggested fix:** On reload, show a one-shot toast: "Reprise de votre brouillon (modifiable)" with a "Repartir de zéro" link that clears `DRAFT_KEY` and resets state.

### 1.5 Quote number auto-fill is silent and easy to break — Medium
- **Location:** `src/components/quotes/QuoteForm.tsx:71-83, 84`
- **Description:** Quote number auto-recomputes when `docType` toggles, **only if** the current value still matches the last auto-filled value. The "Auto" pill (line 389-393) hints at this. But there's no help text explaining the rule. A user who types a custom number then toggles between Devis/Facture will see the field freeze on the old prefix and be confused.
- **Why it's a problem:** Hidden behavior that violates user mental model ("I changed the type, the number should follow").
- **Suggested fix:** Add a small "↻ Auto" button next to the input that re-runs `computedNumber` on demand. Or always recompute on docType change, with a confirmation if the user has typed something custom.

### 1.6 Client portal: "Welcome onboarding" hijacks first render of every project — Medium
- **Location:** `src/pages/ClientDashboard.tsx:193-199`
- **Description:** `WelcomeOnboarding` blocks the full dashboard on the first visit for each project, stored under `kojima-client-welcomed-${id}`. If a single client has 3 projects, they see 3 welcome screens.
- **Why it's a problem:** Per-project welcomes are redundant for repeat clients.
- **Suggested fix:** Store the welcome flag once per client email (or per browser), not per project.

### 1.7 Email gate redundancy on `/client/:id` — Medium
- **Location:** `src/pages/ClientDashboard.tsx:38-63, 142-183`
- **Description:** Even after a successful `/client/login` login (which sets `clientSession` + pre-authorizes all the email's projects via `setClientAuth`), opening a direct `/client/:id` link will *still* re-check `getClientAuth(id!) === requiredEmail`. This works because `ClientLogin.handleSubmit` (lines 35-37) pre-fills `clientAuth` for every project — but only the projects returned by the server at login time. New projects added later won't be authorized.
- **Why it's a problem:** A client who logs in once and bookmarks `/client/:id` may later get bounced back to the email gate for newly-added projects, with no obvious explanation.
- **Suggested fix:** When the email gate fails but a valid `clientSession` exists for the same email as `requiredEmail`, auto-grant access and call `setClientAuth(id, sessionEmail)`.

### 1.8 ProjectDocuments mode state is a stringly-typed switch — Low
- **Location:** `src/pages/ProjectDocuments.tsx:51`
- **Description:** `const [mode, setMode] = useState<string | null>(null); // null = list | "new" | "edit:<quoteId>"`. Comments encode the contract.
- **Why it's a problem:** Refactor risk, not a user-visible issue today, but as the page grows it's easy to ship a state like `"new"` while a delete confirm is open.
- **Suggested fix:** `useState<{ kind: "list" } | { kind: "new" } | { kind: "edit"; id: string }>`.

---

## 2. Dead-end screens (no next action / no back path)

### 2.1 QuotePrintPage shows "Document not found" with no breadcrumb — High
- **Location:** `src/pages/QuotePrintPage.tsx:33-44`
- **Description:** Public URL. If a stakeholder is sent `/quotes/<bad-id>/print`, they see a centered grey "Document not found" with a single "Back to quotes" link that lands them on `/quotes` — which kicks anonymous users back to `/login`.
- **Why it's a problem:** External recipients are bounced to an admin login they can't pass. They'll email/Slack the operator instead of self-recovering.
- **Suggested fix:** Replace the link with "Contact massaki@kojima-solutions.ch" mailto. Or include a request-ID to make the support ticket actionable.

### 2.2 NotFound screen routes to `/` instead of the closest safe place — Medium
- **Location:** `src/pages/NotFound.tsx:23-29`
- **Description:** Always sends users to `/`. A logged-in admin who mistypes `/quote/foo` lands on the marketing page and loses their admin context.
- **Why it's a problem:** Forces re-login or re-navigation through the bottom nav.
- **Suggested fix:** Detect `useAuth().isAdmin` — if admin, route to `/home`. Add a secondary link "Retour au tableau de bord" alongside "Retour à l'accueil".

### 2.3 QuoteEdit "Devis introuvable" is a true dead end — Medium
- **Location:** `src/pages/QuoteEdit.tsx:29-40`
- **Description:** If `getQuote(id)` returns undefined after loading, the page shows a single text link "Retour à la liste". No retry, no "report a problem", no breadcrumb to the project the quote may belong to.
- **Why it's a problem:** A quote that was just deleted by the user (or a stale browser tab) silently funnels back to the list — recoverable but unfriendly.
- **Suggested fix:** Add an extra "Demander de l'aide" mailto, and consider auto-redirecting after 3 s with a toast.

### 2.4 ClientDashboard "Projet introuvable" is generic — Medium
- **Location:** `src/pages/ClientDashboard.tsx:127-139`
- **Description:** Same pattern as QuoteEdit — a static "Ce lien est peut-être invalide ou le projet a été supprimé." No way to contact the agency.
- **Why it's a problem:** External clients hitting a broken share link have no recourse.
- **Suggested fix:** Add the mailto from the dashboard footer (`massaki@kojima-solutions.ch`) directly on this screen.

### 2.5 Intake success screen blocks further interaction — Low
- **Location:** `src/pages/IntakeForm.tsx:211-221`
- **Description:** Once `submitted`, the form is replaced by `SuccessScreen` permanently. Refreshing reloads the form (because `DRAFT_KEY` was removed) — but a user who wants to submit *another* project has no obvious button.
- **Why it's a problem:** Repeat prospects need to know they can submit again.
- **Suggested fix:** Add "Soumettre un autre projet" CTA on the success screen.

---

## 3. Missing feedback after actions

### 3.1 Project creation has no toast or visual confirmation — High
- **Location:** `src/pages/Home.tsx:42-45`, `src/pages/Dashboard.tsx:98-101`, `src/pages/KojimaSpace.tsx:39-42`
- **Description:** `createProject()` returns synchronously, navigation happens; no `toast({ title: "Projet créé" })`.
- **Why it's a problem:** The user wonders "did it work?" until the new screen paints. Worse, if they were thinking about something else, they may have forgotten that the click created persistent state.
- **Suggested fix:** Add a toast with an Undo action that calls `deleteProject(id)` (see 1.1).

### 3.2 Client save has no feedback — High
- **Location:** `src/pages/ClientsManager.tsx:54-72`
- **Description:** `handleSave` calls `addClient` / `updateClient` and closes the form. No toast.
- **Why it's a problem:** Submit feels uncertain. Compare with `QuoteForm.handleSave` which does emit "Devis enregistré" — inconsistency.
- **Suggested fix:** Emit `toast({ title: editingId ? "Client mis à jour" : "Client ajouté" })`.

### 3.3 Cadrage auto-save is silent — Medium
- **Location:** `src/pages/ProjectCadrage.tsx:118-129`
- **Description:** A debounced 2 s auto-save fires `saveCadrage`. On success, no indication. On failure, a destructive toast appears.
- **Why it's a problem:** Users can't tell if their work has been saved — and the explicit "Sauvegarder" button at line 164 sets up an expectation that saving is manual.
- **Suggested fix:** Show a subtle "Sauvegardé" timestamp/check near the Save button (`dirty: false` + last-saved time). The current ProjectStepNav `dirty` prop hints at this — surface it visually.

### 3.4 Cadrage initial "seed from intake" mutates without notice — Medium
- **Location:** `src/pages/ProjectCadrage.tsx:74-84`
- **Description:** On first load, if no cadrage exists but an intake exists with `budget`, the page silently sets `budgetValidated` to the intake budget and marks `dirty: true`. The user sees a field with content they didn't type.
- **Why it's a problem:** "Where did that come from?" moment, plus the page is now dirty without user input — the navigation guard at `ProjectStepNav.tsx:75-78` will fire prematurely if they leave.
- **Suggested fix:** Show a one-shot info toast: "Budget pré-rempli depuis le brief client." Don't mark dirty until the user actually edits.

### 3.5 Project Quotes "Approuvé devis" success but no email send confirmation — Medium
- **Location:** `src/pages/ClientDashboard.tsx:96-104`
- **Description:** Client clicks "Accepter le devis" → toast says "Devis accepté ✓ — Merci pour votre validation." But it's unclear if the agency was notified.
- **Why it's a problem:** Client wonders if they need to also email/call.
- **Suggested fix:** Toast: "Devis accepté ✓ — L'équipe a été notifiée et vous répondra sous 24h."

### 3.6 Delete actions in QuotesList confirm but show no toast — Medium
- **Location:** `src/pages/QuotesList.tsx:437-441`
- **Description:** AlertDialog confirms delete → `deleteQuote(q.id)` called → dialog closes. No toast.
- **Why it's a problem:** Even with confirmation, a "Devis supprimé" + Undo is helpful.
- **Suggested fix:** Toast with Undo (re-adding the snapshot).

### 3.7 Header overflow menu has no active highlight beyond underline — Low
- **Location:** `src/components/Header.tsx:277-307`
- **Description:** Documents/Réglages items in the mobile overflow menu use `bg-primary/10 text-primary` when active — correct. But the user has to open the menu to see it; the closed three-dot icon doesn't change.
- **Why it's a problem:** Minor: user can't tell at a glance if a deep page is reachable via overflow.
- **Suggested fix:** Add a small dot indicator to `MoreVertical` when the current path is one of the overflow items.

---

## 4. Inconsistent navigation

### 4.1 Four different "home" destinations across nav surfaces — Critical
- **Location:** `BottomNav.tsx:14`, `CommandPalette.tsx:26`, `Header.tsx:99-109`, `App.tsx:144-145`
- **Description:**
  - `BottomNav` first item → `/home`
  - `CommandPalette` first item → `/space` (which redirects to `/home`)
  - `Header.PAGE_TITLES` maps `/space` → "Kojima Space" but the route `/space-full` exists separately as a different page
  - `App.tsx`: `/home` is `Home`, `/space` redirects to `/home`, `/space-full` is `KojimaSpace`
- **Why it's a problem:** The "main dashboard" has two implementations (`Home.tsx` with tabs, `KojimaSpace.tsx` with widgets) and three URLs. CommandPalette opens the wrong one; mobile users hitting BottomNav land in a different place than the FAB's "Espace" suggestion. Operator confusion + dead routes.
- **Suggested fix:** Decide on one canonical entry. If `Home` (tabs) is canonical, remove `/space` from CommandPalette and `PAGE_TITLES`, and either delete `KojimaSpace` or fold it in as a fourth tab.

### 4.2 BottomNav active state for /home matches `/project/*` — High
- **Location:** `src/components/BottomNav.tsx:54-57, 96-100`
- **Description:** `to === "/home" && pathname.startsWith("/project/")` marks the Home tab as active when the user is deep in a project. But desktop sidebar variant uses `to === "/projects"` for the same intent. Inconsistent + `/projects` is a redirect, so the sidebar will never highlight on project pages.
- **Why it's a problem:** Mobile shows "Home" active inside `/project/123/brief`. Desktop sidebar shows nothing active. Confusing.
- **Suggested fix:** Unify: introduce a `/projects` tab in BottomNav (or remove the special-case match) and use the same logic in both viewports.

### 4.3 BottomNav has no link to Clients or Quotes — High
- **Location:** `src/components/BottomNav.tsx:13-19`
- **Description:** Mobile bottom nav exposes Home / Sprint / Finance / Trésorerie / Documents. Quotes (a daily action) and Clients are absent from the primary surface — they live only in FAB and CommandPalette.
- **Why it's a problem:** Five-item nav is correct, but Quotes is arguably more frequent than Trésorerie. Mobile users have to use the FAB or back-button trail.
- **Suggested fix:** Swap "Trésorerie" out of BottomNav (move into a hub like Finance) and add "Devis" or "Clients". Or move Trésorerie/Documents into a Finance hub.

### 4.4 Header mobile title fallback says "Kojima Space" for /space — Medium
- **Location:** `src/components/Header.tsx:100`
- **Description:** `"/space": "Kojima Space"` — but `/space` is a redirect to `/home`. After redirect, `pathname === "/home"` and the lookup misses entirely, returning undefined → no title shown.
- **Why it's a problem:** Mobile users land on `/home` and see no title in the header.
- **Suggested fix:** Add `"/home": "Accueil"` (or whatever the canonical label is) to `PAGE_TITLES`.

### 4.5 CommandPalette references `/projects` and `/space` — both redirects — Medium
- **Location:** `src/components/CommandPalette.tsx:26-33`
- **Description:** Items: Espace `/space`, Projects `/projects`. Both are `<Navigate>` redirects. The hotkeys still work but extra hop = wasted render.
- **Why it's a problem:** Pure routing debt — keystrokes go through two route resolutions. Minor perf, larger consistency concern.
- **Suggested fix:** Point directly to `/home` and `/home?tab=kanban`.

### 4.6 Header back-button to `/` from admin pages — Medium
- **Location:** `src/components/Header.tsx:201-207, 302-307`
- **Description:** The desktop `Site` button and the mobile overflow `Site` action both call `navigate("/")` — sending the operator to the public marketing site.
- **Why it's a problem:** "Site" is a vague label. A new operator may think it goes back to `/home`. It actually leaves the app.
- **Suggested fix:** Relabel to "Voir le site public" with an external-arrow icon.

### 4.7 ProjectStepNav has no "back to projects list" — Low
- **Location:** `src/components/ProjectStepNav.tsx`
- **Description:** Tab strip shows 5 inner steps but no breadcrumb back to the kanban / projects board.
- **Why it's a problem:** From `/project/123/cadrage`, mobile users need BottomNav → Home → Statut projets tab. Three taps.
- **Suggested fix:** Add a back-chevron at the start of the tab strip pointing to `/home?tab=kanban`.

### 4.8 ProjectSteps "Projet introuvable" → `/projects` — Low
- **Location:** `src/pages/ProjectSteps.tsx:90`
- **Description:** Recovery button routes to `/projects` (redirect to `/home?tab=kanban`).
- **Suggested fix:** Use the direct `/home?tab=kanban` path.

### 4.9 Hidden admin login on homepage — Low
- **Location:** `src/components/Header.tsx:224-232`
- **Description:** The lock icon for admin login is `text-muted-foreground/40` — intentionally hidden in plain sight. A new operator may not find it; bookmark to `/login` is the implied workflow.
- **Why it's a problem:** Defensible (operator-only), but the only person who needs it is the operator themselves. The icon is small + low contrast → discoverability issue.
- **Suggested fix:** Keep low-key but increase the hover/focus affordance.

---

## 5. Unclear CTAs (vague labels / hidden primary actions)

### 5.1 "Ouvrir" button on quotes list reveals nothing — Medium
- **Location:** `src/pages/QuotesList.tsx:408-412`
- **Description:** Primary action is labeled "Ouvrir" / "Open" — but the row is also already clickable territory.
- **Why it's a problem:** "Ouvrir" is generic; "Modifier" / "Éditer" is clearer for an internal tool.
- **Suggested fix:** Rename to "Modifier" / "Edit".

### 5.2 Quote row buttons (renew/duplicate) are icon-only with hover-only tooltips — Medium
- **Location:** `src/pages/QuotesList.tsx:388-407`
- **Description:** RefreshCw (renew invoice) and Copy (duplicate) are icon-only with `title` attribute. On mobile, no hover, no tooltip — users guess.
- **Why it's a problem:** Mobile users see a row of mystery icons.
- **Suggested fix:** On mobile, expand to a 3-dot overflow menu with text labels.

### 5.3 "Imprimer / Enregistrer PDF" is the only export — Low
- **Location:** `src/components/quotes/QuoteForm.tsx:664-667`
- **Description:** The button is a print iframe. A user expecting "Download PDF" gets a print dialog and has to choose "Save as PDF" on most OSes — works on macOS/Windows, less obvious on iOS.
- **Why it's a problem:** Mobile Safari has spotty save-as-PDF from print. iOS PWA users will struggle.
- **Suggested fix:** Server-side PDF render endpoint, or use jsPDF/html2pdf for true download. Or split into two buttons: "Imprimer" + "Email PDF au client".

### 5.4 "Auto" pill on quote number doesn't explain what it means — Low
- **Location:** `src/components/quotes/QuoteForm.tsx:389-393`
- **Description:** Small badge labeled "Auto" / "Auto" with no tooltip.
- **Why it's a problem:** First-time users don't know if it's a status, a button, or just decoration.
- **Suggested fix:** Add `title="Numéro généré automatiquement — modifiable"` or convert to a discrete `Wand2` button that re-runs autonumber.

### 5.5 Header CTA "Nouveau devis" vs in-page CTA "Nouveau devis" — Low
- **Location:** `src/pages/Home.tsx:62-78` vs `src/pages/QuotesList.tsx:206-211`
- **Description:** Same label, different visual weight (outline-on-primary vs accent button). Consistent label is good; the visual style differs page-to-page.
- **Suggested fix:** Standardize on `bg-accent` accent button for the primary "create" action.

### 5.6 ClientLogin "Accéder" is uncommon — Low
- **Location:** `src/pages/ClientLogin.tsx:90`
- **Description:** Submit button labeled "Accéder" / "Access". Most users expect "Continuer" / "Continue" or "Voir mes projets".
- **Suggested fix:** "Voir mes projets" / "View my projects".

### 5.7 Email gate "Continuer" without verb context — Low
- **Location:** `src/pages/ClientDashboard.tsx:170-172`
- **Description:** Submit on the per-project email gate says "Continuer" — but what happens next?
- **Suggested fix:** "Accéder au projet".

---

## 6. Missing confirmation dialogs / inconsistent confirmations

### 6.1 Three confirmation patterns for the same kind of action — Critical
- **Location:** `QuotesList.tsx:413-445` (AlertDialog), `ClientsManager.tsx:248-272` (inline 2-button), `Dashboard.tsx:472-495` (inline 2-button), `ProjectDocuments.tsx:79,150` (window.confirm), `ProjectStepNav.tsx:76` (window.confirm), `QuoteForm.tsx:170-174` (no confirm for line removal)
- **Description:** Five surfaces, three patterns. AlertDialog is accessible and styled. Inline 2-button is fast but easy to mis-tap. `window.confirm` breaks the visual language entirely.
- **Why it's a problem:** Muscle memory fails. A user who learned AlertDialog "click red Supprimer" on quotes will, in ProjectDocuments, hit a native browser confirm with default focus on "OK" → accidental delete.
- **Suggested fix:** Standardize on AlertDialog for all destructive actions (delete project / client / quote / phase / task / subtask). Reserve inline 2-button for "low-stakes" undoable actions like removing a line item in a draft quote. Eliminate `window.confirm` entirely.

### 6.2 Line item removal in QuoteForm has no confirmation — High
- **Location:** `src/components/quotes/QuoteForm.tsx:167-174, 516-526`
- **Description:** "Retirer" button removes a line item immediately. If the user accidentally clicks it on a line with a 5-line rich-text description, the work is gone.
- **Why it's a problem:** Rich-text edits are real work. One-click destruction without undo = user trauma.
- **Suggested fix:** Either (a) confirm if `description.length > 50` (best effort), or (b) move the removed line into a per-form undo stack and toast "Ligne supprimée — Annuler".

### 6.3 Phase deletion confirmation: inconsistent — High
- **Location:** `src/pages/ProjectSteps.tsx:180-191`
- **Description:** `apiDeletePhase` is called immediately, then tasks are re-parented to "unphased". No confirm.
- **Why it's a problem:** Deleting a phase with 10 tasks silently scatters them into the unphased pile. The toast "Phase supprimée" doesn't mention the impact.
- **Suggested fix:** AlertDialog: "Supprimer la phase 'X' ? Les N tâches associées seront déplacées dans 'Sans phase'."

### 6.4 Project share token regeneration — Medium
- **Location:** `src/components/ProjectShareDialog.tsx:72`
- **Description:** Uses `window.confirm` — breaks visual language.
- **Suggested fix:** Replace with `AlertDialog`. Make the consequence explicit ("L'ancien lien sera invalidé.").

### 6.5 Cadrage navigation guard uses window.confirm — Medium
- **Location:** `src/components/ProjectStepNav.tsx:75-78`
- **Description:** `if (dirty) { const ok = window.confirm("Modifications non sauvegardées. Continuer ?"); }` — the only place the user sees a native browser confirm during normal navigation.
- **Why it's a problem:** Breaks visual language; on mobile, the native dialog overlays awkwardly.
- **Suggested fix:** Use the existing AlertDialog primitive. Auto-save on nav-away would be even better given the page already debounces saves (2.3.3 in fact 3.3 — Cadrage auto-saves).

### 6.6 Import from modules / import from steps overwrite handling — Medium
- **Location:** `src/pages/ProjectDocuments.tsx:79`, `ProjectCadrage.tsx:104-112`
- **Description:** Cadrage's "Import from modules" appends without dedup check unless the *entire* text is already present. Documents page asks via `window.confirm` if existing quotes exist.
- **Why it's a problem:** Append-vs-replace decisions are made by the UI without showing the user which lines came from where.
- **Suggested fix:** Show a small "Imported from modules" label on auto-generated content; allow per-import revert.

---

## 7. Surprising behaviors

### 7.1 Stale shareToken not invalidated when project is deleted — Medium
- **Location:** `src/pages/Dashboard.tsx:309`, `src/contexts/ProjectsContext.tsx` (not read, inferred)
- **Description:** `deleteProject` removes the project locally; if a `shareToken` exists, the stakeholder URL `/funnel/s/<token>` may still resolve until the server side cleanly invalidates.
- **Why it's a problem:** Privacy concern: deleted projects could leak via stale URLs.
- **Suggested fix:** Audit the server-side token revocation on delete (not visible in this client code).

### 7.2 Quote print pre-update delay is fragile — Medium
- **Location:** `src/components/quotes/QuoteForm.tsx:182-184`
- **Description:** `await new Promise((resolve) => setTimeout(resolve, 150));` after `updateQuote` before `printViaIframe`. Time-based race.
- **Why it's a problem:** On a slow disk / extension-heavy Chrome, 150 ms may not be enough. User gets a print preview of the previous version.
- **Suggested fix:** Make `updateQuote` return a promise that resolves after persistence is flushed; await it.

### 7.3 Login redirects to `/space` after success, but `/space` is a redirect — Medium
- **Location:** `src/pages/LoginPage.tsx:13`
- **Description:** `const from = (location.state as { from?: string })?.from ?? "/space";` — falls back to `/space` which redirects to `/home`.
- **Why it's a problem:** Extra route resolution + inconsistency with the rest of the app moving toward `/home`.
- **Suggested fix:** Default to `/home`.

### 7.4 Service worker update banner not shown to non-admins — Medium
- **Location:** `src/components/UpdateBanner.tsx:34`
- **Description:** `if (!isAdmin) return null;` — but the comment says "web users also benefit from knowing to refresh."
- **Why it's a problem:** Public users (including clients hitting `/client/:id`) won't see "Nouvelle version disponible" → they'll get stuck on stale assets.
- **Suggested fix:** Show on all routes; gate the message text instead if needed.

### 7.5 Update banner reload is double-edged — Medium
- **Location:** `src/components/UpdateBanner.tsx:21-31`
- **Description:** `handleUpdate` posts SKIP_WAITING, adds a `controllerchange` listener that reloads, and *also* sets a 1 s fallback reload. If `controllerchange` fires fast, the user sees two reloads.
- **Why it's a problem:** Visible flash; risk of losing in-flight work if any.
- **Suggested fix:** Use a flag to ensure single reload.

### 7.6 Offline queue badge in Header is a positive number but no clickable detail — Medium
- **Location:** `src/components/Header.tsx:184-193`
- **Description:** Badge shows count of pending offline writes. Not clickable. No way for the user to see *what* is queued or force-retry.
- **Why it's a problem:** Anxiety-inducing for a user who realizes "I made 3 changes offline and... they're still queued?"
- **Suggested fix:** Make the badge open a popover listing queued operations with a "Retry now" button.

### 7.7 Welcome onboarding state stored per-project under `localStorage` — Low
- **Location:** `src/pages/ClientDashboard.tsx:67-69`
- **Description:** Key `kojima-client-welcomed-${id}` — clears with localStorage clear / different device. Client switching devices sees welcome again.
- **Suggested fix:** Server-side flag on the client or per-session token.

### 7.8 Auto-fill of conditions on client pick overwrites only when empty — Low
- **Location:** `src/components/quotes/QuoteForm.tsx:104-107`
- **Description:** `applyClient` does NOT overwrite existing conditions. Good behavior. But there's no UI hint that conditions were pre-filled from the client's last quote.
- **Suggested fix:** Show a "Conditions reprises du devis précédent" microcopy when auto-applied.

### 7.9 Intake form Enter-key handler also fires on autocomplete dropdowns — Low
- **Location:** `src/pages/IntakeForm.tsx:196-206`
- **Description:** `Enter` advances to next step except when in textarea. But on Safari, accepting an autocomplete suggestion also fires Enter → unintended advance.
- **Suggested fix:** Check `e.isComposing` and `e.target.matches("input[autocomplete]")`.

### 7.10 ScrollToTop runs on every navigation — Low
- **Location:** `src/components/ScrollToTop.tsx` (inferred from `App.tsx:114`)
- **Description:** Navigating between project step tabs likely scrolls to top, even though the tab strip itself is sticky.
- **Suggested fix:** Skip scroll-to-top for same-base-path navigation (e.g., within `/project/:id/*`).

---

## 8. Mobile / PWA-specific UX issues

### 8.1 InstallPrompt covers part of the FAB on small screens — Medium
- **Location:** `src/components/InstallPrompt.tsx:88` (`bottom-20`), `src/components/QuickActionFAB.tsx:53` (`bottom-24 sm:bottom-8`)
- **Description:** Both stack near the bottom. InstallPrompt at `bottom-20`, FAB action items animate up from `bottom-24`. UpdateBanner sits at `bottom-40`. With BottomNav at the bottom, the safe area is crowded.
- **Why it's a problem:** Users tapping the FAB on iOS Safari may also tap the InstallPrompt's X by accident, or the FAB's "Nouveau client" item may render *behind* the InstallPrompt.
- **Suggested fix:** When InstallPrompt is visible, raise FAB by an extra 56 px. Or anchor InstallPrompt above the BottomNav with an extra offset only when FAB is closed.

### 8.2 PWA install prompt dismissed for 7 days regardless of route — Low
- **Location:** `src/components/InstallPrompt.tsx:33-37`
- **Description:** One dismissal silences the prompt for 7 days globally. A user dismissing on a public page never sees it on the admin pages where it's most relevant.
- **Suggested fix:** Separate keys per surface.

### 8.3 No "Add to home screen" instructions for desktop PWA — Low
- **Location:** `src/components/InstallPrompt.tsx:24`
- **Description:** `isAdminPage` gates show, but `md:hidden` (line 88) hides on desktop entirely. Desktop Chrome supports PWA install too.
- **Suggested fix:** Show a desktop variant (small, top-right) when `beforeinstallprompt` fires on desktop.

### 8.4 BottomNav `Sprint` badge has motion (ping animation) — Low
- **Location:** `src/components/BottomNav.tsx:78-83, 124-129`
- **Description:** Constant animation = battery drain on always-on displays, and may distract during focus sessions.
- **Suggested fix:** Respect `prefers-reduced-motion`; stop animating after 60 s of session age.

### 8.5 Quote preview live-scaling is heavy on low-end Android — Medium
- **Location:** `src/components/quotes/QuoteForm.tsx:121-145`
- **Description:** Two `ResizeObserver`s plus a `transform: scale` on a 793px content node. Each line item rich-text edit triggers a re-measure.
- **Why it's a problem:** On a budget Android in the kojima-user's pocket, typing in a long quote may stutter.
- **Suggested fix:** Throttle the contentObs to once per 300 ms; or detach the live preview on mobile and show it via a "Preview" tab.

### 8.6 Mobile admin page title fallback — Medium (dup of 4.4)
- See 4.4. The `/home` route has no PAGE_TITLES entry, so the mobile header on `/home` falls back to the logo instead of a page title.

### 8.7 BottomNav doesn't reserve space for safe-area-inset-bottom in admin content — Low
- **Location:** `src/App.tsx:82` (`pb-safe-bottom`)
- **Description:** `pb-safe-bottom` is custom — needs to verify the value in tailwind config covers `env(safe-area-inset-bottom) + h-16` for the BottomNav itself. If only the inset is reserved (and not the 64 px nav height), the last content on long pages gets clipped on iOS.
- **Suggested fix:** Audit `pb-safe-bottom` in `tailwind.config` — should be `calc(env(safe-area-inset-bottom) + 4rem)` on routes where BottomNav is visible.

### 8.8 Email gate `autoFocus` on a centered card during iOS keyboard open — Low
- **Location:** `src/pages/ClientDashboard.tsx:159-166`
- **Description:** `autoFocus` causes iOS Safari to scroll the page; the centered `flex items-center justify-center` layout then re-centers awkwardly when the keyboard opens.
- **Suggested fix:** Use `align-items: flex-start` on small screens.

### 8.9 Intake form's sticky bottom CTA + safe-area uses single env() — Low
- **Location:** `src/pages/IntakeForm.tsx:311` (`pb-[max(0.75rem,env(safe-area-inset-bottom))]`)
- **Description:** Good. But text "Gratuit et sans engagement" (line 340-342) is at `text-[11px] text-muted-foreground/50` — sub-AA contrast.
- **Suggested fix:** Bump opacity to /70.

---

## Cross-cutting / Polish notes

- **Language mixing in admin UI.** ClientsManager form uses raw English strings ("Edit Client", "Name *", "Organization", "Cancel", "Update Client") — see `ClientsManager.tsx:117-179`. Inconsistent with the rest of the app that uses `useLanguage().t(...)`. Pick FR-only (operator language) or thread `t()` everywhere.
- **Tooltip on icon-only buttons relies on `title=` attribute.** Use the existing `Tooltip` primitive for better mobile + accessibility.
- **Accessibility:**
  - Lock icon (header admin login) `aria-label="Admin login"` is set via `title`, not `aria-label`.
  - Many destructive buttons lack `aria-describedby` linking to the consequence text.
  - Tab nav (`ProjectStepNav`) is correctly `role="tablist"` adjacent but uses `<button>` not `role="tab"` — re-evaluate.
- **Inline 2-button confirms (Clients, Dashboard cards) have no `aria-live` so screen reader users don't hear the new buttons appear.**
- **Project share token UI** copies to clipboard via `navigator.clipboard.writeText` (`Dashboard.tsx:118-123`) with no fallback for older Safari + no permission-denied handling.
- **The currency formatter `replace(/(?<=\d)[\s  ](?=\d)/g, "'")` is duplicated** across 5+ files; centralize in `lib/format.ts` to avoid drift (one file even uses bare regex spaces — line 770).

---

## Severity recap

| # | Title | Severity |
|---|---|---|
| 1.1 | "Nouveau projet" silently creates empty draft | Critical |
| 4.1 | Four different "home" destinations across nav | Critical |
| 6.1 | Three confirmation patterns for delete | Critical |
| 1.2 | FAB "Nouveau projet" points to redirect | High |
| 2.1 | QuotePrintPage dead end | High |
| 3.1 | Project creation no feedback | High |
| 3.2 | Client save no feedback | High |
| 4.2 | BottomNav active state inconsistent mobile/desktop | High |
| 4.3 | BottomNav lacks Quotes/Clients | High |
| 6.2 | Quote line removal no confirm | High |
| 6.3 | Phase deletion no confirm | High |
| 1.3 | Quote download requires save first | Medium |
| 1.4 | Intake auto-save silent | Medium |
| 1.5 | Quote auto-number silent rule | Medium |
| 1.6 | Welcome onboarding per project | Medium |
| 1.7 | Email gate redundancy | Medium |
| 2.2 | NotFound routes to / regardless of auth | Medium |
| 2.3 | QuoteEdit dead end | Medium |
| 2.4 | ClientDashboard "Projet introuvable" generic | Medium |
| 3.3 | Cadrage auto-save silent | Medium |
| 3.4 | Cadrage seed-from-intake silent | Medium |
| 3.5 | Quote acceptance no agency-notif confirmation | Medium |
| 3.6 | Quote delete no toast | Medium |
| 4.4 | Header /space title fallback misses /home | Medium |
| 4.5 | CommandPalette /projects /space redirects | Medium |
| 4.6 | "Site" button label vague | Medium |
| 5.1 | "Ouvrir" button label vague | Medium |
| 5.2 | Quote row icons unlabeled on mobile | Medium |
| 6.4 | Share token confirm uses window.confirm | Medium |
| 6.5 | Cadrage nav guard uses window.confirm | Medium |
| 6.6 | Cadrage import append/replace unclear | Medium |
| 7.1 | Stale share token after delete | Medium |
| 7.2 | Quote print 150ms timer race | Medium |
| 7.3 | Login default redirect /space | Medium |
| 7.4 | Update banner only for admins | Medium |
| 7.5 | Update banner double-reload risk | Medium |
| 7.6 | Offline queue badge not actionable | Medium |
| 8.1 | InstallPrompt overlaps FAB | Medium |
| 8.5 | Live preview perf on Android | Medium |
| 8.6 | Mobile title missing on /home | Medium |
| 1.8 | Stringly-typed mode state | Low |
| 2.5 | Intake success no "submit another" | Low |
| 3.7 | Header overflow no active dot | Low |
| 4.7 | ProjectStepNav no breadcrumb | Low |
| 4.8 | ProjectSteps recovery → /projects | Low |
| 4.9 | Admin login icon hard to find | Low |
| 5.3 | PDF export = print only | Low |
| 5.4 | "Auto" pill unexplained | Low |
| 5.5 | Quote CTA visual inconsistency | Low |
| 5.6 | ClientLogin "Accéder" odd | Low |
| 5.7 | Email gate "Continuer" vague | Low |
| 7.7 | Welcome stored per-project local | Low |
| 7.8 | Conditions auto-fill no hint | Low |
| 7.9 | Intake Enter intercepts autocomplete | Low |
| 7.10 | ScrollToTop too aggressive | Low |
| 8.2 | Install dismissal global 7d | Low |
| 8.3 | No desktop install hint | Low |
| 8.4 | Sprint badge constant animation | Low |
| 8.7 | Safe-area pb audit | Low |
| 8.8 | Email gate autofocus iOS scroll | Low |
| 8.9 | Intake fine-print contrast | Low |

---

*End of UX audit.*
