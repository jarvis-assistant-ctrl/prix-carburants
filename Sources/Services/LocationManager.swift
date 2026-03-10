//
//  LocationManager.swift
//  PrixCarburants
//
//  Gestion de la localisation GPS
//

import Foundation
import CoreLocation
import Combine

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    
    private let locationManager = CLLocationManager()
    
    @Published var location: CLLocation?
    @Published var status: CLAuthorizationStatus = .notDetermined
    @Published var erreur: String?
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.requestWhenInUseAuthorization()
    }
    
    func demanderAutorisation() {
        locationManager.requestWhenInUseAuthorization()
    }
    
    func demarrerLocalisation() {
        locationManager.startUpdatingLocation()
    }
    
    func arreterLocalisation() {
        locationManager.stopUpdatingLocation()
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        status = manager.authorizationStatus
        
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            demarrerLocalisation()
        case .denied, .restricted:
            erreur = "Localisation non autorisée. Activez-la dans Réglages."
        default:
            break
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let nouvelleLocation = locations.last else { return }
        location = nouvelleLocation
        arreterLocalisation() // Une seule position suffit pour notre usage
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        erreur = "Erreur de localisation: \(error.localizedDescription)"
    }
}