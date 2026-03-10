#!/usr/bin/env node
/**
 * Script de collecte des prix carburants
 * Sauvegarde les prix actuels dans l'historique SQLite
 */

const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'prix-carburants.db');
const API_URL = 'https://donnees.roulez-eco.fr/opendata/instantane';

async function collect() {
  console.log('📥 Téléchargement des données prix-carburants...');
  console.log(`🕒 ${new Date().toLocaleString('fr-FR')}`);
  
  try {
    // Télécharger les données
    const response = await fetch(API_URL);
    const buffer = await response.buffer();
    
    // Extraire le ZIP
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const xmlEntry = zipEntries.find(e => e.entryName.endsWith('.xml'));
    
    if (!xmlEntry) {
      throw new Error('Aucun fichier XML trouvé dans le ZIP');
    }
    
    // Parser le XML
    const xml2js = require('xml2js');
    const xmlContent = xmlEntry.getData().toString('utf8');
    const parser = new xml2js.Parser({ explicitArray: false, normalizeTags: false, trim: true });
    const result = await parser.parseStringPromise(xmlContent);
    
    const pdvList = result.pdv_liste.pdv;
    const stations = Array.isArray(pdvList) ? pdvList : [pdvList];
    
    console.log(`✅ ${stations.length} stations récupérées`);
    
    // Ouvrir la base de données
    const db = new sqlite3.Database(DB_PATH);
    
    // Enregistrer les prix
    const carburants = ['Gazole', 'E10', 'SP95', 'SP98', 'E85', 'GPLc'];
    const results = {};
    
    for (const carburant of carburants) {
      let count = 0;
      
      for (const pdv of stations) {
        if (!pdv.prix) continue;
        
        const prixList = Array.isArray(pdv.prix) ? pdv.prix : [pdv.prix];
        const prix = prixList.find(p => p.$.nom === carburant);
        
        if (prix) {
          const stationId = pdv.$.id;
          const ville = pdv.ville || '';
          const valeur = parseFloat(prix.$.valeur);
          
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT OR REPLACE INTO price_history (station_id, station_ville, carburant, prix, recorded_at)
               VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
              [stationId, ville, carburant, valeur],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          count++;
        }
      }
      
      results[carburant] = count;
    }
    
    // Fermer la DB
    await new Promise(resolve => db.close(resolve));
    
    console.log('\n📊 Collecte terminée:');
    for (const [carb, count] of Object.entries(results)) {
      console.log(`   ${carb}: ${count} prix enregistrés`);
    }
    console.log(`\n✅ Total: ${stations.length} stations traitées`);
    
    return { success: true, stations: stations.length, results };
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  collect()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { collect };