const fs = require('fs');
const path = require('path');
const sax = require('sax');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../prix-carburants.db');
const archivePath = path.join(__dirname, '../data/archives/PrixCarburants_annuel_2025.xml');

const db = new sqlite3.Database(dbPath);

const BATCH_SIZE = 1000; // Plus petit batch pour éviter les problèmes
const carburants = ['Gazole', 'E10', 'E85', 'GPLc', 'SP95', 'SP98'];

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

async function importHistory() {
  console.log('Ouverture de la base...');
  await runSql(`CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT NOT NULL,
    station_ville TEXT,
    carburant TEXT NOT NULL,
    prix REAL NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(station_id, carburant, recorded_at)
  )`);
  
  console.log('Création des index...');
  await runSql(`CREATE INDEX IF NOT EXISTS idx_station ON price_history(station_id, carburant)`);
  await runSql(`CREATE INDEX IF NOT EXISTS idx_date ON price_history(recorded_at)`);
  
  console.log('Lecture du fichier XML...');
  const xmlContent = fs.readFileSync(archivePath, { encoding: 'latin1' });
  console.log('Fichier lu, parsing...');
  
  // Parser SAX
  const parser = sax.parser(true, { lowercase: true });
  let currentStation = null;
  let currentVille = '';
  let inVille = false;
  const prices = [];
  let stationCount = 0;
  
  parser.onopentag = function(node) {
    if (node.name === 'pdv') {
      currentStation = node.attributes.id;
      currentVille = '';
      stationCount++;
      if (stationCount % 500 === 0) {
        process.stdout.write(`\rParsing: ${stationCount} stations...`);
      }
    } else if (node.name === 'ville') {
      inVille = true;
    } else if (node.name === 'prix' && currentStation) {
      const nom = node.attributes.nom;
      const maj = node.attributes.maj;
      const valeur = parseFloat(node.attributes.valeur);
      
      if (carburants.includes(nom) && maj && !isNaN(valeur)) {
        prices.push({
          station_id: currentStation,
          station_ville: '',
          carburant: nom,
          prix: valeur,
          recorded_at: maj.replace('T', ' ').substring(0, 19)
        });
      }
    }
  };
  
  parser.ontext = function(text) {
    if (inVille && currentVille === '') {
      currentVille = text.trim();
    }
  };
  
  parser.onclosetag = function(name) {
    if (name === 'ville') {
      inVille = false;
      // Update ville for recent prices
      if (currentVille && prices.length > 0) {
        for (let i = prices.length - 1; i >= 0; i--) {
          if (prices[i].station_id === currentStation) {
            prices[i].station_ville = currentVille;
          } else {
            break;
          }
        }
      }
    } else if (name === 'pdv') {
      currentStation = null;
    }
  };
  
  parser.write(xmlContent).close();
  console.log(`\nParsing terminé: ${stationCount} stations, ${prices.length} prix`);
  
  // Insert par batch avec prepared statement
  console.log('Insertion en base (cela peut prendre quelques minutes)...');
  
  // Vider d'abord les données d'aujourd'hui pour éviter les doublons
  console.log('Nettoyage des données existantes...');
  await runSql(`DELETE FROM price_history`);
  
  const insertStmt = db.prepare('INSERT INTO price_history (station_id, station_ville, carburant, prix, recorded_at) VALUES (?, ?, ?, ?, ?)');
  
  let inserted = 0;
  const total = prices.length;
  
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      for (const p of prices) {
        insertStmt.run(p.station_id, p.station_ville, p.carburant, p.prix, p.recorded_at);
        inserted++;
        
        if (inserted % 50000 === 0) {
          const pct = Math.round(inserted / total * 100);
          process.stdout.write(`\rInsertion: ${inserted}/${total} (${pct}%)`);
        }
      }
      
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
  console.log(`\n\nInsertion terminée: ${inserted} enregistrements`);
  
  // Vérification
  db.all(`SELECT carburant, COUNT(*) as nb, MIN(prix) as min, MAX(prix) as max FROM price_history GROUP BY carburant`, [], (err, rows) => {
    if (err) console.error('Erreur vérification:', err);
    else {
      console.log('Par carburant:');
      rows.forEach(r => console.log(`  ${r.carburant}: ${r.nb}, min=${r.min.toFixed(3)}, max=${r.max.toFixed(3)}`));
    }
    
    db.get(`SELECT COUNT(DISTINCT station_id) as nb FROM price_history`, [], (e2, row) => {
      if (!e2) console.log(`\nTotal: ${row.nb} stations`);
      db.close();
    });
  });
}

importHistory().catch(err => {
  console.error('Erreur:', err);
  db.close();
});