# Déploiement Prix Carburants

## Architecture

- **Type** : Application Node.js (Express)
- **Base de données** : SQLite (`prix-carburants.db` ~1.8 GB)
- **Ports** : 3200 (HTTP), 3201 (HTTPS)

## Service Systemd

L'application tourne en tant que service utilisateur systemd :

```ini
[Unit]
Description=Prix Carburants API Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/greg/.openclaw/workspace/projects/prix-carburants-app/web
ExecStart=/home/greg/.nvm/versions/node/v24.13.1/bin/node server.js
Restart=always
RestartSec=10
Environment=PATH=/home/greg/.nvm/versions/node/v24.13.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=default.target
```

Fichier : `~/.config/systemd/user/prix-carburants.service`

### Commandes

```bash
# Voir le statut
systemctl --user status prix-carburants

# Démarrer
systemctl --user start prix-carburants

# Arrêter
systemctl --user stop prix-carburants

# Redémarrer
systemctl --user restart prix-carburants

# Voir les logs
journalctl --user -u prix-carburants -f
```

## Structure du projet

```
prix-carburants-app/
├── web/
│   ├── server.js          # Serveur principal (point d'entrée)
│   ├── db.js               # Gestion SQLite + purge
│   ├── package.json        # Dépendances npm
│   ├── prix-carburants.db  # Base de données SQLite
│   ├── public/             # Fichiers statiques (HTML/CSS/JS)
│   └── enseignes.js        # Mapping enseignes
├── Sources/                # Code iOS (Swift/SwiftUI)
├── docker-compose.yml      # Déploiement Docker (VPS)
└── README.md
```

## Base de données

- **Table** : `price_history`
- **Taille** : ~1.8 GB (10M+ entrées)
- **Rétention** : 30 jours (recommandé)
- **Purge** : `db.cleanOldRecords(30)` dans db.js

## Fonctionnalités

- Téléchargement automatique des données prix-carburants.gouv.fr
- Collecte horaire (à l'heure pile)
- API REST : `/api/stations`, `/api/stations/cheapest`, `/api/health`
- Historique des prix par station

## URLs

- **Local** : http://localhost:3200
- **Production** : https://prix-carburant.webhop.net (VPS OVH)

## Production (VPS)

- **Chemin** : `/opt/prix-carburants/`
- **Docker** : `docker-compose up -d`
- **Règle** : NE JAMAIS toucher au VPS directement (modification locale puis déploiement manuel)

## Modifier le code

1. Modifier les fichiers localement
2. Tester localement : `cd web && node server.js`
3. Redémarrer le service : `systemctl --user restart prix-carburants`
4. Pour la prod : copier les fichiers modifiés sur le VPS et redémarrer Docker