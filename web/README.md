# Prix Carburants Web

Application web pour trouver les stations essence les moins chères avec historique des prix.

## Fonctionnalités

- ✅ Recherche par adresse/ville (autocomplétion)
- ✅ Filtrage par carburant (Gazole, E10, SP95, SP98, E85, GPL)
- ✅ Filtrage par rayon (1-50 km)
- ✅ Historique des prix sur 30 jours
- ✅ Graphiques de tendance (hausse/baisse/stable)
- ✅ Données officielles (prix-carburants.gouv.fr)

## Stack technique

- **Backend**: Node.js + Express
- **Base de données**: SQLite (historique)
- **Frontend**: HTML + Bootstrap 5 + Chart.js
- **Déploiement**: Docker + nginx

## Développement local

```bash
# Installer les dépendances
npm install

# Lancer le serveur
npm start

# Ouvrir http://localhost:3200
```

## Déploiement

Voir [DEPLOY.md](DEPLOY.md) pour les instructions complètes.

### Docker

```bash
# Build
docker-compose build

# Lancer
docker-compose up -d

# Logs
docker-compose logs -f
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stations?lat=X&lon=Y&radius=Z` | Stations dans un rayon |
| `GET /api/stations/cheapest?...&carburant=Gazole` | Stations les moins chères |
| `GET /api/history/:stationId/:carburant` | Historique des prix |
| `GET /api/trends/:carburant` | Tendances par carburant |
| `POST /api/collect` | Forcer la collecte des prix |
| `GET /api/health` | État du serveur |

## Structure

```
web/
├── server.js          # API Express
├── db.js              # Base SQLite
├── Dockerfile         # Image Docker
├── docker-compose.yml # Orchestration
├── nginx.conf         # Reverse proxy
├── package.json
├── public/
│   └── index.html     # Frontend
└── DEPLOY.md          # Instructions déploiement
```

## Licence

MIT

## Changelog

### v1.1.1 (10/03/2026)
- **Fix**: Timestamps en heure locale Paris (plus UTC)
- **Fix**: Détection des tendances corrigée (hausse/baisse maintenant visible)
- **Amélioration**: Autocomplétion avec ville en **bold** + code postal en gris
- **Données**: Historique des prix maintenant correctement horodaté