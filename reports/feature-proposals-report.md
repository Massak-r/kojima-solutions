# Feature Proposals — Kojima Solutions (zen-code-studio)

**Date:** 2026-05-11
**Method:** Proposals derived from observed gaps in the codebase, the UX audit (`reports/ux-audit-report.md`), and the existing capability surface (intake → brief → cadrage → modules → etapes → documents/quotes; client portal with gates/feedback; sprint + objectives; treasury + accounting). All proposals build on existing primitives — no greenfield rewrites.

**Scoring conventions:**
- **Complexity** — S (≤1 day, contained to 1–3 files), M (2–5 days, multi-module, new state + UI), L (>5 days, new subsystem, schema/migration, or significant async work).
- **Impact (1–5)** — 5 = transforms a daily workflow or unblocks new revenue/clients; 3 = removes recurring friction; 1 = polish.
- **Ratio** — `Impact ÷ Effort` (S=1, M=3, L=8). Used to rank.

---

## Ranking (impact/effort, best first)

| # | Feature | Impact | Effort | Ratio | Helps |
|---|---|---|---|---|---|
| 1 | Quick-create modal for projects/clients/quotes (kill silent-draft pattern) | 5 | S | 5.00 | Operator |
| 2 | Undo-toast for destructive deletes (unified) | 5 | S | 5.00 | Operator |
| 3 | "Send to client" share flow with copy-link + email template | 5 | M | 1.67 | Operator + Clients |
| 4 | Saved quote/invoice templates ("Dupliquer ce devis") | 4 | S | 4.00 | Operator |
| 5 | Global activity & ball-in-court inbox on `/home` | 5 | M | 1.67 | Operator |
| 6 | Recurring expenses + treasury forecasting | 4 | M | 1.33 | Operator |
| 7 | Time-tracking → auto-suggest invoice lines (close the loop) | 5 | L | 0.63 | Operator |
| 8 | Client-side document signature (e-sign on devis & cadrage) | 4 | L | 0.50 | Operator + Clients |
| 9 | Sprint capacity planner with carry-over | 3 | M | 1.00 | Operator |
| 10 | PWA offline read + queued mutations | 3 | L | 0.38 | Operator (mobile) |

---

## 1. Quick-create modal for projects / clients / quotes

