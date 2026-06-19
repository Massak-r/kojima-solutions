# Scope Expansion Roadmap — 2026-06-19

Greenlit by the user: **#1 cashflow forecast + Swiss VAT prep**, **#2 contract PDF (NO e-signature — manual signing, as today)**, **#3 persistent client space**, plus a new cross-cutting ask: **automatic deadline flagging** (admin assistance).
Deferred for now: e-signature, productization (multi-tenant SaaS).

Grounded in a 4-area codebase survey (2026-06-19). File paths below are the building blocks to reuse.

---

## ⚠️ Security finding — fix soon, independent of the roadmap

`GET public/api/projects.php` (no id) is **public** (only `requireAuthForWrites()`) and returns **every project in the DB** — all clients + `kind=internal/personal` — fully hydrated with internal fields: `notes`, `initialQuote`, `revisedQuote`, `invoiceNumber`, `paymentStatus`, per-task `estimatedHours`/`actualHours`/`sprintTier`/`completedBy`. `quotes.php` GET is likewise public.

`validateClientSession()` exists in `public/api/_bootstrap.php` (resolves `X-Client-Token` → `client_id`) but is **never called anywhere** — client scoping is dead code. The client email gate is client-side only (cosmetic).

**Fix:** gate/scope `projects.php` + `quotes.php` GET by `validateClientSession()` (or admin session), filter `WHERE client_id = ?`, and strip internal fields for client callers. This is also the hard prerequisite for Phase 4.

---

## Sequencing (leverage × dependency × risk)

Recommended order: **0 → 1 → 2 → 3 → 4**. Phase 0 is a cheap high-value win that also seeds the fiscal calendar Phase 3 needs; Phase 2 is a self-contained quick win that can slot in any time; Phase 4 is the largest and is security-gated.

---

### Phase 0 — Automatic deadline flagging  ·  effort S–M

**Goal:** the app auto-detects deadlines across domains (invoices, projects, fiscal) and surfaces them with zero manual entry.

**Build on (mostly orphaned infra that already does this):**
- `public/api/admin_deadlines.php` — a **complete CRUD + auto-notify API** that is currently **never called** (0 frontend hits). `checkAndNotify()` already inserts into the shared `notifications` table with a `remind_days` lead time → auto-appears in `NotificationBell` + pushed by `digest.php`. Fields: `title, due_date, category, recurring (dead), remind_days, completed, notified`.
- `public/api/digest.php` — THE cron (~20 min). Today fires `push_reminders`, wakes snoozed captures, pushes `notifications`. **No deadline-scan step yet** — this is the hook.
- `public/api/todo_subtasks.php` → `runDailyRefresh()` — the proven server-side auto-flag engine (runs on every GET, idempotent; `scheduled_for <= today → flagged_today=1`). Subtasks only — the pattern to copy.
- Derivations already written: `src/lib/relances.ts` `computeRelances()` (overdue invoices, to-invoice), `QuotesList.isOverdue`, `OverdueWork.tsx`/`UpcomingDeadlines.tsx` (project `endDate`/`task.deadline`), `src/api/renewals.ts` (`expiryDate` + `recurrence` quarterly/yearly + `advanceExpiry()`, already in `RenewalRadar`).
- Surfaces all exist: `notifications`+`NotificationBell` (polls 60s, app badge), `AlertsZone`, Today/`flaggedToday`, `BottomNav` badges.

**Gaps to fill:**
1. Add a **daily deadline-scan pass to `digest.php`** that walks: validated-overdue + soon-due invoices (`validityDate`), project `endDate`/`task.deadline` approaching, and a recurring **fiscal source**, emitting `notifications` rows (and optionally setting `flaggedToday` so items land in `AujourdhuiTab`).
2. **Fiscal seed (no source today):** seed Swiss recurring dates (TVA trimestrielle, AVS/acomptes) — extend `renewals` (already quarterly/yearly + surfaced) or revive `admin_deadlines` (already has `remind_days`+`recurring`). Implement the `recurring` roll-forward (currently dead) — mirror `advanceExpiry()`.
3. A **Deadlines surface + nav badge**: `/relances` is money-only and has no count badge; add a deadlines section/badge (reuse the `useInboxCount`/`NavCountBadge` pattern).

---

### Phase 1 — Cashflow forecast cockpit ("trésorerie prévisionnelle")  ·  effort M–L

**Goal:** a rolling forecast combining receivables + payables + retainers + recurring costs over a timeline, with a runway figure ("+X net this month", "Y months runway").

