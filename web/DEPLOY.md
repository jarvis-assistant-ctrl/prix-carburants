# Déploiement Prix Carburants

## Prérequis

- Docker et Docker Compose installés
- Un VPS (OVH, DigitalOcean, etc.)
- Port 80 ouvert

## Déploiement rapide

```bash
# Cloner le projet
git clone <repo-url> prix-carburants
cd prix-carburants/web

# Copier les variables d'environnement
cp .env.example .env

# Lancer avec Docker Compose
docker-compose up -d

# Vérifier que ça fonctionne
curl http://localhost/api/health
```

## Déploiement sur OVH

### 1. Préparer le VPS

```bash
# Se connecter au VPS
ssh ubuntu@<vps-ip>

# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Créer le répertoire
mkdir -p /opt/prix-carburants
cd /opt/prix-carburants
```

### 2. Transférer les fichiers

```bash
# Depuis votre machine locale
scp -r web/* ubuntu@<vps-ip>:/opt/prix-carburants/
```

### 3. Lancer l'application

```bash
# Sur le VPS
cd /opt/prix-carburants
docker-compose up -d

# Vérifier les logs
docker-compose logs -f
```

### 4. Configurer le domaine (optionnel)

```bash
# Installer Certbot pour HTTPS
sudo apt install certbot python3-certbot-nginx

# Obtenir un certificat SSL
sudo certbot --nginx -d prix-carburants.example.com
```

## Mode Maintenance

Avant une mise à jour, activer le mode maintenance pour éviter les erreurs utilisateurs :

```bash
# Activer le mode maintenance
touch .maintenance
# ou via API :
curl -X POST http://localhost:3200/api/maintenance

# Vérifier
curl http://localhost:3200/api/health
# {"status":"maintenance","message":"Maintenance mode enabled"}
```

Le mode maintenance :
- Renvoie HTTP 503 sur toutes les pages
- Préserve l'accès à `/api/health` et `/api/maintenance`
- Affiche une page d'attente aux utilisateurs

```bash
# Désactiver le mode maintenance
rm .maintenance
# ou via API :
curl -X POST http://localhost:3200/api/maintenance
```

## Gestion

```bash
# Voir les logs
docker-compose logs -f

# Redémarrer
docker-compose restart

# Mettre à jour (avec maintenance)
touch .maintenance                    # Activer maintenance
git pull origin main
docker-compose build
docker-compose up -d
rm .maintenance                       # Désactiver maintenance

# Arrêter
docker-compose down
```

## Monitoring

### Health check

```bash
curl http://localhost/api/health
```

### Base de données

La base SQLite est stockée dans `./data/prix-carburants.db`. Pour sauvegarder :

```bash
# Sauvegarder
cp ./data/prix-carburants.db ./data/backup-$(date +%Y%m%d).db

# Restaurer
cp ./data/backup-20260310.db ./data/prix-carburants.db
docker-compose restart app
```

## Collecte automatique

Le serveur intègre une collecte automatique **autonome** :

- Synchronisée sur l'heure pile (18:00, 19:00, etc.)
- Pas de cron externe nécessaire
- Redémarre automatiquement avec le serveur

```bash
# Vérifier la version et l'état
curl http://localhost:3200/api/health
# {"status":"ok","version":"1.1.0","stationsLoaded":9832,"lastUpdate":"..."}
```

## Sécurité

- Rate limiting sur l'API (nginx)
- Headers de sécurité
- Pas d'exposition de la base de données
- Logs séparés

## Ressources

- RAM: ~100MB
- CPU: Faible (0.1 core au repos)
- Disque: ~50MB + base de données