#!/usr/bin/env bash
# Script de démarrage de l'environnement cloud des routines Kojima.
#
# À coller dans le champ « script de configuration » de l'environnement. Le
# dépôt n'est pas forcément monté, ni monté là où on croit, au moment où ce
# champ s'exécute — d'où la forme qui marche dans les deux cas :
#
#   if [ -f routines/lib/setup.sh ]; then bash routines/lib/setup.sh; else curl -fsSL https://raw.githubusercontent.com/Massak-r/kojima-solutions/main/routines/lib/setup.sh | bash; fi
#
# Son seul travail : échouer bruyamment maintenant plutôt que discrètement dans
# vingt minutes. Une routine qui démarre avec une clé absente produit un brief
# vide et personne ne sait pourquoi.
#
# Ce qui bloque la session, en revanche, se limite à ce que seul l'humain peut
# corriger : une variable manquante. Une API qui tousse à cet instant précis
# n'est pas une raison d'interdire la session — la routine a son propre
# préflight, et bloquer sur un aléa réseau rendrait l'environnement instable
# pour une raison qui n'a rien à voir avec sa configuration.

set -u

echo "── Environnement routines Kojima ──"
echo "· répertoire de travail : $(pwd)"

fail=0

# 1. La clé API. Sans elle rien n'est lisible, autant le dire tout de suite.
if [ -z "${KOJIMA_API_KEY:-}" ]; then
  echo "✗ KOJIMA_API_KEY absente. Ajoute-la aux variables d'environnement."
  fail=1
else
  echo "✓ KOJIMA_API_KEY présente (${#KOJIMA_API_KEY} caractères)"
fi

# 2. La base. Défaut raisonnable, mais on l'affiche pour éviter de briefer sur
#    un environnement de test en croyant lire la prod.
base="${KOJIMA_API_BASE:-https://kojima-solutions.ch}"
echo "✓ base API : $base"

# 3. Le fuseau. Le conteneur tourne en UTC par défaut ; le domaine, lui, est en
#    heure suisse. Sans ça, « aujourd'hui » bascule deux heures trop tôt et une
#    semaine ISO peut être calculée un jour à côté — exactement le genre d'écart
#    qui fait publier un récap dans une case que personne n'ouvre.
if [ "${TZ:-}" != "Europe/Zurich" ]; then
  echo "! TZ vaut « ${TZ:-non défini} » — ajoute TZ=Europe/Zurich aux variables."
else
  echo "✓ TZ = Europe/Zurich"
fi
echo "  date locale vue par l'environnement : $(date '+%Y-%m-%d %H:%M %Z')"

# 4. Le secret du récap, facultatif : seule la routine dominicale s'en sert.
if [ -n "${RECAP_UPLOAD_SECRET:-}" ]; then
  echo "✓ RECAP_UPLOAD_SECRET présent"
else
  echo "· RECAP_UPLOAD_SECRET absent (normal, sauf pour recap-hebdo.md)"
fi

# 5. L'API répond-elle vraiment ? Une clé présente mais périmée se voit ici, pas
#    au milieu d'un brief.
if [ -n "${KOJIMA_API_KEY:-}" ]; then
  code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' \
    -H "X-API-Key: ${KOJIMA_API_KEY}" "${base%/}/api/accounts.php" || echo "000")"
  if [ "$code" = "200" ]; then
    echo "✓ API joignable et clé acceptée (HTTP 200)"
  elif [ "$code" = "403" ] || [ "$code" = "401" ]; then
    echo "✗ l'API refuse la clé (HTTP $code) — KOJIMA_API_KEY ne correspond plus à API_SECRET."
    fail=1
  else
    echo "! l'API a répondu HTTP $code sur accounts.php — réseau ou serveur."
    echo "  La session démarre quand même : la routine revérifiera avant de briefer."
  fi
fi

# 6. Le pack lui-même.
#
# Un environnement cloud n'a pas forcément de dépôt attaché — constaté le
# 2026-08-19 : /home/user vide, aucun clone nulle part. Compter dessus était une
# erreur. On matérialise donc le pack ici, depuis le dépôt public, pour que la
# routine trouve de vrais fichiers à lire au lieu d'avoir à deviner une URL.
#
# La liste est explicite plutôt que déduite d'une API : GitHub limite les appels
# anonymes par IP, et une IP de conteneur est partagée. Ajouter un fichier au
# pack veut donc dire l'ajouter ici — c'est le prix d'un démarrage qui ne dépend
# de rien.
RAW="https://raw.githubusercontent.com/Massak-r/kojima-solutions/main/routines"
FILES="README.md contexte.md donnees.md brief-quotidien.md point-argent.md echeances-admin.md recap-hebdo.md lib/kojima.sh"

if [ -f routines/brief-quotidien.md ]; then
  PACK_DIR="$(pwd)/routines"
  echo "✓ pack déjà présent (dépôt monté) : $PACK_DIR"
else
  PACK_DIR="${KOJIMA_PACK_DIR:-$HOME/routines}"
  mkdir -p "$PACK_DIR/lib"
  got=0
  missing=""
  for f in $FILES; do
    if curl -fsSL -m 30 "$RAW/$f" -o "$PACK_DIR/$f"; then
      got=$((got + 1))
    else
      missing="$missing $f"
    fi
  done
  if [ -n "$missing" ]; then
    echo "! pack incomplet — manquant :$missing"
    echo "  Vérifie que raw.githubusercontent.com est autorisé dans l'accès réseau."
    fail=1
  else
    echo "✓ pack téléchargé ($got fichiers) : $PACK_DIR"
  fi
fi
echo "  → les routines doivent lire le pack dans : $PACK_DIR"

echo "───────────────────────────────────"
[ "$fail" -eq 0 ] || { echo "Environnement incomplet : les routines ne pourront pas travailler."; exit 1; }
echo "Prêt."
