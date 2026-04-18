#!/usr/bin/env bash
# Project SessionStart hook for kojima-solutions.
# Emits an injected prompt asking Claude to brief the user via the kojima MCP
# server. Two independent components, each gated by its own per-day marker:
#
#   • Daily briefing — weekdays, first session ≥ 07:00 local
#   • Friday retro   — first session ≥ 16:00 local on Fridays
#
# Monday adds an invoice-nudge addendum to the daily briefing.
# Set KOJIMA_BRIEFING_FORCE=1 to bypass time/day gates and use a temp marker
# dir (useful for manual testing without polluting state).

set -euo pipefail

TODAY="$(date +%F)"
DOW="$(date +%u)"          # 1=Mon ... 7=Sun
HOUR=$((10#$(date +%H)))   # 0..23, leading-zero stripped

MARKER_DIR="${HOME}/.kojima"
if [[ "${KOJIMA_BRIEFING_FORCE:-0}" == "1" ]]; then
  DOW=2
  HOUR=8
  MARKER_DIR="$(mktemp -d)"
fi
DAILY_MARKER="${MARKER_DIR}/daily-${TODAY}.done"
RETRO_MARKER="${MARKER_DIR}/retro-${TODAY}.done"

mkdir -p "$MARKER_DIR"

PARTS=()

# ── Daily morning briefing ──────────────────────────────────────────
if [[ "$DOW" -le 5 && "$HOUR" -ge 7 && ! -f "$DAILY_MARKER" ]]; then
  DAILY=$'Bonjour. Voici ton brief du jour. Utilise les outils MCP kojima (list_objectives, get_week_stats, et les subtasks flaggées du jour via list_objectives + get_objective) pour me donner :\n  1) sur quoi me focaliser aujourd\'hui,\n  2) ce qui est à risque,\n  3) un fait surprenant si tu en vois un dans les stats.'
  if [[ "$DOW" -eq 1 ]]; then
    DAILY+=$'\n\nBONUS LUNDI : appelle aussi list_quotes, filtre celles en invoiceStatus "validated" avec validityDate dépassée. Groupe par client et propose une formulation de relance par client.'
  fi
  PARTS+=("$DAILY")
  touch "$DAILY_MARKER"
fi

# ── Friday afternoon retro ──────────────────────────────────────────
if [[ "$DOW" -eq 5 && "$HOUR" -ge 16 && ! -f "$RETRO_MARKER" ]]; then
  RETRO=$'BONUS RETRO (vendredi soir) : appelle get_week_stats sur la semaine entière. Liste ce qui a été terminé vs reporté. Écris une note markdown via create_note sur les 2 objectifs avec le plus de temps, résumant la semaine. Si tu détectes un pivot dans l\'activité, log-le via create_decision avec un titre et une rationale.'
  PARTS+=("$RETRO")
  touch "$RETRO_MARKER"
fi

# Nothing to inject? exit silently
if [[ "${#PARTS[@]}" -eq 0 ]]; then
  exit 0
fi

# Join parts with a blank line and emit the SessionStart context-injection JSON.
# Node is guaranteed present (MCP sidecar runs on it) — handles UTF-8 + escaping
# without depending on jq, which isn't always in Git-Bash PATH on Windows.
PROMPT=$(printf '%s\n\n' "${PARTS[@]}")
printf '%s' "$PROMPT" | node -e "
const ctx = require('fs').readFileSync(0, 'utf8');
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: ctx,
  },
}));
"
