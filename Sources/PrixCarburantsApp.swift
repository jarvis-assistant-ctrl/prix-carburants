//
//  PrixCarburantsApp.swift
//  PrixCarburants
//
//  Point d'entrée de l'application
//

import SwiftUI

@main
struct PrixCarburantsApp: App {
    
    @StateObject private var locationManager = LocationManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(locationManager)
        }
    }
}