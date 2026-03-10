#!/bin/bash
# Script de test complet

LOG_FILE="/tmp/test-complete.log"

echo "======================================" > $LOG_FILE
echo "TEST COMPLET - $(date)" >> $LOG_FILE
echo "======================================" >> $LOG_FILE

# Processus
echo "" >> $LOG_FILE
echo "=== PROCESSUS NODE ===" >> $LOG_FILE
ps aux | grep "node" | grep -v grep >> $LOG_FILE 2>&1 || echo "AUCUN PROCESSUS NODE" >> $LOG_FILE

# Logs serveur
echo "" >> $LOG_FILE
echo "=== LOGS SERVEUR ===" >> $LOG_FILE
cat /home/greg/.openclaw/workspace/projects/prix-carburants-app/web/logs/server.log >> $LOG_FILE 2>&1 || echo "Pas de logs serveur" >> $LOG_FILE

# Test Health
echo "" >> $LOG_FILE
echo "=== TEST HEALTH ===" >> $LOG_FILE
curl -s http://localhost:3200/api/health >> $LOG_FILE 2>&1 || echo "ECHEC HEALTH" >> $LOG_FILE

# Test Index
echo "" >> $LOG_FILE
echo "=== TEST INDEX ===" >> $LOG_FILE
curl -s http://localhost:3200/ | head -20 >> $LOG_FILE 2>&1 || echo "ECHEC INDEX" >> $LOG_FILE

# Test History
echo "" >> $LOG_FILE
echo "=== TEST HISTORY ===" >> $LOG_FILE
curl -s "http://localhost:3200/api/history/77170001/Gazole?days=7" >> $LOG_FILE 2>&1 || echo "ECHEC HISTORY" >> $LOG_FILE

# Test Trends
echo "" >> $LOG_FILE
echo "=== TEST TRENDS ===" >> $LOG_FILE
curl -s "http://localhost:3200/api/trends/Gazole?lat=48.85&lon=2.35&radius=10" >> $LOG_FILE 2>&1 || echo "ECHEC TRENDS" >> $LOG_FILE

echo "" >> $LOG_FILE
echo "=== FIN ===" >> $LOG_FILE

# Afficher le fichier
cat $LOG_FILE