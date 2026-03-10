#!/bin/bash
# Collecte automatique des prix carburants
# Exécuté toutes les heures par cron

LOG_FILE="/var/log/prix-carburants.log"
API_URL="http://localhost:3200/api/collect-internal"

# Position par défaut (modifiable selon les besoins)
LAT="48.69"
LON="2.61"
RADIUS="50"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log "Début de la collecte"

# Collecte pour chaque carburant
for CARBURANT in "Gazole" "E10" "SP95" "SP98" "E85" "GPLc"; do
    log "  → $CARBURANT"
    
    RESPONSE=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"lat\": $LAT, \"lon\": $LON, \"radius\": $RADIUS, \"carburant\": \"$CARBURANT\"}" \
        2>> "$LOG_FILE")
    
    if [ $? -eq 0 ]; then
        log "    ✓ $CARBURANT OK"
    else
        log "    ✗ $CARBURANT ERREUR"
    fi
done

log "Fin de la collecte"