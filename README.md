# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Objective Workspace & Sprint

A focus-centric system for working on one objective at a time, with cross-objective visibility when you need the bird's-eye view.

### Two entry points
- `/sprint` — cross-objective Sprint dashboard
- `/objective/:source/:id` — per-objective workspace

### The Sprint page (`/sprint`)
- Current focus banner with running timer when a session is live
- Cross-objective sprint backlog — every flagged subtask across every active objective, grouped with breadcrumb and effort chip
- Global weekly focus stats — total time, 7-day sparkline, top-focused objectives
- Active-objective cards sorted by flag → priority → status

### The Objective Workspace (`/objective/:source/:id`)
- Inline-editable header (title, status, priority, due date, category, progress)
- FocusStrip — DOING NOW with breadcrumb, multi-flag sprint backlog pills, animated gradient ring while timing, retro prompt on stop
- NextUpQueue — 2-level tree (subtasks + sub-subtasks), drag to reorder, "Décomposer" quick-breakdown shortcut, effort chips (Rapide / Moyen / Complexe), time estimates + actuals with over/under bar
- SMART + Definition of Done panel, Linked project / client
- Templates — save the current subtask tree as a reusable template, apply to any objective
- Tabs: Notes (markdown), Files (images / PDF / DOCX / XLSX / text, 25 MB cap), Links (favicon), Decisions (timestamped log), Activity (auto-emitted events + week summary)

### Keyboard shortcuts (workspace)
- `F` — start / stop focus
- `N` — jump to next-up input
- `Enter` — add + keep focus for chain entry
- `?` — toggle shortcut overlay
- `Esc` — close overlay / dialogs

### Architecture notes
- URL `source` is `admin` | `personal` (matches the `todo_subtasks.source` enum). v1 routes Personal-page objectives through `admin` since `Personal.tsx` currently stores into `admin_todos`.
- Focus timer resilience: localStorage (instant render on reload) + server (source of truth + weekly stats) + `sendBeacon` on `beforeunload` + server-side auto-close for sessions > 8h.
- Sprint backlog is any subtask with `flagged_today=1` (no single-flag constraint — the backlog can hold many).
- New tables, all auto-migrated on first endpoint hit: `objective_notes`, `objective_files`, `objective_links`, `objective_sessions`, `objective_activity`, `objective_decisions`, `objective_templates`, `objective_template_items`. `todo_subtasks` gained `parent_subtask_id`, `effort_size`, `estimated_minutes`. Both `admin_todos` and `personal_todos` gained `definition_of_done`, `linked_project_id`, `linked_client_id`.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
