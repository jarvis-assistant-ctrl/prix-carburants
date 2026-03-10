//
//  StationRowView.swift
//  PrixCarburants
//
//  Cellule d'affichage d'une station
//

import SwiftUI

struct StationRowView: View {
    
    let station: StationCarburant
    let carburantSelectionne: TypeCarburant
    
    // Trouver le prix pour le carburant sélectionné
    var prixDuCarburant: PrixCarburant? {
        station.prix.first { $0.type == carburantSelectionne }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            
            // En-tête : Nom + Distance
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(station.nom)
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text(station.adresseComplete)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                Spacer()
                
                // Badge distance
                Text(station.distanceFormatee)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.15))
                    .foregroundColor(.blue)
                    .cornerRadius(8)
            }
            
            // Prix principal (carburant sélectionné)
            if let prix = prixDuCarburant {
                HStack {
                    Image(systemName: "fuelpump.fill")
                        .foregroundColor(.green)
                    
                    Text(prix.type.displayName)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(prix.prixFormate)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                }
            } else {
                HStack {
                    Image(systemName: "fuelpump.slash")
                        .foregroundColor(.gray)
                    Text("Non disponible")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            
            // Autres prix (optionnel, en ligne compacte)
            let autresPrix = station.prix.filter { $0.type != carburantSelectionne }
            if !autresPrix.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(autresPrix.prefix(3)) { prix in
                            HStack(spacing: 4) {
                                Text(prix.type.displayName)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(prix.prixFormate)
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                        }
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Preview

struct StationRowView_Previews: PreviewProvider {
    static var previews: some View {
        let station = StationCarburant(
            id: "001",
            nom: "Station Test",
            adresse: "15 Rue de la République",
            ville: "Paris",
            codePostal: "75001",
            latitude: 48.85,
            longitude: 2.35,
            distance: 2.5,
            prix: [
                PrixCarburant(type: .diesel, prix: 1.65, dateMiseAJour: Date()),
                PrixCarburant(type: .sp95, prix: 1.78, dateMiseAJour: Date()),
                PrixCarburant(type: .e10, prix: 1.72, dateMiseAJour: Date())
            ]
        )
        
        StationRowView(station: station, carburantSelectionne: .diesel)
            .previewLayout(.sizeThatFits)
            .padding()
    }
}