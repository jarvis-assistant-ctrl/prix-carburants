#!/bin/bash
# Collecte automatique des prix carburants pour l'historique

cd /home/greg/.openclaw/workspace/projects/prix-carburants-app/web

# Position par défaut (Brie-Comte-Robert)
LAT="48.69"
LON="2.61"
RADIUS="50"
CARBURANTS=("Gazole" "E10" "SP95" "SP98" "E85" "GPLc")

echo "$(date '+%Y-%m-%d %H:%M') - Collecte des prix carburants..."

for c in "${CARBURANTS[@]}"; do
  echo "  → $c"
  curl -s -X POST "http://localhost:3200/api/collect" \
    -H "Content-Type: application/json" \
    -d "{\"lat\": $LAT, \"lon\": $LON, \"radius\": $RADIUS, \"carburant\": \"$c\"}" \
    > /dev/null 2>&1
done

echo "$(date '+%Y-%m-%d %H:%M') - Collecte terminée"