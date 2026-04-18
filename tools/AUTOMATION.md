# Kojima Automation Surface

How AI + automation are wired into kojima-solutions today, and how to extend
them. Two surfaces are live; three more are sketched.

```
┌──────────────────────────┐
│  Browser / web SPA       │ ← user-facing, manual interactions
└────────────┬─────────────┘
             │ HTTP + X-API-Key
             ▼
┌──────────────────────────┐
│  PHP API + MariaDB       │ ← single source of truth
└────────────┬─────────────┘
             │ HTTP + X-API-Key
             ▼
┌──────────────────────────┐
│  kojima MCP server       │ ← stdio, local, free with Max sub
│  tools/mcp-server/       │
└────────────┬─────────────┘
             │ MCP stdio (JSON-RPC)
             ▼
┌──────────────────────────┐
│  Claude Code (your sub)  │ ← interactive at-desk work
└────────────┬─────────────┘
             │ SessionStart hook
             ▼
┌──────────────────────────┐
│  morning-briefing.sh     │ ← time-gated context injection
│  tools/scripts/          │
└──────────────────────────┘
```

The PHP API is the **only** source of truth. Every other surface is a client.

---

## What's live (Phase 1)

### A. The MCP server — `tools/mcp-server/`

A local Node stdio server that exposes the kojima workspace as MCP tools so
Claude Code can read and write it using your Max subscription instead of
paid API calls.

**Tool surface today (~50 tools, 11 domains):**

| Domain | Tools | What Claude can do |
|---|---|---|
| Objectives | `list_objectives`, `get_objective`, `update_objective` | Read full state, patch SMART/status/links |
| Subtasks | `create_subtask`, `update_subtask` | Add steps, mark done, flag for today, set effort |
| Focus sessions | `start_focus`, `stop_focus` | Time-track work, log accuracy retro |
| Notes | `list_notes`, `create_note`, `update_note`, `delete_note` | Capture insights mid-session |
| Decisions | `list_decisions`, `create_decision`, `update_decision` | Log scope cuts / direction changes with rationale |
| Activity | `list_activity` | Read auto-emitted timeline for retros |
| Week stats | `get_week_stats` | Time-per-objective + by-day bars |
| Clients | `list_clients`, `get_client`, `create_client`, `update_client` | CRM ops |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project` | Project CRUD + cadrage + modules + intake |
| Quotes | `list_quotes`, `list_project_quotes`, `get_quote`, `create_quote`, `update_quote` | Invoicing |
| Documents | `list_admin_docs`, `update_admin_doc`, `delete_admin_doc`, `list_admin_folders`, `create_admin_folder`, `update_admin_folder`, `list_personal_docs`, `update_personal_doc` | PDF management |
| Expenses + recurring costs | `list_expenses`, `create_expense`, `update_expense`, `list_personal_costs`, `create_personal_cost`, `update_personal_cost` | Bookkeeping |

Setup, rotation, troubleshooting → `tools/mcp-server/README.md`.

### B. The SessionStart hook — `tools/scripts/morning-briefing.sh`

A bash script registered via `.claude/settings.json` that fires every time
Claude Code starts a session in this project. It checks the date/time and a
per-day marker file, then conditionally emits a context-injection JSON
asking Claude to brief the user via the MCP tools above.

Two independent gates today:

- **Daily morning briefing** — first weekday session ≥ 07:00 local.
  Monday adds an overdue-invoice nudge.
- **Friday afternoon retro** — first session on Friday ≥ 16:00 local.
  Asks Claude to write a markdown note via `create_note` summarizing the
  week and log decisions if a pivot is detected.

Markers live at `~/.kojima/{daily|retro}-YYYY-MM-DD.done`. Removing a marker
re-arms that gate for the day.

Manual test (bypasses gates, uses temp marker dir):
```sh
KOJIMA_BRIEFING_FORCE=1 bash tools/scripts/morning-briefing.sh
```

---

## How to extend

### Adding an MCP tool

1. Identify the PHP endpoint you want to expose. Read its handler in
   `public/api/<name>.php` to confirm the request/response shape.
2. Add a typed wrapper in `tools/mcp-server/src/api.ts` — copy the pattern
   from any existing call (e.g. `listClients`).
3. Add the tool definition to `TOOLS` in `tools/mcp-server/src/tools.ts`.
   Be specific in the description — Claude picks tools by reading them.
   Use `additionalProperties: true` on write payloads when the underlying
   PHP accepts many optional fields (PHP validates).
4. Add the dispatch case in the same file.
5. `cd tools/mcp-server && npm run build`.
6. Restart Claude Code (MCP servers don't hot-reload).
7. Verify in a fresh session: ask Claude to use the new tool.

### Adding a SessionStart trigger

Edit `tools/scripts/morning-briefing.sh`. Pattern is:

```bash
SOMETHING_MARKER="${MARKER_DIR}/something-${TODAY}.done"

if [[ <your time/day condition> && ! -f "$SOMETHING_MARKER" ]]; then
  PARTS+=($'Your French prompt here. Use list_xxx to ...')
  touch "$SOMETHING_MARKER"
