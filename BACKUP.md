# Backup Base Prix-Carburants

## Problème
Backup SQLite cohérent pour une base de 1.8 Go (13 jours) → ~4 Go à 30 jours.

## Solution proposée

### Intégration dans l'application
Backup intégré dans `db.js` + `server.js` (pas de cron externe)

### Implémentation

#### 1. `db.js` - Fonction backup()
```javascript
const fs = require('fs');
const exec = require('child_process').exec;

function backup() {
  return new Promise((resolve, reject) => {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const tempPath = path.join(backupDir, 'temp.db');
    const finalPath = path.join(backupDir, `prix-${timestamp}.db.gz`);
    
    // Backup SQLite cohérent
    db.backup(tempPath, (err) => {
      if (err) reject(err);
      else {
        // Compression gzip
        exec(`gzip -c "${tempPath}" > "${finalPath}"`, (err) => {
          fs.unlinkSync(tempPath);
          if (err) reject(err);
          else {
            // Supprimer les vieux backups (garder 1)
            const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db.gz'));
            files.sort().slice(0, -1).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
            resolve(finalPath);
          }
        });
      }
    });
  });
}

// Export
module.exports = { ..., backup };
```

#### 2. `server.js` - Backup quotidien à 3h
```javascript
const scheduleBackup = () => {
  const now = new Date();
  const next3am = new Date(now);
  next3am.setHours(3, 0, 0, 0);
  if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
  const delay = next3am - now;
  
  setTimeout(async () => {
    try {
      const backupPath = await db.backup();
      console.log(`💾 Backup créé: ${backupPath}`);
    } catch (err) {
      console.error('❌ Erreur backup:', err);
    }
    setInterval(async () => {
      try {
        const path = await db.backup();
        console.log(`💾 Backup créé: ${path}`);
      } catch (err) {
        console.error('❌ Erreur backup:', err);
      }
    }, 24 * 60 * 60 * 1000);
  }, delay);
  console.log(`💾 Premier backup programmé à 3:00`);
};

// Appeler dans start() après scheduleCleanup()
scheduleBackup();
```

#### 3. Endpoint API (optionnel)
```javascript
app.post('/api/backup', async (req, res) => {
  try {
    const path = await db.backup();
    res.json({ success: true, path });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

## Tailles estimées

| Période | Base SQLite | Backup gzip |
|---------|-------------|-------------|
| 13 jours | 1.8 Go | ~300 Mo |
| 30 jours | ~4 Go | ~800 Mo - 1 Go |

## Rétention

- 1 backup conservé (écrase le précédent)
- ~1 Go d'espace disque max

## Avantages

- ✅ Cohérence garantie (SQLite `.backup`)
- ✅ Pas de cron externe
- ✅ Fonctionne en local et Docker
- ✅ Compression gzip (5:1)
- ✅ Logs centralisés avec l'appli

## À faire

Quand Greg confirme : implémenter dans `db.js` et `server.js`