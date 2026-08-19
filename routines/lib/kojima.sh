#!/usr/bin/env bash
# Helper d'accès à l'API Kojima pour les routines planifiées.
#
#   source routines/lib/kojima.sh
#   kj_check || exit 1
#   kj "todo_subtasks.php?source=admin" > subtasks.json
#
# La clé vient de $KOJIMA_API_KEY (secret de la routine) ou, quand on tourne sur
# la machine de Massaki, de tools/mcp-server/.env. Elle n'est jamais affichée.

kj_base() {
  local base="${KOJIMA_API_BASE:-https://kojima-solutions.ch}"
  printf '%s' "${base%/}"
}

kj_key() {
  if [ -n "${KOJIMA_API_KEY:-}" ]; then
    printf '%s' "$KOJIMA_API_KEY"
    return 0
  fi
  # Repli local : le .env du serveur MCP, à côté du dépôt. Gitignoré.
  local root env_file
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  env_file="$root/tools/mcp-server/.env"
  [ -f "$env_file" ] || return 1
  sed -n 's/^KOJIMA_API_KEY=//p' "$env_file" | tr -d '"\r' | head -1
}

# kj <chemin+query>  → corps de la réponse sur stdout, code HTTP sur stderr si erreur.
#
# Un chemin inconnu ne renvoie PAS 404 : le serveur sert l'index de la SPA en
# 200/text/html. Sans le garde-fou ci-dessous, une routine parserait du HTML
# comme du JSON et raconterait n'importe quoi avec aplomb.
kj() {
  local path="$1" key out meta code ctype
  key="$(kj_key)" || { echo "kojima: aucune clé API disponible" >&2; return 2; }
  out="$(mktemp)"
  meta="$(curl -sS -m 30 -o "$out" -w '%{http_code} %{content_type}' \
    -H "X-API-Key: $key" "$(kj_base)/api/$path")"
  code="${meta%% *}"
  ctype="${meta#* }"
  cat "$out"
  rm -f "$out"
  if [ "$code" -ge 400 ]; then
    echo "kojima: GET $path -> HTTP $code" >&2
    return 1
  fi
  case "$ctype" in
    *html*) echo "kojima: GET $path -> HTML au lieu de JSON (chemin inexistant ?)" >&2; return 1 ;;
  esac
}

# kj_post <chemin> <json>  → écriture authentifiée par la clé API.
# Réservé aux écritures que le fichier de la routine autorise explicitement
# (push_reminders.php, inbox.php). Voir donnees.md.
kj_post() {
  local path="$1" body="$2" key out code
  key="$(kj_key)" || { echo "kojima: aucune clé API disponible" >&2; return 2; }
  out="$(mktemp)"
  code="$(curl -sS -m 30 -o "$out" -w '%{http_code}' -X POST \
    -H "X-API-Key: $key" -H "Content-Type: application/json" \
    -d "$body" "$(kj_base)/api/$path")"
  cat "$out"
  rm -f "$out"
  if [ "$code" -ge 400 ]; then
    echo "kojima: POST $path -> HTTP $code" >&2
    return 1
  fi
}

# kj_recap <json>  → publication du récap hebdo, secret dédié (pas la clé API).
kj_recap() {
  local body="$1" out code
  [ -n "${RECAP_UPLOAD_SECRET:-}" ] || { echo "kojima: RECAP_UPLOAD_SECRET absent" >&2; return 2; }
  out="$(mktemp)"
  code="$(curl -sS -m 30 -o "$out" -w '%{http_code}' -X POST \
    -H "X-Recap-Upload-Key: $RECAP_UPLOAD_SECRET" -H "Content-Type: application/json" \
    -d "$body" "$(kj_base)/api/weekly_recap.php")"
  cat "$out"
  rm -f "$out"
  if [ "$code" -ge 400 ]; then
    echo "kojima: POST weekly_recap.php -> HTTP $code" >&2
    return 1
  fi
}

# kj_check  → préflight : la clé existe et l'API répond. À appeler en premier.
kj_check() {
  if ! kj_key >/dev/null 2>&1; then
    echo "Brief impossible : aucune clé API (KOJIMA_API_KEY absente)." >&2
    return 1
  fi
  local code
  code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' \
    -H "X-API-Key: $(kj_key)" "$(kj_base)/api/accounts.php")"
  if [ "$code" -ge 400 ]; then
    echo "Brief impossible : l'API a répondu HTTP $code." >&2
    return 1
  fi
  return 0
}
