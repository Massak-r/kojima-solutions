import {
  listAdminObjectives, listPersonalObjectives,
  updateAdminObjective, updatePersonalObjective,
  listSubtasks, createSubtask, updateSubtask,
  startSession, stopSession, patchSession, listSessions,
  getGlobalWeekSummary,
  listNotes, createNote, updateNote, deleteNote,
  listDecisions, createDecision, updateDecision,
  listActivity,
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
      "Patch one subtask. Use this to mark complete, flag for today, change effort size, or rename. Always pass only the fields you intend to change.",
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
      "Start a focus session on an objective (and optionally a specific subtask). Auto-closes any other open session on the same objective. Returns the new session record.",
    inputSchema: {
      type: "object",
      properties: {
        source:       { type: "string", enum: ["admin", "personal"] },
        objective_id: { type: "string" },
        subtask_id:   { type: "string", description: "Optional. The specific subtask being worked on." },
      },
      required: ["source", "objective_id"],
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
      });
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
