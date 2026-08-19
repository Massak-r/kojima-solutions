#!/usr/bin/env bash
# Script de démarrage de l'environnement cloud des routines Kojima.
#
# À coller tel quel dans le champ « script de configuration » de l'environnement :
#     bash routines/lib/setup.sh
#
# Son seul travail : échouer bruyamment maintenant plutôt que discrètement dans
# vingt minutes. Une routine qui démarre avec une clé absente produit un brief
# vide et personne ne sait pourquoi.

set -u

echo "── Environnement routines Kojima ──"

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
  else
    echo "✗ l'API a répondu HTTP $code sur accounts.php"
    fail=1
  fi
fi

# 6. Le pack lui-même. Présent si le dépôt est cloné ; sinon la routine le lira
#    en HTTP (voir README.md), ce n'est pas bloquant.
if [ -d routines ]; then
  echo "✓ pack routines/ présent dans le dépôt"
else
  echo "· pack routines/ absent du disque — la routine devra le lire via"
  echo "  https://raw.githubusercontent.com/Massak-r/kojima-solutions/main/routines/"
fi

echo "───────────────────────────────────"
[ "$fail" -eq 0 ] || { echo "Environnement incomplet : les routines ne pourront pas travailler."; exit 1; }
echo "Prêt."
