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
  DOW=4   # Thursday: fires daily briefing + clients en attente
  HOUR=8
  MARKER_DIR="$(mktemp -d)"
fi
DAILY_MARKER="${MARKER_DIR}/daily-${TODAY}.done"
RETRO_MARKER="${MARKER_DIR}/retro-${TODAY}.done"
CLIENTS_MARKER="${MARKER_DIR}/clients-${TODAY}.done"

mkdir -p "$MARKER_DIR"

PARTS=()

# ── Notes laissées pour Claude ──────────────────────────────────────
# Capturées depuis le téléphone via la capture rapide (type « claude »). Pas de
# marqueur journalier : contrairement au brief, ceci doit remonter à CHAQUE
# session, sinon une note écrite l'après-midi attendrait le lendemain.
# On interroge l'API pour ne rien dire quand il n'y a rien — un rappel qui parle
# dans le vide finit par être ignoré. Hors ligne ou API muette : on se tait.
ENV_FILE="tools/mcp-server/.env"
if [[ -f "$ENV_FILE" ]]; then
  API_KEY="$(sed -n 's/^KOJIMA_API_KEY=//p' "$ENV_FILE" | tr -d '"\r' | head -1)"
  API_BASE="$(sed -n 's/^KOJIMA_API_BASE=//p' "$ENV_FILE" | tr -d '"\r' | head -1)"
  API_BASE="${API_BASE:-https://kojima-solutions.ch}"
  if [[ -n "$API_KEY" ]]; then
    CLAUDE_NOTES="$(curl -s -m 8 -H "X-API-Key: ${API_KEY}" \
      "${API_BASE}/api/inbox.php?status=pending&limit=100" 2>/dev/null \
      | node -e '
        let raw = "";
        process.stdin.on("data", (d) => { raw += d; }).on("end", () => {
          try {
            const payload = JSON.parse(raw);
            const items = Array.isArray(payload) ? payload : (payload.items || []);
            const mine = items.filter((c) => c && c.kind === "claude");
            if (!mine.length) return;
            process.stdout.write(mine.map((c) =>
              "- (" + c.id + ") " + String(c.text || "").replace(/\s+/g, " ").trim()
            ).join("\n"));
          } catch (e) { /* API indisponible : silence */ }
        });
      ' 2>/dev/null || true)"
    if [[ -n "$CLAUDE_NOTES" ]]; then
      PARTS+=("NOTES QUE L'UTILISATEUR T'A LAISSÉES DEPUIS SON TÉLÉPHONE"$'\n'"$CLAUDE_NOTES"$'\n\n'"Traite-les au début de cette session, avant le reste du brief. Quand une note est traitée, ferme-la avec l'outil MCP mark_capture_triaged en lui passant l'id indiqué entre parenthèses, pour qu'elle ne revienne pas la session suivante.")
    fi
  fi
fi

# ── Daily morning briefing ──────────────────────────────────────────
if [[ "$DOW" -le 5 && "$HOUR" -ge 7 && ! -f "$DAILY_MARKER" ]]; then
  # Le brief n'est pas décrit ici : il vit dans routines/brief-quotidien.md, que
  # les agents planifiés exécutent aussi. Un seul fichier, donc le brief du
  # bureau et celui de la routine ne peuvent pas diverger.
  DAILY=$'Bonjour. Lis routines/contexte.md puis applique routines/brief-quotidien.md, en MODE INTERACTIF : passe par les outils MCP kojima au lieu de curl, n\'envoie aucun push, et termine en me demandant si je veux ajouter, modifier ou retirer quelque chose du sprint du jour.'
  if [[ "$DOW" -eq 1 ]]; then
    DAILY+=$'\n\nBONUS LUNDI : enchaîne avec routines/point-argent.md, même mode interactif (pas de push, aucun envoi d\'email).'
  fi
  PARTS+=("$DAILY")
  touch "$DAILY_MARKER"
fi

# ── Inbox journal pending (any weekday) ────────────────────────────
# Count un-triaged entries in .kojima-journal/inbox.md so Claude can nudge
# about /triage. A pending entry: starts with "- [ ]" and is NOT wrapped in
# "~~...~~" (struck-through = already filed by /triage).
INBOX_PATH=".kojima-journal/inbox.md"
if [[ "$DOW" -le 5 && "$HOUR" -ge 7 && -f "$INBOX_PATH" ]]; then
  INBOX_PENDING=$(grep -E '^[[:space:]]*-[[:space:]]*\[[[:space:]]*\]' "$INBOX_PATH" | grep -vc '~~' || true)
  if [[ "$INBOX_PENDING" -gt 0 ]]; then
    PARTS+=("ADDENDUM JOURNAL : il y a $INBOX_PENDING capture(s) non triée(s) dans .kojima-journal/inbox.md. Mentionne-le au bout du brief et propose de lancer /triage si l'utilisateur le souhaite (ne le lance pas automatiquement).")
  fi
fi

# ── Clients en attente (lundi + jeudi) ─────────────────────────────
if [[ ( "$DOW" -eq 1 || "$DOW" -eq 4 ) && "$HOUR" -ge 7 && ! -f "$CLIENTS_MARKER" ]]; then
  PARTS+=($'RÉCAP CLIENTS EN ATTENTE : Appelle list_projects (projets actifs en attente d\'une action), list_intakes (demandes en statut "new" ou "reviewed" non converties), et list_quotes (devis en "draft" ou "to-validate"). Présente un récap en 3 sections :\n  1) Projets nécessitant une action client (status on-hold ou bloqué)\n  2) Intakes non traités (avec délai depuis création)\n  3) Devis en attente de signature (avec délai depuis création)\nPour chaque élément, indique le nombre de jours depuis le dernier mouvement.')
  touch "$CLIENTS_MARKER"
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
