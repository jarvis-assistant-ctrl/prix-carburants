#!/bin/bash
# Script de test complet

LOG_FILE="/tmp/server-test.log"

echo "=== $(date) ===" >> $LOG_FILE

echo "1. Processus node:" >> $LOG_FILE
pgrep -a node >> $LOG_FILE 2>&1

echo "" >> $LOG_FILE
echo "2. Port 3200:" >> $LOG_FILE
ss -tlnp | grep 3200 >> $LOG_FILE 2>&1

echo "" >> $LOG_FILE
echo "3. Test curl:" >> $LOG_FILE
curl -s http://localhost:3200/ >> $LOG_FILE 2>&1

echo "" >> $LOG_FILE
echo "4. Contenu du log:" >> $LOG_FILE
cat $LOG_FILE