**Build on:**
- `public/api/payables.php` + `src/types/payable.ts` — the **canonical, forecast-ready model**: `direction:'out'|'in'`, `commitment:'committed'|'forecast'`, `recurrence` (weekly…yearly) + `recurrenceDay/End`, `adjustmentAmount`, `dueDate`, `accountId/projectId`. ⚠️ Recurrence is **materialized lazily** (next instance spawns only on `paid`) → the forecast must project recurrence **forward in-memory**.
- `public/api/accounts.php` + `AccountsManager.tsx` — `{ balance, type:'perso'|'entreprise' }` snapshots (the real balance spine).
- `src/lib/relances.ts` `computeRelances()` — `overdueInvoices` + `toInvoice` (remaining-to-bill via `billedPctFor`) = receivables, already computed.
- `src/components/personal/ForecastPanel.tsx` — existing 6-month forecast + **runway math (reusable as-is)**, but built on the **legacy** `PaymentPlan` + `personal_costs` + quotes and **ignores `payables`/`accounts`/`relances`/retainers**.
- `src/types/paymentPlan.ts` month-math helpers (`getAmountInMonth`, `isPlanActiveInMonth`) — reusable for forward projection.

**Gaps to fill:**
1. **Unify the spine on `payables` + `accounts`** — replace `ForecastPanel`'s `localStorage` balance with `Σ accounts.balance`; feed it `payables` (currently uses none); `commitment` gives a committed-vs-forecast scenario toggle.
2. **Forward-project recurrence in TS** (port `payables.php nextDueDate()` / reuse `paymentPlan.ts` math) — no shared util exists.
3. **Receivables from `computeRelances`**, with an **expected-pay-date assumption** (e.g. `validityDate` or invoice + 30d) — not modeled today.
4. **Retainers have no schedule** — model each as `Payable{direction:'in', recurrence:'monthly'}` so they flow through one engine (instead of the manual `billRetainer` click).
5. **De-dupe recurring costs** — they live in both `personal_costs` and `payables{out,recurrence}`; pick one for the forecast or double-count burn.
6. Optional: daily granularity + per-account (perso/entreprise) lanes (both existing forecasts are monthly + single-pooled).

---

### Phase 2 — Contract / engagement-letter PDF (manual signature)  ·  effort S–M

**Goal:** generate a contract PDF from an accepted devis (parties + scope + amount + CGV + manual signature blocks). No e-sign, no auto-trigger.

**Build on (the print pipeline is fully reusable — mirror it):**
- `src/lib/printUtils.ts` `printViaIframe(url)` — silent print via hidden iframe (no new tab, no server PDF).
- `src/pages/QuotePrintPage.tsx` — `:id` → `getQuote` → `document.title` (drives Save-as-PDF name) → inject `@page A4` → auto-print-unless-iframe. **`FunnelPrintPage.tsx` is the closer template** (a non-quote doc built from arbitrary fetched data, **no DB row**).
- `src/components/quotes/QuotePreview.tsx` — reusable header (company from `useCompanySettings`: `companyName/ownerName/address/ideNumber/email`) + client block + line-item/totals rendering.
- `src/types/companySettings.ts` — `conditionsPresets`/`paymentTermsPresets` (devis-flavored CGV, attached by value into `quote.conditions`/`paymentTerms`).
- Numbering: `nextQuoteNumber` / `buildQuoteFilename` / `invoiceNumberFromQuote` (mirror for `CTR-YYYY-MM-NNN`).

**Gaps to fill (v1 needs NO schema change):**
1. New `src/pages/ContractPrintPage.tsx` (copy `QuotePrintPage`) + public route `/quotes/:id/contract/print` in `App.tsx` public block.
2. New `src/components/contracts/ContractPreview.tsx` — reuse `QuotePreview` header/parties/scope; add engagement-letter intro + a CSS **two-column manual signature block** (Prestataire / Client: lieu, date, nom, ligne de signature).
3. **"Accepted devis" binding** — nothing marks which quote is accepted (acceptance lives on the funnel: `status='active'`+`tier`). v1: pass `quoteId` from the entry button; later optional `Quote.acceptedAt`/`funnelId`.
4. **Fuller CGV** — engagement letters want PI / résiliation / responsabilité / for juridique. v1: reuse `quote.conditions`+`paymentTerms`; better: add `contractClausesPresets` to `CompanySettings`.
5. Entry button: `printViaIframe('/quotes/${id}/contract/print')` next to "Télécharger PDF" in `QuoteForm`, and/or on the project view.

