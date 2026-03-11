# Notes - Prix Carburants App

## Statut
- **Collecte automatique** : ✅ OK
  - Source : `https://donnees.roulez-eco.fr/opendata/instantane`
  - 9837 stations, 6 carburants
  - Historique SQLite : 33k+ entrées

### Déploiement VPS OVH
- **Statut** : ✅ **OPÉRATIONNEL avec HTTPS** (11/03/2026 19:39)
- **URL** : `https://prix-carburant.webhop.net/`
- **API** : `https://prix-carburant.webhop.net/api/`
- **Container** : healthy
- **Ports** : 80→HTTPS, 443 (nginx) → 3200 (app)
- **Données** : 9837 stations chargées
- **Certificat SSL** : Let's Encrypt (expire 09/06/2026)
- **Health check** : curl (fixé, docker-compose.yml corrigé)
- **Géolocalisation mobile** : ✅ Fonctionne (HTTPS valide)

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