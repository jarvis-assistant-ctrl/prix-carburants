/**
 * Prix Carburants - Backend API
 * Télécharge et parse les données prix-carburants.gouv.fr
 * avec historique des prix
 */

const express = require('express');
const https = require('https');
const http = require('http');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const db = require('./db');
const enseignes = require('./enseignes');
const stats = require('./stats');
const path = require('path');
const fs = require('fs');

const VERSION = require('./package.json').version;
const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3200;
const HTTPS_PORT = process.env.HTTPS_PORT || 3201;
const HOST = process.env.HOST || '0.0.0.0';

// Charger les certificats HTTPS
let httpsOptions = null;
try {
  httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
  };
  console.log('✅ Certificats HTTPS chargés');
} catch (e) {
  console.log('⚠️ Certificats HTTPS non trouvés, mode HTTP uniquement');
}

// Cache des données
let stationsCache = null;
let lastUpdate = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

// API URL
const API_URL = 'https://donnees.roulez-eco.fr/opendata/instantane';

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Force UTF-8 charset for API responses
app.use('/api', (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(data);
  };
  next();
});

// Servir les fichiers statiques (stats.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ========== FIN AUTHENTIFICATION ==========

// Compteur de requêtes pour les stats (ignore /api/stats)
app.use('/api', (req, res, next) => {
  if (req.path !== '/stats') {
    stats.recordRequest(req.path);
  }
  next();
});

// Route pour les stats (protégée)
const STATS_PASSWORD = process.env.STATS_PASSWORD || 'jarvis2026';

function checkStatsAuth(req, res, next) {
  const password = req.query.password || req.headers['x-stats-password'];
  if (password === STATS_PASSWORD) return next();
  res.status(401).json({ error: 'Non autorisé. Ajoutez ?password=XXX' });
}

app.get('/api/stats', checkStatsAuth, (req, res) => {
  res.json(stats.get());
});

/**
 * Télécharge et parse les données
 */
async function refreshData() {
  console.log('📥 Téléchargement des données prix-carburants...');
  
  try {
    const response = await fetch(API_URL);
    const buffer = await response.buffer();
    
    // Extraire le ZIP
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    // Trouver le fichier XML
    const xmlEntry = zipEntries.find(e => e.entryName.endsWith('.xml'));
    if (!xmlEntry) {
      throw new Error('Aucun fichier XML trouvé dans le ZIP');
    }
    
    const xmlContent = xmlEntry.getData().toString('utf8');
    
    // Parser le XML
    const parser = new xml2js.Parser({ 
      explicitArray: false,
      normalizeTags: false,
      trim: true
    });
    const result = await parser.parseStringPromise(xmlContent);
    
    // Fonction pour corriger les accents ISO-8859-1
    function fixEncoding(str) {
      if (!str) return str;
      return str
        .replace(/�/g, 'é')
        .replace(/�/g, 'è')
        .replace(/�/g, 'ê')
        .replace(/�/g, 'ë')
        .replace(/�/g, 'à')
        .replace(/�/g, 'â')
        .replace(/�/g, 'ù')
        .replace(/�/g, 'û')
        .replace(/�/g, 'ô')
        .replace(/�/g, 'î')
        .replace(/�/g, 'ï')
        .replace(/�/g, 'ç');
    }
    
    // Convertir en tableau de stations
    const pdvList = result.pdv_liste.pdv;
    const stations = (Array.isArray(pdvList) ? pdvList : [pdvList]).map(pdv => {
      const station = {
        id: pdv.$.id,
        latitude: parseFloat(pdv.$.latitude) / 100000,
        longitude: parseFloat(pdv.$.longitude) / 100000,
        cp: pdv.$.cp,
        ville: fixEncoding(pdv.ville) || '',
        adresse: fixEncoding(pdv.adresse) || '',
        prix: []
      };
      
      // Extraire les prix
      if (pdv.prix) {
        const prixList = Array.isArray(pdv.prix) ? pdv.prix : [pdv.prix];
        station.prix = prixList.map(p => ({
          nom: p.$.nom,
          id: p.$.id,
          valeur: parseFloat(p.$.valeur),
          maj: p.$.maj
        }));
      }
      
      return station;
    });
    
    stationsCache = stations;
    lastUpdate = new Date();
    
    console.log(`✅ ${stations.length} stations chargées`);
    return stations;
    
  } catch (error) {
    console.error('❌ Erreur téléchargement:', error.message);
    throw error;
  }
}

/**
 * Calcule la distance entre deux points GPS (km)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filtre les stations par rayon
 */
