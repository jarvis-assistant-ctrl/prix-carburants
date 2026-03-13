/**
 * Stats légères pour mesurer la fréquentation
 * Taille: ~1 Ko max par jour
 */

const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, 'stats.json');

// Stats en mémoire
let stats = {
  date: new Date().toISOString().split('T')[0],
  total_requests: 0,
  hourly: {},
  endpoints: {}
};

// Debug: afficher au chargement
console.log('📊 Stats initialisées:', stats.date);

/**
 * Charge les stats du jour depuis le fichier
 */
function load() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      const today = new Date().toISOString().split('T')[0];
      
      // Reset si nouveau jour
      if (data.date !== today) {
        console.log(`📊 Nouveau jour - reset stats (${data.date} → ${today})`);
        stats.date = today;
        stats.total_requests = 0;
        stats.hourly = {};
        stats.endpoints = {};
      } else {
        stats = data;
      }
    }
  } catch (e) {
    console.log('📊 Erreur chargement stats:', e.message);
  }
}

/**
 * Sauvegarde les stats dans le fichier
 */
function save() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset si nouveau jour (correction bug: serveur long-running)
    if (stats.date !== today) {
      console.log(`📊 Nouveau jour détecté - reset stats (${stats.date} → ${today})`);
      stats.date = today;
      stats.total_requests = 0;
      stats.hourly = {};
      stats.endpoints = {};
    }
    
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.log('📊 Erreur sauvegarde stats:', e.message);
  }
}

/**
 * Enregistre une requête
 * @param {string} endpoint - Route appelée (ex: '/api/stations')
 */
function recordRequest(endpoint) {
  const hour = new Date().getHours();
  const hourKey = `${hour}h-${hour + 1}h`;
  
  stats.total_requests++;
  stats.hourly[hourKey] = (stats.hourly[hourKey] || 0) + 1;
  stats.endpoints[endpoint] = (stats.endpoints[endpoint] || 0) + 1;
  
  console.log(`📊 Requête enregistrée: ${endpoint} (total: ${stats.total_requests})`);
  
  // Sauvegarder toutes les 100 requêtes pour éviter les I/O excessives
  if (stats.total_requests % 100 === 0) {
    save();
  }
}

/**
 * Retourne les stats actuelles
 */
function get() {
  // Trouver l'heure de pointe
  let peakHour = 'N/A';
  let peakCount = 0;
  
  for (const [hour, count] of Object.entries(stats.hourly)) {
    if (count > peakCount) {
      peakCount = count;
      peakHour = hour;
    }
  }
  
  return {
    date: stats.date,
    total_requests: stats.total_requests,
    peak_hour: peakHour,
    peak_count: peakCount,
    endpoints: stats.endpoints,
    hourly: stats.hourly
  };
}

/**
 * Retourne les stats formatées pour l'affichage
 */
function format() {
  const s = get();
  let text = `📊 Stats du ${s.date}\n`;
  text += `   Total requêtes: ${s.total_requests.toLocaleString()}\n`;
  text += `   Heure de pointe: ${s.peak_hour} (${s.peak_count} req)\n`;
  text += `\n📍 Top endpoints:\n`;
  
  const sortedEndpoints = Object.entries(s.endpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  for (const [endpoint, count] of sortedEndpoints) {
    text += `   ${endpoint}: ${count.toLocaleString()}\n`;
  }
  
  return text;
}

// Charger les stats au démarrage
load();
console.log('📊 Module stats chargé');

// Sauvegarder immédiatement si nouveau jour (sync fichier)
save();

// Sauvegarder les stats toutes les 5 minutes
setInterval(() => {
  save();
}, 5 * 60 * 1000);

module.exports = {
  recordRequest,
  get,
  format,
  load,
  save
};