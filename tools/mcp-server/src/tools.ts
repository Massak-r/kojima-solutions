import {
  listAdminObjectives, listPersonalObjectives,
  createAdminObjective, createPersonalObjective,
  updateAdminObjective, updatePersonalObjective,
  listSubtasks, createSubtask, updateSubtask,
  startSession, stopSession, patchSession, attributeSessionSubtasks, listSessions,
  getGlobalWeekSummary,
  listNotes, createNote, updateNote, deleteNote,
  listDecisions, createDecision, updateDecision,
  listActivity,
  listClients, getClient, createClient, updateClient,
  listProjects, getProject, createProject, updateProject,
  getProjectModules, saveProjectModules,
  getCadrage, saveCadrage,
  listIntakes, getIntakeByProject, updateIntake,
  listQuotes, listProjectQuotes, getQuote, createQuote, updateQuote,
  listAdminDocs, updateAdminDoc, deleteAdminDoc,
  listAdminFolders, createAdminFolder, updateAdminFolder,
  listPersonalDocs, updatePersonalDoc,
  listExpenses, createExpense, updateExpense,
  listPersonalCosts, createPersonalCost, updatePersonalCost,
  listAccounts, createAccount, updateAccount, deleteAccount,
  listPayables, createPayable, updatePayable, deletePayable,
  classifyPdf, generateBriefFromIntake, suggestQuoteLines,
  listInboxCaptures, addInboxCapture, markCaptureTriaged, deleteInboxCapture,
  type ObjectiveSource, type ObjectiveSummary, type SubtaskItem,
} from "./api.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_objectives",
    description:
      "List all objectives across admin and/or personal sources. Each objective is a top-level goal with sub-actions (subtasks). Use this to discover what the user is working on, then fetch details with get_objective.",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          enum: ["admin", "personal", "both"],
          description: "Which namespace to list. Defaults to 'both'.",
        },
        include_completed: {
          type: "boolean",
          description: "Include completed objectives. Defaults to false (active only).",
        },
        only_objectives: {
          type: "boolean",
          description: "If true (default), filter to rows flagged as is_objective=true. Set false to include simple todos.",
        },
      },
    },
  },
  {
    name: "get_objective",
    description:
      "Fetch one objective with its full subtask tree (and a few recent focus sessions). Use this before proposing changes to make sure context is current.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["admin", "personal"] },
        id:     { type: "string", description: "Objective UUID." },
      },
      required: ["source", "id"],
    },
  },
  {
    name: "create_objective",
    description:
      "Create a new top-level objective. Use source='admin' for work/business goals and source='personal' for personal goals. Returns the created objective with its id.",
    inputSchema: {
      type: "object",
      properties: {
        source:           { type: "string", enum: ["admin", "personal"] },
        text:             { type: "string", description: "Short, clear objective title." },
        category:         { type: "string", description: "Category label (e.g. 'Kojima-Solutions', 'Perso', 'Emploi', 'Famille')." },
        priority:         { type: "string", enum: ["low", "medium", "high"] },
        description:      { type: "string" },
        smartSpecific:    { type: "string" },
        smartMeasurable:  { type: "string" },
        smartAchievable:  { type: "string" },
        smartRelevant:    { type: "string" },
        definitionOfDone: { type: "string" },
        linkedProjectId:  { type: ["string", "null"] },
        linkedClientId:   { type: ["string", "null"] },
        dueDate:          { type: "string", description: "Optional ISO date YYYY-MM-DD." },
      },
      required: ["source", "text"],
    },
  },
  {
    name: "create_subtask",
    description:
      "Create a new subtask (or sub-subtask) under an objective. Use parent_subtask_id to nest under another subtask. Optional effort_size and estimated_minutes power the measurement loop.",
    inputSchema: {
      type: "object",
      properties: {
        source:           { type: "string", enum: ["admin", "personal"] },
        objective_id:     { type: "string" },
        text:             { type: "string", description: "Concise actionable step (one verb)." },
        parent_subtask_id:{ type: "string", description: "Optional. If set, creates a 2nd-level child." },
        due_date:         { type: "string", description: "Optional ISO date YYYY-MM-DD." },
        effort_size:      { type: "string", enum: ["rapide", "moyen", "complexe"] },
        estimated_minutes:{ type: "number", description: "Estimated focus time in minutes." },
        flagged_today:    { type: "boolean", description: "Pin this as part of today's sprint." },
        priority:         { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["source", "objective_id", "text"],
    },
  },
  {
    name: "update_subtask",
    description:
      "Patch one subtask. Use this to mark complete, flag for today, change effort size, set recurrence, schedule for a specific day, or rename. Always pass only the fields you intend to change.",
    inputSchema: {
      type: "object",
      properties: {
        id:                { type: "string" },
        text:              { type: "string" },
        completed:         { type: "boolean" },
        flagged_today:     { type: "boolean" },
        effort_size:       { type: "string", enum: ["rapide", "moyen", "complexe"] },
        estimated_minutes: { type: "number" },
        priority:          { type: "string", enum: ["low", "medium", "high"] },
        status:            { type: "string", enum: ["not_started", "in_progress", "done", "blocked"] },
        due_date:          { type: "string" },
        recurrence:        { type: "string", enum: ["daily", "weekdays", "weekly", "monthly"], description: "Recurrence pattern. Pass empty string to clear." },
        recurrence_day:    { type: "number", description: "For weekly: ISO weekday 1=Mon…7=Sun. For monthly: day-of-month 1–31. Ignored for daily/weekdays." },
        scheduled_for:     { type: "string", description: "ISO date YYYY-MM-DD to plan the task for. Pass empty string to unschedule." },
      },
      required: ["id"],
    },
  },
  {
    name: "update_objective",
    description:
      "Patch the objective-level fields: SMART criteria, status, priority, definition of done, linked project/client, etc.",
    inputSchema: {
      type: "object",
      properties: {
        source:             { type: "string", enum: ["admin", "personal"] },
        id:                 { type: "string" },
        text:               { type: "string" },
        status:             { type: "string", enum: ["not_started", "in_progress", "done", "blocked"] },
        priority:           { type: "string", enum: ["low", "medium", "high"] },
        smartSpecific:      { type: "string" },
        smartMeasurable:    { type: "string" },
        smartAchievable:    { type: "string" },
        smartRelevant:      { type: "string" },
        definitionOfDone:   { type: "string" },
        linkedProjectId:    { type: ["string", "null"] },
        linkedClientId:     { type: ["string", "null"] },
        dueDate:            { type: "string" },
      },
      required: ["source", "id"],
    },
  },
  {
    name: "start_focus",
    description:
      "Start a focus session on an objective (and optionally one or more subtasks). Auto-closes any other open session on the same objective. Pass subtask_ids[] when the user announces upfront that they'll work across several subtasks (their effort gets split equally between them at aggregation time). Otherwise pass subtask_id and refine later via attribute_focus_subtasks. Returns the new session record.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
        subtask_id:   { type: "string", description: "Optional. The specific subtask the session starts on. Stays in sync with subtask_ids[0]." },
        subtask_ids:  { type: "array", items: { type: "string" }, description: "Optional. Several subtasks to credit (e.g. work spans multiple projects). Each gets duration_sec/N at aggregation." },
      },
      required: ["source", "objective_id"],
    },
  },
  {
    name: "attribute_focus_subtasks",
    description:
      "Replace the list of subtasks credited by a focus session. Use this after a session ends when the user mentions they also worked on other flagged subtasks — typically across several projects. Setting subtask_ids: [] clears all attribution (the session keeps its raw duration_sec but no longer maps to projects via the pivot).",
    inputSchema: {
      type: "object",
      properties: {
        session_id:   { type: "string" },
        subtask_ids:  { type: "array", items: { type: "string" }, description: "Replacement list. Order is preserved; the first id becomes the legacy subtask_id." },
      },
      required: ["session_id", "subtask_ids"],
    },
  },
  {
    name: "stop_focus",
    description:
      "Stop a focus session. Pass session_id explicitly, or omit to find the most recent open session for the given objective. Optionally record an accuracy retro and a note.",
    inputSchema: {
      type: "object",
      properties: {
        session_id:   { type: "string" },
        source:       { type: "string", enum: ["admin", "personal"], description: "Required if session_id is omitted." },
        objective_id: { type: "string", description: "Required if session_id is omitted." },
        accuracy:     { type: "string", enum: ["faster", "on_target", "slower"], description: "Compared to estimate." },
        note:         { type: "string" },
      },
    },
  },
  {
    name: "get_week_stats",
    description:
      "Global focus-time summary for the current ISO week: totalSec, sessionCount, byDay bars, top objectives by time. Useful for retros and weekly planning.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_notes",
    description:
      "List markdown notes attached to an objective. Pinned notes come first, then by most-recently-updated.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
      },
      required: ["source", "objective_id"],
    },
  },
  {
    name: "create_note",
    description:
      "Add a markdown note to an objective. Use this during or after a focus session to capture insights, blockers, or links the user mentions.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
        title:        { type: "string", description: "Optional short title." },
        content:      { type: "string", description: "Markdown body." },
        pinned:       { type: "boolean" },
      },
      required: ["source", "objective_id"],
    },
  },
  {
    name: "update_note",
    description: "Patch one note: title, content, or pinned state.",
    inputSchema: {
      type: "object",
      properties: {
        id:      { type: "string" },
        title:   { type: "string" },
        content: { type: "string" },
        pinned:  { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_note",
    description: "Permanently delete a note. Confirm with the user before calling — there is no undo.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_decisions",
    description:
      "List logged decisions for an objective in reverse chronological order. Each decision has a title, optional rationale, and a decided_at timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
      },
      required: ["source", "objective_id"],
    },
  },
  {
    name: "create_decision",
    description:
      "Log a new decision on an objective. Use this when the user says they've decided something material — direction change, scope cut, vendor choice. Always include rationale if available.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
        title:        { type: "string", description: "What was decided, in one line." },
        rationale:    { type: "string", description: "Why. The reasoning future-you will want." },
        decided_at:   { type: "string", description: "Optional ISO datetime; defaults to now." },
      },
      required: ["source", "objective_id", "title"],
    },
  },
  {
    name: "update_decision",
    description: "Patch a decision: rename, refine the rationale, or correct the timestamp.",
    inputSchema: {
      type: "object",
      properties: {
        id:        { type: "string" },
        title:     { type: "string" },
        rationale: { type: "string" },
        decidedAt: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_activity",
    description:
      "Read the auto-emitted activity timeline for an objective (session_started, session_ended, etc.). Useful for retros and reconstructing what happened.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
        limit:        { type: "number", description: "Max events to return (default 50, max 500)." },
      },
      required: ["source", "objective_id"],
    },
  },

  // ── Clients ────────────────────────────────────────────────────
  { name: "list_clients", description: "List all clients (id, name, email, company, etc.).", inputSchema: { type: "object", properties: {} } },
  { name: "get_client",   description: "Fetch one client by id.",   inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "create_client",description: "Create a new client. Pass any subset of fields the user provides (name, email, company, phone, address, notes, …).",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_client",description: "Patch a client. Pass only the fields to change.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Projects ───────────────────────────────────────────────────
  { name: "list_projects", description: "List every project (title, client, status, dates, paymentStatus).",  inputSchema: { type: "object", properties: {} } },
  { name: "get_project",   description: "Fetch one project with full data (steps, modules selection, etc.).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "create_project",description: "Create a new project. Common fields: title, client, clientId, status (draft|in-progress|completed|on-hold), kind (client|internal|personal — defaults to client), startDate, endDate, paymentStatus.",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_project",description: "Patch a project (title, status, kind (client|internal|personal), dates, client link, payment, notes, …).",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Project modules (selection of which modules are in a project's scope) ─
  { name: "get_project_modules", description: "Get the modules selection for a project (what's in scope + maintenance tier).",
    inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { name: "save_project_modules", description: "Replace the modules selection for a project. Pass {modules: SelectedModule[], maintenance: MaintenanceTier}.",
    inputSchema: { type: "object", properties: { project_id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["project_id", "data"] } },

  // ── Cadrage (project scoping doc) ──────────────────────────────
  { name: "get_cadrage", description: "Get the scoping document for a project (objectives, in/out scope, deliverables, milestones, constraints, validated budget).",
    inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { name: "save_cadrage", description: "Save (upsert) the scoping doc. Send only fields you want to change; others stay as-is.",
    inputSchema: { type: "object", properties: { project_id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["project_id", "data"] } },

  // ── Intake ─────────────────────────────────────────────────────
  { name: "list_intakes", description: "List all client intake form submissions (status: new|reviewed|converted).", inputSchema: { type: "object", properties: {} } },
  { name: "get_project_intake", description: "Fetch the intake submission(s) linked to a project — useful to draft briefs, modules, or quotes from the original responses.",
    inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { name: "update_intake", description: "Patch an intake response (status, projectId link, suggestedTier).",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Quotes / Invoices ─────────────────────────────────────────
  { name: "list_quotes", description: "List all quotes / invoices (number, client, total, validity, payment + invoice statuses).", inputSchema: { type: "object", properties: {} } },
  { name: "list_project_quotes", description: "List quotes attached to one project.", inputSchema: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] } },
  { name: "get_quote", description: "Fetch one quote/invoice by id with full line items.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "create_quote", description: "Create a new quote/invoice. Pass id, projectId, client, items[], discount, taxRate, validityDate, etc.",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_quote", description: "Patch a quote (items, statuses, dates, etc.).",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Documents (admin) ──────────────────────────────────────────
  { name: "list_admin_docs", description: "List PDFs and other docs in the admin library (id, title, category, folderId, year, filename, fileSize).", inputSchema: { type: "object", properties: {} } },
  { name: "update_admin_doc", description: "Patch a doc: title, category, folderId (move between folders), year, sortOrder.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },
  { name: "delete_admin_doc", description: "Permanently delete a doc. Confirm with the user — no undo.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_admin_folders", description: "List doc folders (with parentId for nesting and shareToken for public sharing).", inputSchema: { type: "object", properties: {} } },
  { name: "create_admin_folder", description: "Create a new folder. Optionally set parentId for nesting.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, parentId: { type: ["string", "null"] } }, required: ["name"] } },
  { name: "update_admin_folder", description: "Patch a folder (name, parentId, sortOrder, summary, links).",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Documents (personal) ──────────────────────────────────────
  { name: "list_personal_docs", description: "List personal-scope docs.", inputSchema: { type: "object", properties: {} } },
  { name: "update_personal_doc", description: "Patch title or category on a personal doc.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Expenses ───────────────────────────────────────────────────
  { name: "list_expenses", description: "List one-off business expenses, optionally filtered by year.",
    inputSchema: { type: "object", properties: { year: { type: "number" } } } },
  { name: "create_expense", description: "Log a new expense. Required: date (YYYY-MM-DD), amount, description, category. Optional: notes.",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_expense", description: "Patch an expense.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Personal recurring costs (subscriptions, rent, etc.) ──────
  { name: "list_personal_costs", description: "List recurring personal costs (subscriptions, rent, insurance) with frequency and lastPaid.", inputSchema: { type: "object", properties: {} } },
  { name: "create_personal_cost", description: "Create a recurring cost. Required: name, amount, frequency (one of CostFrequency). Optional: category, lastPaid (YYYY-MM-DD).",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_personal_cost", description: "Patch a recurring cost.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },

  // ── Trésorerie : comptes (perso + entreprise, snapshot manuel) ─
  { name: "list_accounts", description: "List bank/cash accounts (perso + entreprise) with current balance, currency, institution. Used to surface 'combien j'ai sur mes comptes'.",
    inputSchema: { type: "object", properties: {
      includeArchived: { type: "boolean", description: "Include archived accounts. Defaults to false." },
      type:            { type: "string", enum: ["perso", "entreprise"], description: "Filter by account type." },
    } } },
  { name: "create_account", description: "Create a new account. Required: name. Optional: type (perso|entreprise, default perso), institution, currency (default CHF), balance, sortOrder, notes.",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_account", description: "Patch an account. Updating 'balance' auto-stamps balanceUpdatedAt. Use this for snapshot updates from bank statements.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },
  { name: "delete_account", description: "Delete an account. Detaches account_id from any linked expenses, costs and payables (no cascade delete).",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },

  // ── Trésorerie : payables (à payer) ────────────────────────────
  { name: "list_payables", description: "List payables (à payer). Optional filters by status (pending|scheduled|paid|cancelled) and accountId. Sorted by due date.",
    inputSchema: { type: "object", properties: {
      status:    { type: "string", enum: ["pending","scheduled","paid","cancelled"] },
      accountId: { type: "string" },
    } } },
  { name: "create_payable", description: "Create a new payable. Required: label, amount. Optional: dueDate (YYYY-MM-DD), accountId, status (default pending), category, notes, recurrence (none|weekly|monthly|quarterly|yearly), recurrenceDay (1-31), recurrenceEnd.",
    inputSchema: { type: "object", properties: { data: { type: "object", additionalProperties: true } }, required: ["data"] } },
  { name: "update_payable", description: "Patch a payable. Setting status='paid' stamps paidAt and, if recurrence != none, auto-spawns the next instance with the next due date (returned in response under spawned).",
    inputSchema: { type: "object", properties: { id: { type: "string" }, data: { type: "object", additionalProperties: true } }, required: ["id", "data"] } },
  { name: "delete_payable", description: "Delete a payable. Does not affect any account balance — payables are obligations, not transactions.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },

  // ── Phase 2 automations ────────────────────────────────────────
  {
    name: "classify_pdf",
    description:
      "Fetch metadata and extracted text from an admin PDF document so you can classify it. Read the returned extractedText + filename, then suggest a title/category/tags and call update_admin_doc to save your classification. No paid API needed — you do the classification.",
    inputSchema: {
      type: "object",
      properties: {
        doc_id: { type: "string", description: "UUID of the admin_doc to fetch." },
      },
      required: ["doc_id"],
    },
  },
  {
    name: "generate_brief_from_intake",
    description:
      "Fetch structured intake form data for a client submission so you can draft a project brief. Read the returned responses, write the brief in markdown, then call create_note to save it (use linkedObjective.id + linkedObjective.source if present). No paid API needed — you generate the brief.",
    inputSchema: {
      type: "object",
      properties: {
        intake_id: { type: "string", description: "UUID of the intake_response to fetch." },
      },
      required: ["intake_id"],
    },
  },
  {
    name: "suggest_quote_lines",
    description:
      "Fetch aggregated focus-session data for a project (hours per objective). Read the breakdown, propose invoice line items at 100 CHF/h rounded to 0.5h, then call create_quote if the user approves. No paid API needed — you generate the suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the project to analyze." },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_inbox_captures",
    description:
      "List quick captures from the server-authoritative inbox. The user drops loose ideas/todos here via the Kojima Solutions web UI, the mobile PWA, or the /capture skill. /triage iterates over the pending ones and files them to the right destination via the other MCP tools.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "triaged", "all"], description: "Default 'pending'." },
        source: { type: "string", enum: ["admin", "personal"], description: "Default 'admin'." },
        limit:  { type: "number", description: "Max items to return (default 100, max 500)." },
      },
    },
  },
  {
    name: "add_inbox_capture",
    description:
      "Add a quick capture to the inbox. Use this when the user dictates a loose thought during a conversation and asks you to 'capture' or 'note' it. The capture is server-authoritative — it appears immediately in the web UI and in the next /triage run.",
    inputSchema: {
      type: "object",
      properties: {
        text:         { type: "string", description: "Free-text content (max 2000 chars)." },
        project_hint: { type: "string", description: "Optional project slug or name to bias future triage (free-form tag)." },
        source:       { type: "string", enum: ["admin", "personal"], description: "Default 'admin'." },
      },
      required: ["text"],
    },
  },
  {
    name: "mark_capture_triaged",
    description:
      "Mark an inbox capture as triaged once /triage has filed it. The `destination` is a short free-form audit label like 'subtask:PASC 2026 / Email send 16 mai' or 'note:Kaleido'. Keeps the captures table tidy without losing history.",
    inputSchema: {
      type: "object",
      properties: {
        id:          { type: "string", description: "Capture UUID." },
        destination: { type: "string", description: "Short audit label of where it was filed." },
      },
      required: ["id", "destination"],
    },
  },
  {
    name: "delete_inbox_capture",
    description:
      "Hard-delete a capture. Prefer mark_capture_triaged for normal flow; this is for spam, duplicates, or user-explicit 'forget it'.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────

export async function dispatch(name: string, args: Record<string, any>): Promise<unknown> {
  switch (name) {
    case "list_objectives": {
      const source = (args.source ?? "both") as "admin" | "personal" | "both";
      const includeCompleted = args.include_completed === true;
      const onlyObjectives   = args.only_objectives !== false;
      const out: Array<ObjectiveSummary & { source: ObjectiveSource }> = [];
      if (source === "admin" || source === "both") {
        const items = await listAdminObjectives();
        for (const o of items) out.push({ ...o, source: "admin" });
      }
      if (source === "personal" || source === "both") {
        const items = await listPersonalObjectives();
        for (const o of items) out.push({ ...o, source: "personal" });
      }
      return out.filter(o =>
        (includeCompleted || !o.completed) &&
        (!onlyObjectives  || o.isObjective)
      );
    }

    case "create_objective": {
      const { source, ...data } = args;
      // The PHP backend defaults is_objective=0; the MCP tool is named create_objective
      // and its description says "Create a new top-level objective", so always promote.
      const payload = { ...data, isObjective: true };
      return source === "admin"
        ? await createAdminObjective(payload)
        : await createPersonalObjective(payload);
    }

    case "get_objective": {
      const source = args.source as ObjectiveSource;
      const id     = args.id     as string;
      const list = source === "admin" ? await listAdminObjectives() : await listPersonalObjectives();
      const obj  = list.find(o => o.id === id);
      if (!obj) throw new Error(`Objective ${source}/${id} not found.`);
      const subs = await listSubtasks(id, source);
      return { objective: { ...obj, source }, subtasks: subs };
    }

    case "create_subtask": {
      return await createSubtask({
        source:            args.source,
        parentId:          args.objective_id,
        parentSubtaskId:   args.parent_subtask_id ?? null,
        text:              args.text,
        dueDate:           args.due_date,
        effortSize:        args.effort_size,
        estimatedMinutes:  args.estimated_minutes,
        flaggedToday:      args.flagged_today,
        priority:          args.priority,
      });
    }

    case "update_subtask": {
      const { id, ...rest } = args;
      const patch: Partial<SubtaskItem> = {};
      if ("text"              in rest) patch.text             = rest.text;
      if ("completed"         in rest) patch.completed        = rest.completed;
      if ("flagged_today"     in rest) patch.flaggedToday     = rest.flagged_today;
      if ("effort_size"       in rest) patch.effortSize       = rest.effort_size;
      if ("estimated_minutes" in rest) patch.estimatedMinutes = rest.estimated_minutes;
      if ("priority"          in rest) patch.priority         = rest.priority;
      if ("status"            in rest) patch.status           = rest.status;
      if ("due_date"          in rest) patch.dueDate          = rest.due_date;
      if ("recurrence"        in rest) patch.recurrence       = rest.recurrence || null;
      if ("recurrence_day"    in rest) patch.recurrenceDay    = rest.recurrence_day === null || rest.recurrence_day === "" ? null : Number(rest.recurrence_day);
      if ("scheduled_for"     in rest) patch.scheduledFor     = rest.scheduled_for || null;
      return await updateSubtask(id, patch);
    }

    case "update_objective": {
      const { source, id, ...rest } = args;
      return source === "admin"
        ? await updateAdminObjective(id, rest)
        : await updatePersonalObjective(id, rest);
    }

    case "start_focus": {
      return await startSession({
        source:      args.source,
        objectiveId: args.objective_id,
        subtaskId:   args.subtask_id ?? null,
        subtaskIds:  Array.isArray(args.subtask_ids) ? args.subtask_ids : undefined,
      });
    }

    case "attribute_focus_subtasks": {
      const ids = Array.isArray(args.subtask_ids) ? args.subtask_ids : [];
      return await attributeSessionSubtasks(args.session_id, ids);
    }

    case "stop_focus": {
      let sessionId = args.session_id as string | undefined;
      if (!sessionId) {
        if (!args.source || !args.objective_id) {
          throw new Error("Either session_id, or both source + objective_id, must be provided.");
        }
        const sessions = await listSessions(args.source, args.objective_id);
        const open = sessions.find(s => !s.endedAt);
        if (!open) throw new Error(`No open session found on ${args.source}/${args.objective_id}.`);
        sessionId = open.id;
      }
      const stopped = await stopSession(sessionId, args.note);
      if (args.accuracy || args.note) {
        // Retro patch (accuracy is a separate column from note)
        await patchSession(sessionId, {
          accuracy: args.accuracy,
          note:     args.note ?? null,
        }).catch(() => {});
      }
      return stopped;
    }

    case "get_week_stats":
      return await getGlobalWeekSummary();

    case "list_notes":
      return await listNotes(args.source, args.objective_id);

    case "create_note":
      return await createNote({
        source:      args.source,
        objectiveId: args.objective_id,
        title:       args.title,
        content:     args.content,
        pinned:      args.pinned,
      });

    case "update_note": {
      const { id, ...rest } = args;
      const patch: Record<string, unknown> = {};
      if ("title"   in rest) patch.title   = rest.title;
      if ("content" in rest) patch.content = rest.content;
      if ("pinned"  in rest) patch.pinned  = rest.pinned;
      return await updateNote(id, patch as any);
    }

    case "delete_note":
      await deleteNote(args.id);
      return { ok: true };

    case "list_decisions":
      return await listDecisions(args.source, args.objective_id);

    case "create_decision":
      return await createDecision({
        source:      args.source,
        objectiveId: args.objective_id,
        title:       args.title,
        rationale:   args.rationale,
        decidedAt:   args.decided_at,
      });

    case "update_decision": {
      const { id, ...rest } = args;
      const patch: Record<string, unknown> = {};
      if ("title"     in rest) patch.title     = rest.title;
      if ("rationale" in rest) patch.rationale = rest.rationale;
      if ("decidedAt" in rest) patch.decidedAt = rest.decidedAt;
      return await updateDecision(id, patch as any);
    }

    case "list_activity":
      return await listActivity(args.source, args.objective_id, args.limit);

    // ── Clients ─────────────────────────────────────────────────
    case "list_clients":   return await listClients();
    case "get_client":     return await getClient(args.id);
    case "create_client":  return await createClient(args.data);
    case "update_client":  return await updateClient(args.id, args.data);

    // ── Projects ────────────────────────────────────────────────
    case "list_projects":  return await listProjects();
    case "get_project":    return await getProject(args.id);
    case "create_project": return await createProject(args.data);
    case "update_project": return await updateProject(args.id, args.data);

    case "get_project_modules":  return await getProjectModules(args.project_id);
    case "save_project_modules": return await saveProjectModules(args.project_id, args.data);

    case "get_cadrage":  return await getCadrage(args.project_id);
    case "save_cadrage": return await saveCadrage(args.project_id, args.data);

    case "list_intakes":        return await listIntakes();
    case "get_project_intake":  return await getIntakeByProject(args.project_id);
    case "update_intake":       return await updateIntake(args.id, args.data);

    // ── Quotes / Invoices ───────────────────────────────────────
    case "list_quotes":         return await listQuotes();
    case "list_project_quotes": return await listProjectQuotes(args.project_id);
    case "get_quote":           return await getQuote(args.id);
    case "create_quote":        return await createQuote(args.data);
    case "update_quote":        return await updateQuote(args.id, args.data);

    // ── Documents ───────────────────────────────────────────────
    case "list_admin_docs":     return await listAdminDocs();
    case "update_admin_doc":    return await updateAdminDoc(args.id, args.data);
    case "delete_admin_doc":    await deleteAdminDoc(args.id); return { ok: true };
    case "list_admin_folders":  return await listAdminFolders();
    case "create_admin_folder": return await createAdminFolder({ name: args.name, parentId: args.parentId ?? null });
    case "update_admin_folder": return await updateAdminFolder(args.id, args.data);

    case "list_personal_docs":  return await listPersonalDocs();
    case "update_personal_doc": return await updatePersonalDoc(args.id, args.data);

    // ── Expenses + recurring costs ─────────────────────────────
    case "list_expenses":  return await listExpenses(args.year);
    case "create_expense": return await createExpense(args.data);
    case "update_expense": return await updateExpense(args.id, args.data);

    case "list_personal_costs":  return await listPersonalCosts();
    case "create_personal_cost": return await createPersonalCost(args.data);
    case "update_personal_cost": return await updatePersonalCost(args.id, args.data);

    // ── Trésorerie : comptes + payables ────────────────────────
    case "list_accounts":   return await listAccounts({ includeArchived: args.includeArchived, type: args.type });
    case "create_account":  return await createAccount(args.data);
    case "update_account":  return await updateAccount(args.id, args.data);
    case "delete_account":  return await deleteAccount(args.id);

    case "list_payables":   return await listPayables({ status: args.status, accountId: args.accountId });
    case "create_payable":  return await createPayable(args.data);
    case "update_payable":  return await updatePayable(args.id, args.data);
    case "delete_payable":  return await deletePayable(args.id);

    // ── Phase 2 automations ─────────────────────────────────────
    case "classify_pdf":
      return await classifyPdf(args.doc_id);

    case "generate_brief_from_intake":
      return await generateBriefFromIntake(args.intake_id);

    case "suggest_quote_lines":
      return await suggestQuoteLines(args.project_id);

    // ── Inbox captures (DB-backed quick capture, /triage source) ────
    case "list_inbox_captures":
      return await listInboxCaptures({
        status: args.status ?? "pending",
        source: args.source ?? "admin",
        limit:  args.limit,
      });

    case "add_inbox_capture":
      return await addInboxCapture({
        text:        args.text,
        projectHint: args.project_hint,
        source:      args.source ?? "admin",
      });

    case "mark_capture_triaged":
      return await markCaptureTriaged(args.id, args.destination);

    case "delete_inbox_capture":
      return await deleteInboxCapture(args.id);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
