# Notes - Prix Carburants App

## Statut
- **Collecte automatique** : ✅ OK
  - Cron toutes les heures (prix-carburants-collect)
  - Source : `https://donnees.roulez-eco.fr/opendata/instantane`
  - 9832 stations, 6 carburants
  - Historique SQLite : 33k+ entrées

## TODO

### HTTPS (nécessaire pour GPS mobile)
La géolocalisation est bloquée par les navigateurs mobiles en HTTP.

**Solution avec mkcert (certificats locaux) :**
```bash
# Installer mkcert
sudo apt install mkcert
mkcert -install

# Générer certificat pour localhost et IP locale
cd ~/.openclaw/workspace/projects/prix-carburants-app/web
mkcert localhost 192.168.1.x

# Modifier server.js pour HTTPS
# Ajouter les certs et écouter sur 443
```

**Alternative :** Utiliser un reverse proxy (Nginx/Caddy) avec certificat Let's Encrypt si accessible depuis internet.

### App iOS
- V0.1 squelette SwiftUI en standby
- Utilise données mock
- À connecter à l'API

## Architecture

```
prix-carburants-app/
├── web/
│   ├── server.js          # API Express + collecte
│   ├── db.js              # SQLite operations
│   ├── prix-carburants.db # Base de données
│   ├── collect.js         # Script de collecte (cron)
│   └── public/
│       └── index.html     # Interface web
└── Sources/               # App iOS (SwiftUI)
```

## Cron jobs

```bash
# Liste des jobs actifs
openclaw cron list

# Collecte automatique : chaque heure
# Appelle POST /api/collect-internal
```