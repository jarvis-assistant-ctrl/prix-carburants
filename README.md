# Prix Carburants

**Application pour trouver les stations essence les moins chères autour de soi.**

Deux versions disponibles :
- 📱 **iOS** (Swift/SwiftUI) - Natif iPhone
- 🌐 **Web** (Node.js + HTML) - Navigateur

---

## 🎯 Objectif MVP

- Localisation GPS de l'utilisateur
- Liste des stations dans un rayon configurable
- Affichage des prix par carburant (SP95, Diesel, E10...)
- Tri par distance ou par prix

---

## 🌐 Version Web (v1.1.0)

### Structure

```
web/
├── server.js          # Serveur Express + API
├── package.json       # Dépendances
└── public/
    └── index.html     # Interface utilisateur
```

### Installation

```bash
cd web
npm install
npm start
```

Le serveur démarre sur `http://localhost:3000`

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stations?lat=X&lon=Y&radius=Z` | Stations dans un rayon |
| `GET /api/stations/cheapest?lat=X&lon=Y&radius=Z&carburant=Gazole` | Stations les moins chères |
| `GET /api/refresh` | Force le rafraîchissement du cache |
| `GET /api/health` | État du serveur |

### Fonctionnalités

- ✅ Téléchargement automatique des données prix-carburants.gouv.fr
- ✅ Parsing XML/ZIP
- ✅ Cache des données (1 heure)
- ✅ Filtrage par carburant (Gazole, E10, SP95, SP98, E85, GPL)
- ✅ Slider pour le rayon (1-50 km)
- ✅ Géolocalisation navigateur
- ✅ Design responsive

---

## 📱 Version iOS (v0.1)

### Structure

```
Sources/
├── Models/
│   └── Station.swift              # Modèle de données
├── Services/
│   ├── CarburantService.swift     # Appel API
│   └── LocationManager.swift      # Gestion GPS
├── ViewModels/
│   └── StationViewModel.swift     # Logique métier
├── Views/
│   ├── ContentView.swift          # Vue principale
│   └── StationRowView.swift       # Cellule station
└── PrixCarburantsApp.swift        # Point d'entrée
```

### Instructions

1. **Créer le projet dans Xcode**
   - `File` → `New` → `Project`
   - iOS → App, SwiftUI, Swift
   - Name: `PrixCarburants`

2. **Ajouter les fichiers sources**
   - Copier le contenu de `Sources/` dans le projet Xcode

3. **Configurer Info.plist**
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Nous avons besoin de votre position pour trouver les stations proches</string>
   ```

4. **Tester sur iPhone**
   - Sélectionner l'iPhone comme cible
   - `Run`

---

## ✅ État actuel

### Web (v1.1.1) - **EN LIGNE** 🌐
- [x] Serveur Express + API
- [x] Parsing XML/ZIP officiel
- [x] Interface responsive
- [x] Filtrage par carburant et rayon
- [x] Historique des prix par station
- [x] Collecte automatique horaire (à l'heure pile)
- [x] Service Docker sur VPS OVH
- [x] HTTPS Let's Encrypt valide
- [x] Géolocalisation mobile fonctionnelle
- [ ] Carte interactive

### iOS (v0.1)
- [x] Structure SwiftUI
- [x] Modèles de données
- [x] Service mock (données test)
- [x] Interface avec filtres
- [ ] Vraie API prix-carburants

---

## 📊 Données officielles

Source : **prix-carburants.gouv.fr**

- Fichier ZIP (~1 MB) contenant un XML (~12 MB)
- Mise à jour quotidienne vers 8h
- ~14 000 stations en France
- 6 types de carburants : Gazole, SP95, SP98, E10, E85, GPLc

---

## 🔨 Prochaines étapes

**Web v1.2**
- [ ] Carte Leaflet avec marqueurs
- [ ] PWA (installable)
- [ ] Tendances de prix (évolution sur 7 jours)

**iOS v0.2**
- [ ] Intégrer la vraie API
- [ ] MapKit pour la carte
- [ ] Favoris / Alertes

---

## 📞 Support

Problème ? Donne l'erreur exacte.