function getNearbyStations(lat, lon, radiusKm, carburant = null) {
  if (!stationsCache) return [];
  
  return stationsCache
    .map(station => ({
      ...station,
      distance: haversineDistance(lat, lon, station.latitude, station.longitude)
    }))
    .filter(station => station.distance <= radiusKm)
    .filter(station => {
      if (carburant) {
        return station.prix.some(p => p.nom.toLowerCase().includes(carburant.toLowerCase()));
      }
      return true;
    })
    .sort((a, b) => a.distance - b.distance);
}

// Routes API

/**
 * GET /api/stations
 * Params: lat, lon, radius (km), carburant (optionnel)
 */
app.get('/api/stations', async (req, res) => {
  stats.recordRequest('/api/stations');
  try {
    const { lat, lon, radius = 10, carburant } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat et lon requis' });
    }
    
    // Rafraîchir le cache si nécessaire
    if (!stationsCache || (Date.now() - lastUpdate?.getTime()) > CACHE_TTL) {
      await refreshData();
    }
    
    const stations = getNearbyStations(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius),
      carburant
    );
    
    // Enrichir avec les noms d'enseignes
    const enrichedStations = await enseignes.enrichirStations(stations.slice(0, 50));
    
    res.json({
      count: stations.length,
      lastUpdate: lastUpdate,
      stations: enrichedStations
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stations/cheapest
 * Trouve les stations les moins chères pour un carburant donné
 */
app.get('/api/stations/cheapest', async (req, res) => {
  try {
    const { lat, lon, radius = 10, carburant = 'Gazole' } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat et lon requis' });
    }
    
    if (!stationsCache) {
      await refreshData();
    }
    
    const stations = getNearbyStations(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius),
      carburant
    );
    
    // Filtrer et trier par prix
    const withPrice = stations
      .map(station => {
        const price = station.prix.find(p => 
          p.nom.toLowerCase().includes(carburant.toLowerCase())
        );
        return { ...station, carburantPrix: price };
      })
      .filter(s => s.carburantPrix)
      .sort((a, b) => a.carburantPrix.valeur - b.carburantPrix.valeur);
    
    // Enrichir avec les enseignes depuis le cache
    const top20 = withPrice.slice(0, 20);
    const stationIds = top20.map(s => s.id);
    const enseignesData = await enseignes.getEnseignesByIds(stationIds);
    
    const enrichedStations = top20.map(station => ({
      ...station,
      enseigne: enseignesData[station.id]?.enseigne || null
    }));
    
    res.json({
      carburant,
      count: withPrice.length,
      stations: enrichedStations
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/refresh
 * Force le rafraîchissement du cache
 */
app.get('/api/refresh', async (req, res) => {
  try {
    await refreshData();
    res.json({ success: true, count: stationsCache.length, lastUpdate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: VERSION,
    stationsLoaded: stationsCache?.length || 0,
    lastUpdate: lastUpdate
  });
});

/**
 * GET /api/history/:stationId/:carburant
 * Historique des prix pour une station
 */
app.get('/api/history/:stationId/:carburant', async (req, res) => {
  try {
    const { stationId, carburant } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    const history = await db.getHistory(stationId, carburant, days);
    const trend = db.analyzeTrend(history);
    
    res.json({
      station_id: stationId,
      carburant,
      days,
      trend,
      history
    });
    
  } catch (error) {
    console.error('Erreur historique:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/trends/:carburant
 * Tendances pour toutes les stations d'un carburant
 */
app.get('/api/trends/:carburant', async (req, res) => {
  try {
    const { carburant } = req.params;
    
    // Rafraîchir le cache si nécessaire
    if (!stationsCache || (Date.now() - lastUpdate?.getTime()) > CACHE_TTL) {
      await refreshData();
    }
    
    // Récupérer les IDs de stations dans le rayon
    const { lat, lon, radius } = req.query;
    let stationIds = null;
    
    if (lat && lon && radius) {
      const nearby = getNearbyStations(
        parseFloat(lat),
        parseFloat(lon),
        parseFloat(radius),
        carburant
      );
      stationIds = nearby.map(s => s.id);
    }
    
    const trends = await db.getTrends(carburant, stationIds);
    
    // Enrichir avec les infos de tendance
    const enriched = await Promise.all(trends.map(async (t) => {
      const history = await db.getHistory(t.station_id, carburant, 7);
      return {
        ...t,
        trend: db.analyzeTrend(history),
        variation: t.prix_actuel && history.length > 1 
          ? (t.prix_actuel - history[0].prix).toFixed(3)
          : null
      };
    }));
    
    res.json({
      carburant,
      count: enriched.length,
      stations: enriched
    });
    
  } catch (error) {
    console.error('Erreur tendances:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collect
 * Force la collecte des prix pour historique
 */
app.post('/api/collect', async (req, res) => {
  try {
    const { carburant, radius, lat, lon } = req.body;
    
    if (!stationsCache) {
      await refreshData();
    }
    
    // Récupérer les stations dans le rayon
    const stations = getNearbyStations(
      parseFloat(lat),
      parseFloat(lon),
      parseFloat(radius),
      carburant
    );
    
    // Sauvegarder les prix
    const saved = await db.savePrices(stations, carburant);
    
    res.json({
      success: true,
      saved: saved.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur collecte:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collect-internal
 * Collecte automatique (appelé par cron) - collecte pour TOUS les carburants sur TOUTE la France
 */
app.post('/api/collect-internal', async (req, res) => {
  try {
    if (!stationsCache) {
      await refreshData();
    }
    
    // UN SEUL timestamp pour toute la collecte (tous carburants) - heure locale Paris
    const now = new Date();
    const collectTimestamp = now.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace('T', ' ').substring(0, 19);
    const carburants = ['Gazole', 'E10', 'SP95', 'SP98', 'E85', 'GPLc'];
    const results = {};
    const totalStations = stationsCache.length;
    
    for (const carburant of carburants) {
      // Collecter pour TOUTES les stations de France
      const saved = await db.savePrices(stationsCache, carburant, collectTimestamp);
      results[carburant] = saved.length;
    }
    
    console.log('📊 Collecte nationale:', results, '- Total stations:', totalStations, '- Timestamp:', collectTimestamp);
    
    res.json({
      success: true,
      scope: 'France entière',
      totalStations,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erreur collecte interne:', error);
    res.status(500).json({ error: error.message });
  }
});

// Démarrer le serveur
async function start() {
  try {
    // Initialiser la base de données
    await db.init();
    console.log('✅ Base de données initialisée');
    
    // Nettoyer les anciens enregistrements (> 30 jours)
    const deleted = await db.cleanOldRecords(30);
    if (deleted > 0) {
      console.log(`🧹 ${deleted} anciens enregistrements supprimés (> 30 jours)`);
    }
    
    // Pré-charger les données au démarrage
    await refreshData();
    console.log('📥 Données prix-carburants chargées');
    
    // Pré-charger les enseignes (noms des stations)
    if (stationsCache && stationsCache.length > 0) {
      console.log('🏷️ Pré-chargement des enseignes...');
      enseignes.preloadEnseignes(stationsCache).catch(err => 
        console.error('⚠️ Erreur préchargement enseignes:', err.message)
      );
    }
    
    // Sauvegarder les prix pour l'historique (Gazole par défaut)
    if (stationsCache && stationsCache.length > 0) {
      db.savePrices(stationsCache.slice(0, 100), 'Gazole')
        .then(() => console.log('📊 Historique initial sauvegardé'))
        .catch(err => console.error('Erreur historique:', err));
    }
    
    // Serveur HTTP (toujours actif)
    http.createServer(app).listen(HTTP_PORT, HOST, () => {
      console.log(`🌐 HTTP  : http://${HOST}:${HTTP_PORT}`);
    });
    
    // Serveur HTTPS (si certificats disponibles)
    if (httpsOptions) {
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, HOST, () => {
        console.log(`🔒 HTTPS : https://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${HTTPS_PORT}`);
        console.log('⚠️  ATTENTION: Certificat auto-signé - Le navigateur affichera un avertissement');
        console.log('📱 Pour mobile: Accepter le certificat ou installer le CA mkcert sur le téléphone');
      });
    }
    
    console.log('📍 API disponible sur /api/stations');
    console.log(`📦 Version: ${VERSION}`);
    
    // Collecte automatique à l'heure pile (autonome, sans dépendance externe)
    const doCollect = async () => {
      try {
        console.log('🔄 Collecte automatique...');
        await refreshData();
        console.log('📥 Données rafraîchies');
        const collectTimestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).replace('T', ' ').substring(0, 19);
        const carburants = ['Gazole', 'E10', 'SP95', 'SP98', 'E85', 'GPLc'];
        for (const carburant of carburants) {
          if (stationsCache && stationsCache.length > 0) {
            await db.savePrices(stationsCache, carburant, collectTimestamp);
          }
        }
        console.log('✅ Collecte automatique terminée - Timestamp:', collectTimestamp);
      } catch (err) {
        console.error('❌ Erreur collecte auto:', err);
      }
    };

    // Calcul du délai jusqu'à la prochaine heure pile
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const delayToNextHour = nextHour - now;
    
    console.log(`⏰ Première collecte dans ${Math.round(delayToNextHour/60000)} min (à ${nextHour.getHours()}:00)`);
    
    // Première collecte à l'heure pile, puis toutes les heures
    setTimeout(() => {
      doCollect();
      setInterval(doCollect, 60 * 60 * 1000);
    }, delayToNextHour);
    
  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    process.exit(1);
  }
}

start();