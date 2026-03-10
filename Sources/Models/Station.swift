//
//  Station.swift
//  PrixCarburants
//
//  Modèle de données pour une station-service
//

import Foundation
import CoreLocation

// MARK: - Types de carburants

enum TypeCarburant: String, CaseIterable {
    case sp95 = "SP95"
    case sp98 = "SP98"
    case diesel = "Gazole"
    case e10 = "E10"
    case e85 = "E85"
    case gpl = "GPLc"
    
    var displayName: String {
        switch self {
        case .sp95: return "SP95"
        case .sp98: return "SP98"
        case .diesel: return "Diesel"
        case .e10: return "E10"
        case .e85: return "E85"
        case .gpl: return "GPL"
        }
    }
}

// MARK: - Prix d'un carburant

struct PrixCarburant: Identifiable {
    let id = UUID()
    let type: TypeCarburant
    let prix: Double
    let dateMiseAJour: Date
    
    var prixFormate: String {
        String(format: "%.2f €/L", prix)
    }
}

// MARK: - Station-service

struct Station: Identifiable, Codable {
    let id: String
    let adresse: String
    let ville: String
    let codePostal: String
    let latitude: Double
    let longitude: Double
    let prix: [PrixCarburantData]
    
    // Calculé après chargement
    var distance: Double = 0.0
    var nom: String = ""
    
    // MARK: - Distance calculée depuis une position
    
    mutating func calculerDistance(depuis location: CLLocation) {
        let stationLocation = CLLocation(latitude: latitude, longitude: longitude)
        distance = location.distance(from: stationLocation) / 1000 // en km
    }
    
    // MARK: - Formatage de la distance
    
    var distanceFormatee: String {
        if distance < 1 {
            return String(format: "%.0f m", distance * 1000)
        } else {
            return String(format: "%.1f km", distance)
        }
    }
}

// MARK: - Décodage JSON depuis l'API officielle

struct PrixCarburantData: Codable {
    let nom: String
    let prix: Double
    let dateMiseAJour: String
    
    enum CodingKeys: String, CodingKey {
        case nom
        case prix = "valeur"
        case dateMiseAJour = "maj"
    }
}

// MARK: - Réponse API

struct APIResponse: Codable {
    let stations: [APICarburantStation]
}

struct APICarburantStation: Codable {
    let id: String
    let adresse: String
    let ville: String
    let codePostal: String
    let latitude: Double
    let longitude: Double
    let prix: [PrixCarburantData]
    
    enum CodingKeys: String, CodingKey {
        case id
        case adresse
        case ville
        case codePostal = "cp"
        case latitude = "geom"// Structure géométrique
        case longitude
        case prix
    }
    
    // Note: L'API réelle utilise un format GeoJSON pour les coords
    // On adaptera le décodage selon la vraie structure
}