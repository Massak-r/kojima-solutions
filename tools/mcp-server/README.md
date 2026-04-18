# Kojima MCP Server

Local Node.js MCP server that exposes Kojima Solutions' Objective Workspace
(objectives, subtasks, focus sessions, week stats) to MCP-aware AI clients.

**Purpose.** Lets you talk to your kojima-solutions data through Claude Code
(or Claude Desktop, or any future MCP client) using your existing
**Claude subscription** — no per-call Anthropic API charges.

**Scope.** Local stdio transport only (Phase 1). Remote HTTP+SSE transport
for client-portal use is Phase 2; embedded in-app Claude with API tokens
is Phase 3.

---

## Architecture

```
┌─────────────────┐  stdio JSON-RPC  ┌──────────────────┐  HTTP X-API-Key  ┌──────────────┐
│  Claude Code    │ ◄──────────────► │  kojima MCP      │ ◄──────────────► │  PHP backend │
│  (your sub)     │                  │  server (this)   │                  │  (prod)      │
└─────────────────┘                  └──────────────────┘                  └──────────────┘
                                       reads .env at startup
                                       proxies to public/api/
```

The MCP server **does no business logic** — it forwards every call to the
existing PHP endpoints, which still own validation, schema, and auth.
Schema changes on the PHP side propagate automatically; only tool *shapes*
need updating here when API contracts change.

---

## One-time setup

### 1. Build

```sh
cd tools/mcp-server
npm install
npm run build
```

### 2. Provide credentials

The server reads `tools/mcp-server/.env` at startup. Two variables:

```
KOJIMA_API_KEY=<same value as API_SECRET in public/api/config.php>
KOJIMA_API_BASE=https://kojima-solutions.ch
```

The `.env` file is gitignored. If the file already exists from a previous
key rotation, you don't need to touch it.

### 3. Register with Claude Code

```sh
claude mcp add kojima --scope user -- node "<absolute-path>/tools/mcp-server/dist/index.js"
```

On this machine the absolute path is:

```
C:/Users/chrai/Desktop/Kojima/Kojima Solutions website/zen-code-studio/tools/mcp-server/dist/index.js
```

`--scope user` makes it available in every Claude Code session, not just
this project directory.

### 4. Restart Claude Code

Close and reopen your Claude Code session so it picks up the new MCP server.

### 5. Verify

In any Claude Code session ask:

> *"List my active objectives via MCP."*

If the server is wired correctly, Claude calls `list_objectives` and
returns the workspace data. If you get a 403 or "API key empty" error,
check `tools/mcp-server/.env`.

---

## Available tools

| Tool | What it does |
|------|--------------|
| `list_objectives`  | List admin / personal objectives, optionally filtered by completion or `is_objective` flag. |
| `get_objective`    | Fetch one objective with its full subtask tree. Use before proposing changes so context is current. |
| `create_subtask`   | Add a subtask under an objective (with optional `parent_subtask_id` for nesting, `effort_size`, `estimated_minutes`, `flagged_today`). |
| `update_subtask`   | Patch one subtask: completion, today-flag, effort, status, rename, etc. |
| `update_objective` | Patch SMART criteria, status, priority, definition of done, linked project/client. |
| `start_focus`      | Start a focus session on an objective (and optionally a specific subtask). Auto-closes any open session on the same objective. |
| `stop_focus`       | Stop the most recent open session for an objective, optionally with `accuracy` (faster/on_target/slower) and `note` for the retro. |
| `get_week_stats`   | Global focus summary for the current ISO week — totalSec, sessionCount, byDay bars, top objectives. |

Tool input schemas are defined in `src/tools.ts`.

---

## Useful prompts to try

Once the server is registered, these all work conversationally:

- *"What am I working on today? Show flagged subtasks across all objectives."*
- *"Decompose the objective 'Launch Q2 campaign' into 5 sprint-ready
  subtasks with effort estimates."*
- *"Start a focus session on the design subtask of 'Onboard ACME'."*
- *"How did I spend my week? Top 3 objectives by time."*
- *"Mark the subtask I just finished as complete and pick the next flagged
  one for me."*

Claude will plan the tool calls, request your confirmation if a write is
destructive, and report back.

---

## Configuration reference

