# Prix Carburants - Documentation

> **Index de la documentation** - Tous les fichiers sont dans ce dossier

## Fichiers de documentation

| Fichier | Description |
|---------|-------------|
| [README.md](README.md) | Présentation générale, structure, API endpoints |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Déploiement local (service systemd, ports) |
| [web/DEPLOY.md](web/DEPLOY.md) | Déploiement VPS (Docker, maintenance) |
| [BACKUP.md](BACKUP.md) | Stratégie de backup (à implémenter) |
| [NOTES.md](NOTES.md) | Notes diverses, status, TODOs |

## Quick Start

```bash
# Local
systemctl --user start prix-carburants
# Logs
journalctl --user -u prix-carburants -f

# VPS
cd /opt/prix-carburants
docker-compose up -d
```

## URLs

- **Local** : http://localhost:3200
- **Production** : https://prix-carburant.webhop.net