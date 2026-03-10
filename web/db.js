/**
 * Base de données SQLite pour l'historique des prix
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'prix-carburants.db');

let db = null;

/**
 * Initialise la base de données
 */
function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else {
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

/**
 * Crée les tables nécessaires
 */
function createTables() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_id TEXT NOT NULL,
        station_ville TEXT,
        carburant TEXT NOT NULL,
        prix REAL NOT NULL,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(station_id, carburant, recorded_at)
      )
    `, (err) => {
      if (err) reject(err);
      else {
        // Index pour accélérer les recherches
        db.run(`CREATE INDEX IF NOT EXISTS idx_station ON price_history(station_id, carburant)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_date ON price_history(recorded_at)`);
        resolve();
      }
    });
  });
}

/**
 * Enregistre un prix
 */
function savePrice(stationId, stationVille, carburant, prix, timestamp = null) {
  return new Promise((resolve, reject) => {
    const ts = timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sql = `
      INSERT OR REPLACE INTO price_history (station_id, station_ville, carburant, prix, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.run(sql, [stationId, stationVille, carburant, prix, ts], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

/**
 * Enregistre les prix de plusieurs stations
 * Utilise UN SEUL timestamp pour toute la collecte (évite les doublons par seconde)
 */
async function savePrices(stations, carburant, timestamp = null) {
  // Utiliser le timestamp fourni ou en créer un (format: YYYY-MM-DD HH:MM:SS)
  const ts = timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const promises = stations.map(station => {
    const prix = station.prix.find(p => p.nom === carburant);
    if (prix) {
      return savePrice(station.id, station.ville, carburant, prix.valeur, ts);
    }
    return Promise.resolve();
  });
  return Promise.all(promises);
}

/**
 * Récupère l'historique d'une station pour un carburant
 */
function getHistory(stationId, carburant, days = 30) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        station_id,
        station_ville,
        carburant,
        prix,
        recorded_at
      FROM price_history
      WHERE station_id = ? AND carburant = ?
      AND recorded_at >= datetime('now', '-' || ? || ' days', 'localtime')
      ORDER BY recorded_at ASC
    `;
    db.all(sql, [stationId, carburant, days], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Récupère les tendances pour toutes les stations d'un carburant
 */
function getTrends(carburant, stationIds = null) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        station_id,
        station_ville,
        carburant,
        MIN(prix) as prix_min,
        MAX(prix) as prix_max,
        AVG(prix) as prix_moyen,
        (
          SELECT prix FROM price_history ph2 
          WHERE ph2.station_id = ph1.station_id AND ph2.carburant = ph1.carburant
          ORDER BY recorded_at DESC LIMIT 1
        ) as prix_actuel,
        (
          SELECT recorded_at FROM price_history ph3 
          WHERE ph3.station_id = ph1.station_id AND ph3.carburant = ph1.carburant
          ORDER BY recorded_at DESC LIMIT 1
        ) as derniere_maj,
        COUNT(*) as nb_enregistrements
      FROM price_history ph1
      WHERE carburant = ?
    `;
    
    const params = [carburant];
    
    if (stationIds && stationIds.length > 0) {
      sql += ` AND station_id IN (${stationIds.map(() => '?').join(',')})`;
      params.push(...stationIds);
    }
    
    sql += ' GROUP BY station_id ORDER BY prix_actuel ASC';
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Calcule la tendance (hausse/baisse/stable)
 */
function analyzeTrend(history) {
  if (!history || history.length < 2) {
    return 'stable';
  }
  
  // Comparer premier et dernier prix pour détecter la tendance
  const first = history[0].prix;
  const last = history[history.length - 1].prix;
  const diff = last - first;
  
  // Écart de plus de 1 cent = significatif
  if (diff > 0.01) return 'hausse';
  if (diff < -0.01) return 'baisse';
  return 'stable';
}

/**
 * Nettoie les anciens enregistrements (rotation)
 */
function cleanOldRecords(daysToKeep = 90) {
  return new Promise((resolve, reject) => {
    const sql = `
      DELETE FROM price_history
      WHERE recorded_at < datetime('now', '-' || ? || ' days', 'localtime')
    `;
    db.run(sql, [daysToKeep], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

/**
 * Ferme la connexion
 */
function close() {
  return new Promise((resolve) => {
    if (db) {
      db.close(() => resolve());
    } else {
      resolve();
    }
  });
}

module.exports = {
  init,
  savePrice,
  savePrices,
  getHistory,
  getTrends,
  analyzeTrend,
  cleanOldRecords,
  close
};