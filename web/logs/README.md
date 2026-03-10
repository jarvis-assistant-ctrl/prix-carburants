# Prix Carburants - Logs

## Structure des logs

```
logs/
├── server.log    # Tous les logs du serveur
├── error.log     # Erreurs uniquement
└── access.log     # Accès HTTP
```

## Consulter les logs

### En ligne de commande
```bash
# Logs complets
cat logs/server.log

# Dernières lignes
tail -f logs/server.log

# Erreurs uniquement
cat logs/error.log

# Accès HTTP
cat logs/access.log
```

### Via API
```bash
# Tous les logs
curl http://localhost:3200/api/logs

# Vider les logs
curl http://localhost:3200/api/logs/clear
```

## Format des logs

```
[2026-03-10T12:00:00.000Z] [INFO] Message normal
[2026-03-10T12:00:00.000Z] [ERROR] Message d'erreur
```

## Logs disponibles

- **INFO** : Démarrage, requêtes, chargement des données
- **ERROR** : Erreurs critiques
- **ACCESS** : Toutes les requêtes HTTP