**Description.** Replace the "click → empty draft + redirect" pattern (today's `Nouveau projet`, `Nouveau client`, `Nouveau devis`) with a single reusable modal that captures the minimum viable fields (title, client picker for projects; name + email for clients; client + doc-type for quotes) before creating the record. Surfaces as `<QuickCreateDialog />` and is wired into the FAB, Header CTAs, BottomNav and CommandPalette.

**Who it helps.** The operator. Eliminates orphan "Untitled" drafts that pollute the kanban, kills the deceptive "Nouveau projet" FAB affordance, and gives a consistent feel across creation surfaces.

**Complexity:** S
**Impact:** 5
**Ratio:** 5.00

**Technical approach.**
- New `src/components/quick-create/QuickCreateDialog.tsx` built on shadcn `Dialog` + react-hook-form + zod.
- A discriminated-union prop `kind: "project" | "client" | "quote"` picks the schema and the submit handler from existing contexts (`useProjects().createProject`, `useClients().createClient`, `useQuotes().createQuote`).
- Replace direct `createProject()` calls in `Home.tsx:42`, `Dashboard.tsx:98`, `KojimaSpace.tsx:39`, `QuickActionFAB.tsx:17` with `openQuickCreate("project")`.
- Route the user to the detail page after the dialog resolves with the new ID.

---

## 2. Undo-toast for destructive deletes

**Description.** Replace the three current confirmation patterns (`AlertDialog`, inline 2-button toggle, raw `window.confirm`) with a single "Optimistic delete + Undo toast" pattern: the row disappears immediately, a Sonner toast with an `Annuler` action stays visible for 6 s, and the actual hard-delete happens only after the toast expires. Existing `AlertDialog`s become opt-in for truly irreversible operations (e.g., factures already issued).

**Who it helps.** Operator. Eliminates "did I just delete the right one?" anxiety. Faster bulk cleanup. Consistent muscle memory across `QuotesList`, `ClientsManager`, `Dashboard`, `ProjectDocuments`.

**Complexity:** S
**Impact:** 5
**Ratio:** 5.00

**Technical approach.**
- New `src/hooks/useUndoableDelete.ts` returning `{ deleteWithUndo(item, hardDelete) }`. Internally it stashes the item in a `Map<id, item>` keyed by a UUID, fires `sonner.toast("Supprimé", { action: { label: "Annuler", onClick: () => restore() } })`, and a `setTimeout(6000)` calls the real `hardDelete`.
- Restore handler re-inserts via the parent context (`createQuote`, `createClient`, etc.) using the cached payload.
- Migrate call sites one by one; remove `window.confirm` in `ProjectDocuments.tsx:79,150` and `ProjectShareDialog`.

---

## 3. "Send to client" share flow with copy-link + email template

**Description.** Today, the operator generates a quote/proposal/funnel link, then leaves the app to copy-paste it into Gmail. Build a `<ShareDialog />` accessible from any quote, proposal, or stakeholder funnel that: (a) generates the public URL, (b) shows a copy-to-clipboard button, (c) generates a pre-filled `mailto:` link with a templated subject + body in the client's language (FR/EN — already supported via `useLanguage`), (d) marks the document as "Envoyé le {date}" on the underlying record.

**Who it helps.** Operator (cuts a 3-app dance to 1 click) + clients (consistent, professional messages).

**Complexity:** M
**Impact:** 5
**Ratio:** 1.67

**Technical approach.**
- New `src/components/share/ShareDialog.tsx`. Templates live in `src/data/share-templates.ts` as `{ fr: { subject, body }, en: {...} }` keyed by `kind`.
- Templates interpolate `{clientName}`, `{quoteNumber}`, `{amount}`, `{link}`, `{senderName}` from existing data.
- Add a `sent_at` column on `quotes`, `proposals`, `funnels` and a `markSent(id)` mutation. Already-displayed badges on `QuotesList` ("Brouillon" / "Envoyé") rerender automatically.
- Wire into `QuoteEdit.tsx` actions row, `ClientProposal.tsx` admin view, `Dashboard.tsx` kanban card menu.

---

## 4. Saved quote/invoice templates ("Dupliquer ce devis")

**Description.** A `Dupliquer` action on every quote in `QuotesList` that creates a new draft with all line items copied, the date reset to today, the auto-number recomputed, and the user landed in edit mode. Optionally save a quote as a named template ("Audit standard", "Site vitrine") visible in `QuoteNew` as a starter.

**Who it helps.** Operator. Most freelancers reuse 3–5 quote shapes; today this is a copy-paste-and-edit job inside the form.

**Complexity:** S
**Impact:** 4
**Ratio:** 4.00

**Technical approach.**
- Extend `useQuotes` with `duplicateQuote(id): Promise<string>` — deep-clones lines, resets `id/number/date/payment_terms.due_date/status='draft'`, persists, returns new ID.
- Add an action item to the quote row menu in `QuotesList.tsx`.
- Templates: add `is_template: boolean` + `template_name: string` columns. In `QuoteNew.tsx`, show a "Partir d'un modèle…" combobox before the empty form renders. Selecting calls `duplicateQuote(templateId)`.

---

## 5. Global activity & ball-in-court inbox on `/home`

**Description.** Replace the current generic "Latest projects" widget on `Home` with an actionable inbox that surfaces what needs the operator's attention today: pending client feedback awaiting reply, gate decisions over their SLA, quotes accepted but not yet invoiced, intake submissions awaiting brief generation, sprint subtasks flagged for today. Each row has a primary CTA that deep-links to the right screen.

**Who it helps.** Operator — single pane of glass for "what should I do next?". Cuts the manual scan across `/quotes`, `/projects-board`, `/sprint`, `/clients`.

**Complexity:** M
**Impact:** 5
**Ratio:** 1.67

**Technical approach.**
- New `src/components/home/InboxFeed.tsx` that aggregates results from existing queries (already cached by React Query): `useQuotes()`, `useProjects()`, `useGateDecisions()`, `useClientFeedback()`, `useSprintToday()`.
- A `priority` score derived from `(daysOverdue * weight)` ranks rows.
- Add a server-side `kojima.list_activity` aggregator (already exists per MCP tool list) and call it once instead of N client queries if perf becomes an issue.
- Each row renders an `<InboxRow icon kind title meta cta />`.

---

## 6. Recurring expenses + treasury forecasting

**Description.** The `Tresorerie` page currently shows balance + flat expense list. Add: (a) `Recurring expense` type (monthly/quarterly/annual) with auto-generation on schedule, (b) a 6-month forecast chart that projects balance forward using recurring incomes (subscriptions) + recurring expenses + scheduled invoice due dates, (c) a "runway" badge: "≈ 14 mois à ce rythme".

**Who it helps.** Operator. Solo founder/freelancer cashflow planning is the single highest-leverage decision they make monthly; today it lives in a spreadsheet.

**Complexity:** M
**Impact:** 4
**Ratio:** 1.33

**Technical approach.**
- Schema: extend `personal_costs` / `expenses` with `recurrence: 'none'|'monthly'|'quarterly'|'annual'` + `next_run_at`.
- A nightly cron (or on-page-load idempotent check) materializes the next instance when `next_run_at <= now`.
- Forecast chart: shadcn `Recharts` line. Inputs come from `useExpenses` + `useQuotes` (accepted, unpaid, with `due_date`) + `usePersonalCosts`.
- Runway = current balance ÷ avg-monthly-net-burn over last 90 d.

---

## 7. Time-tracking → auto-suggest invoice lines (close the loop)

**Description.** A focus timer already exists (`start_focus`/`stop_focus` MCP tools + `attribute_focus_subtasks`). Build the missing other end: on a project's `ProjectDocuments` → `Nouvelle facture`, an "Importer le temps tracé" button proposes line items grouped by `module` or `objective` (`X.X h × CHF Y` based on the user's hourly rate), and lets the operator accept/edit before saving. The `suggest_quote_lines` MCP tool is already wired — surface it.

