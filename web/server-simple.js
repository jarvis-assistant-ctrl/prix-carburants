/**
 * Prix Carburants - Serveur avec logs intégrés
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3200;
const HOST = process.env.HOST || '0.0.0.0';

// Répertoire des logs
const LOGS_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'server.log');
const ERROR_LOG = path.join(LOGS_DIR, 'error.log');
const ACCESS_LOG = path.join(LOGS_DIR, 'access.log');

// Créer le répertoire logs
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Fonction de logging
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}\n`;
  console.log(line.trim());
  try {
    fs.appendFileSync(LOG_FILE, line);
    if (level === 'ERROR') {
      fs.appendFileSync(ERROR_LOG, line);
    }
  } catch (e) {
    console.error('Erreur écriture log:', e.message);
  }
}

function logAccess(req, statusCode) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${req.method} ${req.url} ${statusCode}\n`;
  try {
    fs.appendFileSync(ACCESS_LOG, line);
  } catch (e) {}
}

// Cache des stations
let stationsCache = null;
let lastUpdate = null;

// Base de données SQLite pour l'historique
const sqlite3 = require('sqlite3');
const dbPath = path.join(__dirname, 'prix-carburants.db');
let db = null;

// Initialiser la base de données
function initDB() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        log('ERREUR SQLite: ' + err.message, 'ERROR');
        reject(err);
        return;
      }
      
      db.run(`
        CREATE TABLE IF NOT EXISTS price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id TEXT NOT NULL,
          station_ville TEXT,
          carburant TEXT NOT NULL,
          prix REAL NOT NULL,
          recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          log('ERREUR création table: ' + err.message, 'ERROR');
          reject(err);
        } else {
          log('✅ Base SQLite initialisée', 'INFO');
          resolve();
        }
      });
    });
  });
}

// Sauvegarder un prix
function savePrice(stationId, ville, carburant, prix) {
  return new Promise((resolve) => {
    if (!db) { resolve(); return; }
    db.run(
      'INSERT INTO price_history (station_id, station_ville, carburant, prix) VALUES (?, ?, ?, ?)',
      [stationId, ville, carburant, prix],
      () => resolve()
    );
  });
}

// Obtenir l'historique
function getHistory(stationId, carburant, days = 7) {
  return new Promise((resolve) => {
    if (!db) { resolve([]); return; }
    db.all(
      `SELECT * FROM price_history 
       WHERE station_id = ? AND carburant = ? 
       AND recorded_at >= datetime('now', '-' || ? || ' days')
       ORDER BY recorded_at ASC`,
      [stationId, carburant, days],
      (err, rows) => {
        if (err) { resolve([]); return; }
        resolve(rows || []);
      }
    );
  });
}

// Analyser la tendance
function analyzeTrend(history) {
  if (!history || history.length < 2) return 'stable';
  const recent = history.slice(-7);
  const older = history.slice(0, -7);
  if (recent.length < 2 || older.length < 1) return 'stable';
  const recentAvg = recent.reduce((s, r) => s + r.prix, 0) / recent.length;
  const olderAvg = older.reduce((s, r) => s + r.prix, 0) / older.length;
  const diff = recentAvg - olderAvg;
  if (diff > 0.02) return 'hausse';
  if (diff < -0.02) return 'baisse';
  return 'stable';
}

// Télécharger les données
async function fetchStations() {
  log('📥 Téléchargement des données...', 'INFO');
  
  const AdmZip = require('adm-zip');
  const xml2js = require('xml2js');
  
  return new Promise((resolve, reject) => {
    https.get('https://donnees.roulez-eco.fr/opendata/instantane', (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          log('Téléchargement OK', 'INFO');
          const buffer = Buffer.concat(chunks);
          const zip = new AdmZip(buffer);
          const entries = zip.getEntries();
          log(`${entries.length} fichiers dans le ZIP`, 'INFO');
          
          const xmlEntry = entries.find(e => e.entryName.endsWith('.xml'));
          if (!xmlEntry) {
            log('ERREUR: Aucun XML', 'ERROR');
            reject(new Error('Aucun fichier XML'));
            return;
          }
          
          const xmlContent = zip.readAsText(xmlEntry);
          log(`XML: ${xmlContent.length} caractères`, 'INFO');
          
          const parser = new xml2js.Parser({ explicitArray: false });
          parser.parseString(xmlContent, (err, result) => {
            if (err) {
              log('ERREUR parsing: ' + err.message, 'ERROR');
              reject(err);
              return;
            }
            
            try {
              const pdvList = result.pdv_liste.pdv;
              const stations = (Array.isArray(pdvList) ? pdvList : [pdvList]).map(pdv => {
                const prixArray = pdv.prix ? (Array.isArray(pdv.prix) ? pdv.prix : [pdv.prix]) : [];
                return {
                  id: pdv.$.id,
                  latitude: parseFloat(pdv.$.latitude) / 100000,
                  longitude: parseFloat(pdv.$.longitude) / 100000,
                  cp: pdv.$.cp || '',
                  ville: pdv.ville || '',
                  adresse: pdv.adresse || '',
                  prix: prixArray.map(p => ({
                    nom: p.$.nom,
                    valeur: parseFloat(p.$.valeur),
                    maj: p.$.maj
                  }))
                };
              });
              
              stationsCache = stations;
              lastUpdate = new Date();
              log(`✅ ${stations.length} stations chargées`, 'INFO');
              resolve(stations);
            } catch (e) {
              log('ERREUR traitement: ' + e.message, 'ERROR');
              reject(e);
            }
          });
        } catch (e) {
          log('ERREUR extraction: ' + e.message, 'ERROR');
          reject(e);
        }
      });
    }).on('error', (e) => {
      log('ERREUR téléchargement: ' + e.message, 'ERROR');
      reject(e);
    });
  });
}

// Calculer la distance
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Filtrer les stations
function getStations(lat, lon, radius, carburant) {
  if (!stationsCache) return [];
  return stationsCache
    .map(s => ({ ...s, distance: distance(lat, lon, s.latitude, s.longitude) }))
    .filter(s => s.distance <= radius)
    .filter(s => s.prix.some(p => p.nom.includes(carburant)))
    .sort((a, b) => a.distance - b.distance);
}

// Handler HTTP
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Log requête
  log(`${req.method} ${req.url}`, 'INFO');
  
  try {
    // Charger les données si nécessaire
    if (!stationsCache && req.url !== '/api/logs') {
      await fetchStations();
    }
    
    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
      logAccess(req, 200);
    }
    else if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', stationsLoaded: stationsCache?.length || 0, lastUpdate: lastUpdate?.toISOString() }));
      logAccess(req, 200);
    }
    else if (url.pathname === '/api/logs') {
      const logs = {
        server: fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8').split('\n').slice(-100).join('\n') : 'Pas de logs',
        errors: fs.existsSync(ERROR_LOG) ? fs.readFileSync(ERROR_LOG, 'utf8').split('\n').slice(-50).join('\n') : 'Pas d\'erreurs',
        access: fs.existsSync(ACCESS_LOG) ? fs.readFileSync(ACCESS_LOG, 'utf8').split('\n').slice(-100).join('\n') : 'Pas d\'accès'
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(logs, null, 2));
    }
    else if (url.pathname === '/api/logs/clear') {
      fs.writeFileSync(LOG_FILE, '');
      fs.writeFileSync(ERROR_LOG, '');
      fs.writeFileSync(ACCESS_LOG, '');
      log('Logs vidés', 'INFO');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Logs vidés' }));
    }
    else if (url.pathname === '/api/stations/cheapest') {
      const lat = parseFloat(url.searchParams.get('lat') || '48.85');
      const lon = parseFloat(url.searchParams.get('lon') || '2.35');
      const radius = parseFloat(url.searchParams.get('radius') || '10');
      const carburant = url.searchParams.get('carburant') || 'Gazole';
      
      const stations = getStations(lat, lon, radius, carburant);
      const withPrice = stations
        .map(s => ({ ...s, carburantPrix: s.prix.find(p => p.nom.includes(carburant)) }))
        .filter(s => s.carburantPrix)
        .slice(0, 50)
        .sort((a, b) => a.carburantPrix.valeur - b.carburantPrix.valeur);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ carburant, count: withPrice.length, stations: withPrice }));
      logAccess(req, 200);
    }
    else if (url.pathname.startsWith('/api/history/')) {
      // Historique des prix pour une station
      const parts = url.pathname.split('/');
      const stationId = parts[3];
      const carburant = parts[4] || 'Gazole';
      const days = parseInt(url.searchParams.get('days') || '30');
      
      log(`GET /api/history/${stationId}/${carburant}`, 'INFO');
      
      const history = await getHistory(stationId, carburant, days);
      const trend = analyzeTrend(history);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        station_id: stationId, 
        carburant, 
        days, 
        trend, 
        count: history.length,
        history: history 
      }));
      logAccess(req, 200);
    }
    else if (url.pathname === '/api/trends/' + url.pathname.split('/')[2]) {
      const carburant = url.pathname.split('/')[2];
      const lat = parseFloat(url.searchParams.get('lat') || '48.85');
      const lon = parseFloat(url.searchParams.get('lon') || '2.35');
      const radius = parseFloat(url.searchParams.get('radius') || '10');
      
      const stations = getStations(lat, lon, radius, carburant);
      const trends = stations.slice(0, 50).map(s => ({
        station_id: s.id,
        station_ville: s.ville,
        carburant,
        prix_actuel: s.prix.find(p => p.nom.includes(carburant))?.valeur || 0,
        prix_min: s.prix.find(p => p.nom.includes(carburant))?.valeur * 0.98 || 0,
        prix_max: s.prix.find(p => p.nom.includes(carburant))?.valeur * 1.02 || 0,
        trend: 'stable'
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ carburant, count: trends.length, stations: trends }));
      logAccess(req, 200);
    }
    else if (url.pathname.startsWith('/api/history/')) {
      // Historique des prix pour une station
      const parts = url.pathname.split('/');
      const stationId = parts[3];
      const carburant = parts[4] || 'Gazole';
      const days = parseInt(url.searchParams.get('days') || '30');
      
      log(`GET /api/history/${stationId}/${carburant}`, 'INFO');
      
      const history = await getHistory(stationId, carburant, days);
      const trend = analyzeTrend(history);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        station_id: stationId, 
        carburant, 
        days, 
        trend, 
        history 
      }));
    }
    else {
      const filePath = path.join(__dirname, 'public', url.pathname);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.writeHead(200);
        res.end(fs.readFileSync(filePath));
        logAccess(req, 200);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        log(`404 ${req.url}`, 'WARN');
      }
    }
  } catch (error) {
    log('ERREUR: ' + error.message + '\n' + error.stack, 'ERROR');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

// Démarrage
server.listen(PORT, HOST, async () => {
  log('=================================', 'INFO');
  log(`🚀 Serveur démarré sur http://${HOST}:${PORT}`, 'INFO');
  log('=================================', 'INFO');
  
  try {
    await initDB();
    await fetchStations();
  } catch (e) {
    log('Erreur initialisation: ' + e.message, 'ERROR');
  }
});