fi
```

The script joins `PARTS[@]` with blank lines and emits one JSON, so multiple
triggers fire cleanly in the same session.

### Adding a different kind of hook

`SessionStart` is one of many events. See the project schema for the full
list (PreToolUse, PostToolUse, PreCompact, PostCompact, Stop, etc.). Same
JSON shape applies. Examples worth considering:

- **PreCompact** → ask Claude to ensure work-in-progress notes are saved via
  `create_note` before context is compressed.
- **Stop** → on session end, auto-stop any open focus session that wasn't
  stopped manually.
- **PostToolUse on Edit** → if a file under `src/api/` is edited, remind
  Claude to update the matching MCP tool wrapper in `tools/mcp-server/`.

---

## Phase 2 — Backend automations (future, paid API)

For workflows that need to run **without you sitting at the desk** (or
without Claude Code open), the MCP server can't help — it's stdio and
process-bound. The right tool is server-side automation that calls the
Anthropic API directly when an event happens.

Candidates:

| Trigger | Action | Approx cost |
|---|---|---|
| New PDF uploaded to admin docs | Vision API extracts text → suggests title + folder + tags | $0.01–0.05 / PDF |
| New intake form submitted | Generate a draft brief from the responses, save to `objective_notes` | $0.05 / intake |
| Quote acceptance webhook | Spawn an objective with the project's kickoff template, pre-filled SMART fields | $0.05 / accept |
| Receipt photo uploaded | OCR + categorize as expense | $0.01 / receipt |
| Time-tracked session ends with `accuracy=slower` | Suggest splitting the subtask | $0.01 / event |

Architecture: a tiny PHP file per automation under `public/api/auto/` that
talks to `https://api.anthropic.com/v1/messages` with `ANTHROPIC_API_KEY`
from `config.php`. Per-feature opt-in toggle in Settings. Per-feature monthly
budget cap to bound surprise bills.

---

## Phase 3 — Scheduled "Kojima Assistant" runs (future)

Recurring work that needs to fire at a specific time even when you're away:

| Schedule | Job | Surface |
|---|---|---|
| Mon-Fri 08:00 | Pre-emptive overnight digest if anything broke | Email to massaki@ |
| Weekly Sunday 18:00 | Review next week's deadlines + propose flagged subtasks | Email + auto-flag |
| Monthly 1st 09:00 | Revenue + expense recap, identify cost spikes | Email |
| Daily 23:00 | Force-stop any focus session > 8h (already in DB layer; this just confirms) | Log |

Two implementation paths, both viable for solo use:

**3a. Anthropic scheduled remote agents** (`/schedule` skill in Claude Code).
Runs in Anthropic cloud. Cron expression. Limitation: cannot reach the local
MCP — must `curl` the PHP API with `API_SECRET` embedded in the trigger
config. Likely covered by Max quota; verify limits before relying on it.

**3b. Local cron + `claude --print`.** Windows Task Scheduler runs:
```sh
claude --print --mcp-config %USERPROFILE%/.claude.json \
  "Run the Sunday review for kojima: list_objectives, get_week_stats, then…"
```
Free with Max. Has full MCP access. Requires the machine to be on at fire
time. Output goes to stdout — pipe to a log file or email.

---

## Phase 4 — Embedded Claude in the client portal (future)

The current `/client/:id` portal is read-only deliveries. Future state: a
chat interface that lets the client ask questions about THEIR project,
backed by the Anthropic API server-side and a scoped MCP server that only
exposes data for one client's project.

This is real product work, not a config change:

- Per-client API budget (so a chatty client doesn't run up your bill)
- Per-client MCP scoping (the tool layer must enforce `client_id` filters)
- UI surface (drawer? full chat tab? embed in the proposal page?)
- Audit log of every Claude write (clients can see what the AI did)

Worth scoping when client demand emerges, not before.

---

## File map

```
public/api/
  *.php                       — REST endpoints, source of truth for shape
  config.example.php          — documents required constants
  config.php                  — gitignored, holds API_SECRET + DB creds

tools/
  AUTOMATION.md               — this file
  mcp-server/                 — local MCP server (Phase 1A)
    README.md                 — setup, rotation, troubleshooting
    src/
      index.ts                — server entry + transport
      api.ts                  — typed PHP HTTP client + .env loader
      tools.ts                — tool defs + dispatch
    .env                      — KOJIMA_API_KEY, KOJIMA_API_BASE (gitignored)
  scripts/
    morning-briefing.sh       — SessionStart hook (Phase 1B)

.claude/
  settings.json               — registers the SessionStart hook (committed)
  settings.local.json         — personal overrides (gitignored if present)
```

---

## What to read before extending

- `public/api/_bootstrap.php` — how `requireAuth` validates `X-API-Key`
- `tools/mcp-server/src/api.ts` — the proxy pattern (one function per
  endpoint, all calls through `call<T>(path, init)`)
- `tools/mcp-server/src/tools.ts` — the dispatch pattern (one switch case
  per tool, args passed through with minimal massaging)
- `tools/scripts/morning-briefing.sh` — the marker + gate + emit pattern
- `.claude/settings.json` — hook registration shape

The whole automation layer is small and self-similar. New surface = pick the
nearest analog, copy its pattern, change the names.
