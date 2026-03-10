//
//  CarburantService.swift
//  PrixCarburants
//
//  Service pour récupérer les données depuis prix-carburants.gouv.fr
//

import Foundation
import CoreLocation

// MARK: - Service de récupération des données

class CarburantService {
    
    // Singleton
    static let shared = CarburantService()
    
    private init() {}
    
    // URL de l'API (format instantané)
    private let apiURL = "https://donnees.roulez-eco.fr/opendata/instantane"
    
    // MARK: - Récupérer toutes les stations
    
    func recupererStations(completion: @escaping (Result<[StationCarburant], Error>) -> Void) {
        
        // Note: L'API officielle fournit un fichier ZIP contenant du XML
        // Pour la V1, on simule avec des données de test
        
        // TODO: Implémenter le vrai appel API
        // Le fichier est un ZIP contenant un XML à parser
        
        // Pour l'instant, on retourne des données de test
        let stations = creerDonneesTest()
        completion(.success(stations))
    }
    
    // MARK: - Filtrer par rayon
    
    func stationsDansRayon(depuis position: CLLocation, rayonKm: Double, completion: @escaping (Result<[StationCarburant], Error>) -> Void) {
        
        recupererStations { result in
            switch result {
            case .success(let stations):
                let stationsFiltrees = stations.compactMap { station in
                    var stationMutable = station
                    let distance = position.distance(from: CLLocation(latitude: station.latitude, longitude: station.longitude)) / 1000
                    
                    if distance <= rayonKm {
                        stationMutable.distance = distance
                        return stationMutable
                    }
                    return nil
                }.sorted { $0.distance < $1.distance }
                
                completion(.success(stationsFiltrees))
                
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    // MARK: - Données de test (V1)
    
    private func creerDonneesTest() -> [StationCarburant] {
        return [
            StationCarburant(
                id: "001",
                nom: "Station Brie-Comte-Robert",
                adresse: "15 Rue de la République",
                ville: "Brie-Comte-Robert",
                codePostal: "77170",
                latitude: 48.6910,
                longitude: 2.6142,
                distance: 0.0,
                prix: [
                    PrixCarburant(type: .diesel, prix: 1.65, dateMiseAJour: Date()),
                    PrixCarburant(type: .sp95, prix: 1.78, dateMiseAJour: Date()),
                    PrixCarburant(type: .e10, prix: 1.72, dateMiseAJour: Date())
                ]
            ),
            StationCarburant(
                id: "002",
                nom: "InteMarché Brie",
                adresse: "Zone Commerciale",
                ville: "Brie-Comte-Robert",
                codePostal: "77170",
                latitude: 48.6880,
                longitude: 2.6200,
                distance: 0.0,
                prix: [
                    PrixCarburant(type: .diesel, prix: 1.62, dateMiseAJour: Date()),
                    PrixCarburant(type: .sp95, prix: 1.75, dateMiseAJour: Date()),
                    PrixCarburant(type: .sp98, prix: 1.85, dateMiseAJour: Date())
                ]
            ),
            StationCarburant(
                id: "003",
                nom: "Total Solers",
                adresse: "Avenue de Sénart",
                ville: "Solers",
                codePostal: "77170",
                latitude: 48.7020,
                longitude: 2.6450,
                distance: 0.0,
                prix: [
                    PrixCarburant(type: .diesel, prix: 1.68, dateMiseAJour: Date()),
                    PrixCarburant(type: .sp95, prix: 1.80, dateMiseAJour: Date()),
                    PrixCarburant(type: .gpl, prix: 0.95, dateMiseAJour: Date())
                ]
            )
        ]
    }
}

// MARK: - Modèles pour le service

struct StationCarburant {
    let id: String
    let nom: String
    let adresse: String
    let ville: String
    let codePostal: String
    let latitude: Double
    let longitude: Double
    var distance: Double
    let prix: [PrixCarburant]
    
    var adresseComplete: String {
        "\(adresse), \(codePostal) \(ville)"
    }
    
    var distanceFormatee: String {
        if distance < 1 {
            return String(format: "%.0f m", distance * 1000)
        } else {
            return String(format: "%.1f km", distance)
        }
    }
}

struct PrixCarburant {
    let type: TypeCarburant
    let prix: Double
    let dateMiseAJour: Date
    
    var prixFormate: String {
        String(format: "%.2f €/L", prix)
    }
}