---

### Phase 3 — Quarterly Swiss VAT décompte  ·  effort M

**Goal:** a quarterly TVA décompte summary (output VAT − input VAT) + due-date reminders + fiduciaire export.

**Build on:**
- Real output VAT: `Σ tvaAmountQuote(q)` over period invoices — pattern already in `Accounting.tsx` `tvaCollectedReal` (lines 269-275, currently annual).
- `src/lib/clotureExport.ts` `buildClotureRows`/`CLOTURE_COLUMNS` — annual fiduciaire CSV with a per-invoice `tva` column; template a "décompte CSV" off it.
- `src/components/accounting/TaxSetAside.tsx` — the set-aside framing.
- Phase 0's fiscal calendar for the décompte due dates (`category='TVA', recurring='quarterly'`).

**Gaps to fill:**
1. **Period bucketing** (Q1–Q4) on a configurable basis — Swiss is normally *contre-prestations convenues* (accrual, by invoice date) vs *reçues* (cash, by `paidAt`); the system reliably has `createdAt` + `paidAt`. Pick + document.
2. **Input VAT is the big hole** — `Expense` (and payables) have **no TVA field**; `tvaPaid` is a flat `×0.081` guess. Add `vatRate`/`deductible` to `Expense`/`Payable` + a capture UI for a real net décompte.
3. **Unify `TVA_RATE`** — `quote.ts` uses `8.1` (percent), `accounting/utils.ts` uses `0.081` (fraction). Cross-wire risk; unify first.
4. **Method support** — no model for *taux de la dette fiscale nette* (TDFN/forfaitaire), common for a solo studio (`CA_TTC × taux`, no input-VAT deduction). A missing settings field.
5. Map to the official form boxes (CA total, exonéré/exclu, TVA due, impôt préalable, à payer).

---

### Phase 4 — Persistent client space ("espace client")  ·  effort L · security-gated

**Goal:** one authenticated home per client: their projects' live status, deliverables, invoices + pay status, shared docs, and a unified decision/message log.

**Build on:**
- Auth: `public/api/client_login.php` (email → 30-day opaque token in `client_sessions`), `src/lib/auth.ts` (`getClientSession`), `src/api/client.ts` (sends `X-Client-Token` on every request), `_bootstrap.php` `validateClientSession()` (**defined, unused**).
- Existing client pages: `ClientDashboard.tsx` (per-project: progress, timeline, deliverables, devis+"Accepter"), `ClientProposal.tsx`, `StakeholderView.tsx`, gate/feedback decision pages.
- Working client-write endpoints (no-auth, token-scopable): `funnel_gates.php`, `steps.php`. Doc sharing: `admin_doc_share.php`/`admin_folder_share.php` + `SharedFolder.tsx`.

**Gaps to fill (in order):**
1. **Security first (see top):** wire `validateClientSession()`, client-scope `projects.php`/`quotes.php`, strip internal fields. Consider magic-link/OTP before trusting the session for invoices/docs (today any known email → token).
2. **Authenticated client home** `/espace` — reads `getClientSession()`, lists the client's projects server-side (login result is currently transient state).
3. **Cross-project aggregation** — statuses, pending actions, all invoices across the client's projects.
4. **Invoices + pay status** — client-safe invoices endpoint; the "Accepter le devis" write currently **fails for real clients** (admin-gated `quotes.php` → 403 rollback). Re-route client writes to token-scoped endpoints.
5. **Deliverables / shared docs bound to client/project** — today `admin_docs` shares are standalone out-of-band tokens, not linked to a client. Add a `project_documents` association + client-scoped listing.
6. **Unified decision/message log** — consolidate `feedback_requests.responseHistory`, `funnel_gates`+`gate_comments`, `step_comments`, `task_feedbacks`, `notifications` into one client-scoped timeline with read state. (`objective_decisions` is internal — not reusable.)

---

## Cross-cutting cleanups (do alongside)

- **Unify `TVA_RATE`** (8.1 vs 0.081) — blocks clean Phase 3 math.
- **One recurring-cost source** — `personal_costs` vs `payables{out,recurrence}` — for the forecast.
- **Forecast spine decision** — converge on `payables` + `accounts`; retire/absorb the legacy `PaymentPlan` path (`TresorerieTab` already flags it legacy).
