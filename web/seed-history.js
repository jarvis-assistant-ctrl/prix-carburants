/**
 * Script pour simuler un historique de prix (pour les tests)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'prix-carburants.db');

const db = new sqlite3.Database(DB_PATH);

// Stations de test
const stations = [
  { id: '77170001', ville: 'Brie-Comte-Robert' },
  { id: '77170002', ville: 'Lieusaint' },
  { id: '77170003', ville: 'Soignolles-en-Brie' },
  { id: '77170004', ville: 'Solers' },
  { id: '77170005', ville: 'Yèbles' }
];

// Générer 30 jours d'historique
async function generateHistory() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM price_history', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  const now = new Date();
  const carburants = ['Gazole', 'E10', 'SP95'];
  
  for (let day = 30; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString();
    
    for (const station of stations) {
      for (const carburant of carburants) {
        // Prix de base + variation aléatoire
        const basePrice = carburant === 'Gazole' ? 1.85 : carburant === 'E10' ? 1.75 : 1.80;
        const variation = (Math.random() - 0.5) * 0.10; // ±5 cents
        const trend = day * 0.002; // Légère tendance à la hausse
        const price = basePrice + variation + trend;
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO price_history (station_id, station_ville, carburant, prix, recorded_at)
             VALUES (?, ?, ?, ?, ?)`,
            [station.id, station.ville, carburant, price.toFixed(3), dateStr],
            (err) => err ? reject(err) : resolve()
          );
        });
      }
    }
  }
  
  console.log('✅ Historique généré avec succès !');
  console.log('   - 5 stations x 3 carburants x 31 jours = 465 enregistrements');
  
  db.close();
}

generateHistory().catch(console.error);