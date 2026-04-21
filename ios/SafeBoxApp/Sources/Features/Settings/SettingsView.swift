import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        Form {
            Section("Seguranca") {
                Button("Bloquear cofre") {
                    coordinator.lock()
                }
            }

            Section("Conta") {
                Button("Sair", role: .destructive) {
                    Task { await coordinator.signOut() }
                }
            }
        }
        .navigationTitle("Ajustes")
    }
}
