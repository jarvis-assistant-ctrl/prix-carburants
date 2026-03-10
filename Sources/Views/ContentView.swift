//
//  ContentView.swift
//  PrixCarburants
//
//  Vue principale - Liste des stations
//

import SwiftUI
import CoreLocation

struct ContentView: View {
    
    // MARK: - State
    
    @StateObject private var viewModel = StationViewModel()
    @State private var rayonSelectionne: Double = 10.0
    @State private var carburantSelectionne: TypeCarburant = .diesel
    
    // MARK: - Body
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                
                // Filtres
                filtresView
                
                // Liste des stations
                listeStationsView
                
            }
            .navigationTitle("Stations Essence")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: {
                        viewModel.rafrachir()
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .alert(isPresented: $viewModel.afficherErreur) {
                Alert(
                    title: Text("Erreur"),
                    message: Text(viewModel.messageErreur ?? "Une erreur est survenue"),
                    dismissButton: .default(Text("OK"))
                )
            }
        }
        .onAppear {
            viewModel.chargerStations()
        }
    }
    
    // MARK: - Filtres
    
    private var filtresView: some View {
        VStack(spacing: 12) {
            
            // Sélecteur de rayon
            HStack {
                Text("Rayon:")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Slider(value: $rayonSelectionne, in: 1...50, step: 1)
                    .accentColor(.blue)
                
                Text("\(Int(rayonSelectionne)) km")
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .padding(.horizontal)
            
            // Sélecteur de carburant
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(TypeCarburant.allCases, id: \.self) { type in
                        Button(action: {
                            carburantSelectionne = type
                            viewModel.filtrerPar(carburant: type)
                        }) {
                            Text(type.displayName)
                                .font(.subheadline)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(
                                    carburantSelectionne == type
                                        ? Color.blue
                                        : Color.gray.opacity(0.2)
                                )
                                .foregroundColor(
                                    carburantSelectionne == type
                                        ? .white
                                        : .primary
                                )
                                .cornerRadius(20)
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
    }
    
    // MARK: - Liste des stations
    
    private var listeStationsView: some View {
        Group {
            if viewModel.isLoading {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                    Text("Chargement des stations...")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.stations.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "fuelpump.slash")
                        .font(.system(size: 50))
                        .foregroundColor(.gray)
                    Text("Aucune station trouvée")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Essayez d'augmenter le rayon de recherche")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(viewModel.stations) { station in
                        StationRowView(station: station, carburantSelectionne: carburantSelectionne)
                    }
                }
                .listStyle(PlainListStyle())
            }
        }
    }
}

// MARK: - Preview

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}