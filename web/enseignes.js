/**
 * Enrichissement des stations avec les noms d'enseignes via OpenStreetMap
 * Utilise Overpass API pour récupérer brand/name à partir de:
 * 1. ref:FR:prix-carburants (ID exact)
 * 2. Coordonnées (recherche autour)
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'data', 'enseignes-cache.json');
const MANUAL_FILE = path.join(__dirname, 'data', 'manual-enseignes-idf.json');
const OVERPASS_APIS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

let cache = {};
let manualMapping = {};
let lastSave = 0;

/**
 * Charge le cache depuis le disque
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      cache = JSON.parse(data);
      console.log(`✅ Cache enseignes chargé: ${Object.keys(cache).length} stations`);
    }
  } catch (e) {
    console.log('⚠️ Impossible de charger le cache enseignes:', e.message);
    cache = {};
  }
}

/**
 * Charge le mapping manuel
 */
function loadManualMapping() {
  try {
    if (fs.existsSync(MANUAL_FILE)) {
      const data = fs.readFileSync(MANUAL_FILE, 'utf8');
      const raw = JSON.parse(data);
      // Filtrer les clés qui commencent par "_" (commentaires)
      Object.keys(raw).forEach(key => {
        if (!key.startsWith('_')) {
          manualMapping[key] = raw[key];
        }
      });
      console.log(`✅ Mapping manuel chargé: ${Object.keys(manualMapping).length} stations IDF`);
    }
  } catch (e) {
    console.log('⚠️ Impossible de charger le mapping manuel:', e.message);
    manualMapping = {};
  }
}

/**
 * Sauvegarde le cache sur le disque
 */
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`💾 Cache enseignes sauvegardé: ${Object.keys(cache).length} stations`);
  } catch (e) {
    console.log('⚠️ Impossible de sauvegarder le cache enseignes:', e.message);
  }
}

/**
 * Requête Overpass API avec fallback et retry
 */
async function queryOverpass(query, retries = 2) {
  for (const api of OVERPASS_APIS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);  // 10s timeout
        
        const response = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (attempt < retries) continue;
          continue;  // Essayer l'autre API
        }
        
        const data = await response.json();
        return data.elements || [];
      } catch (e) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500));  // Retry après 500ms
          continue;
        }
        console.log(`⚠️ Erreur Overpass (${api}):`, e.message);
        continue;  // Essayer l'autre API
      }
    }
  }
  return [];
}

/**
 * Récupère les enseignes par IDs exacts (ref:FR:prix-carburants)
 * Ordre de priorité: 1. Mapping manuel, 2. Cache OSM, 3. Requête Overpass
 */
async function getEnseignesByIds(stationIds) {
  // 1. Stations avec mapping manuel (priorité)
  const result = {};
  const needsLookup = [];
  
  stationIds.forEach(id => {
    if (manualMapping[id]) {
      result[id] = {
        enseigne: manualMapping[id].enseigne,
        source: 'manual'
      };
    } else if (cache[id]) {
      result[id] = cache[id];
    } else {
      needsLookup.push(id);
    }
  });
  
  // Si tout est dans le manuel ou le cache, retourner
  if (needsLookup.length === 0) {
    return result;
  }

  console.log(`🔍 Recherche enseignes pour ${needsLookup.length} stations...`);
  
  // 3. Requête Overpass pour les IDs non trouvés
  const idsList = needsLookup.join('|');
  const query = `[out:json][timeout:30];(node["ref:FR:prix-carburants"~"^(${idsList})$"];way["ref:FR:prix-carburants"~"^(${idsList})$"];);out tags center;`;
  
  try {
    const elements = await queryOverpass(query);
    
    // Parser les résultats
    for (const el of elements) {
      const tags = el.tags || {};
      const ref = tags['ref:FR:prix-carburants'];
      if (ref && !cache[ref]) {
        cache[ref] = {
          brand: tags.brand || tags.operator || null,
          name: tags.name || null,
          enseigne: tags.brand || tags.operator || tags.name || 'Station indépendante'
        };
      }
    }
    
    // Marquer les stations non trouvées pour éviter les requêtes répétées
    for (const id of needsLookup) {
      if (!cache[id]) {
        cache[id] = { brand: null, name: null, enseigne: 'Station indépendante' };
      }
    }
    
    // Sauvegarder périodiquement
    if (Date.now() - lastSave > 60000) {
      saveCache();
      lastSave = Date.now();
    }
  } catch (e) {
    console.log('⚠️ Erreur récupération enseignes:', e.message);
  }
  
  // Ajouter les résultats Overpass au résultat final
  for (const id of needsLookup) {
    result[id] = cache[id] || { enseigne: 'Station indépendante' };
  }
  
  return result;
}

/**
 * Récupère l'enseigne pour stations affichées (avec cache)
 * À utiliser dans l'API /api/stations et /api/search
 */
async function enrichirStations(stations) {
  const ids = stations.map(s => s.id);
  const enseignes = await getEnseignesByIds(ids);
  
  return stations.map(station => ({
    ...station,
    enseigne: enseignes[station.id]?.enseigne || station.ville,
    brand: enseignes[station.id]?.brand || null,
    brandName: enseignes[station.id]?.name || null
  }));
}

/**
 * Recherche par coordonnées pour les stations non trouvées par ID
 */
async function getEnseigneByCoords(lat, lon, radius = 500) {
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"="fuel"](around:${radius},${lat},${lon});
      way["amenity"="fuel"](around:${radius},${lat},${lon});
    );
    out tags center;
  `;
  
  const elements = await queryOverpass(query);
  
  if (elements.length === 0) {
    return { enseigne: 'Station indépendante', brand: null };
  }
  
  // Prendre le plus proche
  const el = elements[0];
  const tags = el.tags || el.center?.tags || {};
  
  return {
    enseigne: tags.brand || tags.operator || tags.name || 'Station indépendante',
    brand: tags.brand || null,
    name: tags.name || null
  };
}

/**
 * Précharge les enseignes pour toutes les stations
 * À exécuter au démarrage du serveur
 */
async function preloadEnseignes(stations) {
  loadCache();
  
  // Traiter par lots plus grands avec parallélisme
  const batchSize = 200;  // Augmenté de 100 à 200
  const allIds = stations.map(s => s.id);
  const parallelRequests = 3;  // 3 requêtes parallèles
  
  // Filtrer les déjà en cache
  const uncached = allIds.filter(id => !cache[id]);
  console.log(`📊 ${uncached.length} stations à enrichir`);
  
  // Traiter en parallèle par lots
  const batches = [];
  for (let i = 0; i < uncached.length; i += batchSize) {
    batches.push(uncached.slice(i, i + batchSize));
  }
  
  let processed = allIds.length - uncached.length;
  
  // Exécuter 3 requêtes en parallèle
  for (let i = 0; i < batches.length; i += parallelRequests) {
    const parallelBatches = batches.slice(i, i + parallelRequests);
    
    await Promise.all(parallelBatches.map(async (batch, idx) => {
      await getEnseignesByIds(batch);
      processed += batch.length;
      console.log(`📊 Enseignes: ${processed}/${allIds.length}`);
    }));
    
    // Pause minimale entre les vagues (500ms au lieu de 2000ms)
    if (i + parallelRequests < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  saveCache();
  console.log('✅ Préchargement enseignes terminé');
}

// Initialiser le cache au chargement
loadCache();
loadManualMapping();

module.exports = {
  getEnseignesByIds,
  getEnseigneByCoords,
  enrichirStations,
  preloadEnseignes,
  saveCache
};