### `tools/mcp-server/.env`

| Variable           | Required | Default                          | Notes |
|--------------------|----------|----------------------------------|-------|
| `KOJIMA_API_KEY`   | Yes (if PHP has API_SECRET set) | empty | Same value as `API_SECRET` in `public/api/config.php`. Sent as `X-API-Key` header. |
| `KOJIMA_API_BASE`  | No       | `https://kojima-solutions.ch`    | Override to `http://localhost:8080` for local PHP dev. |

Loading order: real environment variables (e.g. via `claude mcp add --env`)
take precedence over `.env`. If you pass `--env KOJIMA_API_KEY=…`
explicitly, the `.env` value is ignored.

### Switching to local PHP for dev

```
KOJIMA_API_KEY=<your dev API_SECRET>
KOJIMA_API_BASE=http://localhost:8080
```

---

## Rotating `API_SECRET`

The MCP key, the SPA's `VITE_API_KEY`, and the server's `API_SECRET`
must all match. To rotate:

```sh
# Generate, write to all 3 places, never echo to stdout
NEW=$(openssl rand -hex 32)
sed -i "s|^VITE_API_KEY=.*|VITE_API_KEY=$NEW|" .env
printf 'KOJIMA_API_KEY=%s\nKOJIMA_API_BASE=https://kojima-solutions.ch\n' "$NEW" > tools/mcp-server/.env
ssh lhwd_automated@lhwd.ftp.infomaniak.com \
  "sed -i \"s#API_SECRET', '[^']*'#API_SECRET', '$NEW'#\" \
   /home/clients/ba8c9a93b5cde03c1f26b6ea1c83c339/sites/kojima-solutions.ch/api/config.php"
unset NEW
```

After rotation:

1. Run `bash deploy.sh` to push the new `VITE_API_KEY` into the SPA bundle
   (otherwise the live web app gets 403s).
2. Restart Claude Code (the MCP server picks up `.env` on next launch).

To verify all three locations match without exposing the key, hash and
compare prefixes:

```sh
local=$(grep ^VITE_API_KEY= .env | cut -d= -f2 | sha256sum | cut -c1-12)
mcp=$(grep ^KOJIMA_API_KEY= tools/mcp-server/.env | cut -d= -f2 | sha256sum | cut -c1-12)
remote=$(ssh lhwd_automated@lhwd.ftp.infomaniak.com \
  "grep API_SECRET /home/clients/ba8c9a93b5cde03c1f26b6ea1c83c339/sites/kojima-solutions.ch/api/config.php \
   | sed \"s/.*'\([^']*\)'.*/\1/\" | sha256sum | cut -c1-12")
echo "local=$local mcp=$mcp remote=$remote"
[ "$local" = "$mcp" ] && [ "$local" = "$remote" ] && echo OK
```

---

## Troubleshooting

**`[kojima-mcp] WARNING: KOJIMA_API_KEY env is empty`** on startup.
Either you haven't created `tools/mcp-server/.env` yet, or `KOJIMA_API_KEY`
isn't in it. Add the line and restart Claude Code.

**Tool calls return `HTTP 403: Unauthorized`.**
The key in `tools/mcp-server/.env` doesn't match `API_SECRET` on the
server. Use the verification snippet above.

**Tool calls return `HTTP 503: Database not configured`.**
The server's `public/api/config.php` is missing or the DB constants
inside it are wrong. Unrelated to the MCP server itself.

**Claude doesn't see the MCP tools.**
Run `claude mcp list` to confirm `kojima` is registered. Restart Claude
Code if you just added it.

**Schema changed on the PHP side, MCP returns stale shape.**
Update the corresponding tool in `src/tools.ts` (input schema and/or
dispatch handler) and rerun `npm run build`. Restart Claude Code.

---

## Future phases (not in this build)

- **Phase 2 — HTTP+SSE transport.** Same tool surface, exposed publicly
  with per-token auth so client-portal users can connect their own Claude
  client. Adds rate limiting + per-token scope to specific objective IDs.
- **Phase 3 — Embedded Claude in client portal.** Browser chat UI that
  hits the Anthropic API server-side and uses this MCP server as the tool
  layer, scoped to one client's data. Paid API model, billed back to the
  client.
