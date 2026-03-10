//
//  StationViewModel.swift
//  PrixCarburants
//
//  ViewModel pour gérer l'état des stations
//

import SwiftUI
import CoreLocation
import Combine

class StationViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published var stations: [StationCarburant] = []
    @Published var isLoading: Bool = false
    @Published var afficherErreur: Bool = false
    @Published var messageErreur: String?
    
    // MARK: - Private
    
    private let service = CarburantService.shared
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Méthodes
    
    func chargerStations() {
        isLoading = true
        
        // Position de test (Brie-Comte-Robert)
        // TODO: Utiliser la vraie localisation de l'utilisateur
        let positionBrie = CLLocation(latitude: 48.6910, longitude: 2.6142)
        
        service.stationsDansRayon(depuis: positionBrie, rayonKm: 50) { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                switch result {
                case .success(let stations):
                    self?.stations = stations
                    
                case .failure(let error):
                    self?.messageErreur = error.localizedDescription
                    self?.afficherErreur = true
                }
            }
        }
    }
    
    func filtrerPar(carburant: TypeCarburant) {
        // Les stations contiennent déjà tous les prix
        // Le filtrage se fait dans la vue StationRowView
    }
    
    func rafrachir() {
        chargerStations()
    }
}