**Who it helps.** Operator on a `temps & matériel` model. Replaces "scroll through 3 weeks of focus sessions, do arithmetic in your head" with one button.

**Complexity:** L
**Impact:** 5
**Ratio:** 0.63

**Technical approach.**
- New `src/components/quotes/TimeImportDialog.tsx`. Calls `mcp__kojima__suggest_quote_lines(projectId)` via the existing MCP bridge.
- The dialog shows a checklist of proposed lines with quantity, unit price, total. Apply → push into the active `QuoteForm` line array.
- Add a user-level "default hourly rate" in `SettingsPage` (per language EN/FR) + per-client override on `ClientsManager`.
- Tag focus sessions as `billed` once attached to an invoice; show `Non facturé` badge on unbilled sessions in `ObjectiveWorkspace`.

---

## 8. Client-side document signature (e-sign on devis & cadrage)

**Description.** Today the client portal has decision pages (`/client/:id/decision/:gateId`) — accept/reject is a click. Extend to a real e-signature on devis and cadrage: typed-name + checkbox + drawn-signature-pad, audit trail (`signed_at`, `signer_email`, IP, user-agent), and a stamped PDF version stored as immutable. The operator gets a notification and the "Brouillon → Envoyé → Signé" badge advances.

**Who it helps.** Operator (closes deals without leaving the app) + clients (no PDF download → DocuSign dance for small contracts).

**Complexity:** L
**Impact:** 4
**Ratio:** 0.50

**Technical approach.**
- New table `document_signatures (id, doc_type, doc_id, signer_email, signer_name, signed_at, ip, ua, signature_png)`.
- Signature pad: `react-signature-canvas` (peer dep, ~10 kB gz). Persist PNG as base64.
- Re-render the print template (already in `QuotePrintPage`) with the signature overlaid bottom-right + audit-trail footer, generate PDF server-side or via browser print-to-PDF, store URL.
- Email the signed PDF (subject to the "no real emails" rule — surface a "Envoyer manuellement" prompt with the file attached to a `mailto:` instead).

---

## 9. Sprint capacity planner with carry-over

**Description.** The `Sprint` page exists (with `SprintCapProvider` + overload dialog). Add: (a) weekly capacity input (e.g., 25h available this week) versus committed subtask estimates, (b) an automatic "carry-over" of unfinished subtasks into next week with a one-tap "Reporter à la semaine prochaine" button, (c) a retrospective on Friday that surfaces completion rate + a "what slipped, why" prompt that creates a `decision` via `create_decision`.

**Who it helps.** Operator. Today the sprint surface is a flat list; commitment vs reality is invisible.

**Complexity:** M
**Impact:** 3
**Ratio:** 1.00

**Technical approach.**
- Extend `SprintCapProvider` with `weeklyCapacityHours` (per-user setting in `SettingsPage`).
- Each subtask gets an `estimate_hours` field. Aggregate live in the provider, surface as a progress bar in `BottomNav` sprint badge + `SprintPage` header.
- Friday-evening trigger: `FocusRetroPrompt` (already exists) extends to ask the per-week wrap-up, autofilled with stats from `get_week_stats`, and on submit calls `create_decision` + `create_note`.

---

## 10. PWA offline read + queued mutations

**Description.** The app is already a PWA (`InstallPrompt`, `UpdateBanner`). Add (a) read-through caching of last-seen project/quote/client lists so a flaky train ride still shows data, (b) a write queue that captures mutations while offline and replays them on reconnect with conflict detection.

**Who it helps.** Operator on mobile (PWA). Switzerland trains, client offices with bad wifi.

**Complexity:** L
**Impact:** 3
**Ratio:** 0.38

**Technical approach.**
- React Query persister: `@tanstack/query-sync-storage-persister` + `IndexedDB` (via `idb-keyval`).
- Service worker (Workbox) for asset cache (already present in PWA setup).
- Mutation queue: subclass the existing mutation calls in `useQuotes`, `useProjects` etc. to enqueue under `outbox` when `!navigator.onLine`. On `online` event, replay in order, with a Sonner toast for each success/failure.
- Conflict policy: last-write-wins for now (single-user app); revisit if multi-seat is added.

---

## Honorable mentions (cut from the top 10)

- **Multi-language client portal toggle** — `useLanguage` already exists, but the client portal hardcodes FR. Trivial.
- **Bulk actions in QuotesList** (`Marquer comme envoyé`, `Exporter CSV`, `Archiver`) — useful at scale, not yet.
- **Smart search across clients + projects + quotes + notes** — CommandPalette already exists; promote to a fuzzy global index (Fuse.js).
- **Dark mode** — `tailwind.config.ts` has the tokens but no toggle UI.
- **Notion/Linear export of cadrage + modules** — power-user request, niche.
