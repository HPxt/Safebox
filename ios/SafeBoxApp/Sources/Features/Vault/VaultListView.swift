import SwiftUI

struct VaultListView: View {
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        NavigationStack {
            List {
                if let error = coordinator.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    if coordinator.vaultItems.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "tray")
                                .font(.largeTitle)
                                .foregroundStyle(.secondary)
                            Text("Cofre vazio")
                                .font(.headline)
                            Text("Crie itens no web ou implemente CRUD nativo na proxima fase.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 32)
                    } else {
                        ForEach(coordinator.vaultItems) { item in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(item.title)
                                        .font(.headline)
                                    Spacer()
                                    Text(item.itemType)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Text(item.subtitle)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                if let folder = item.folderName {
                                    Label(folder, systemImage: "folder")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Meu cofre")
            .onAppear {
                coordinator.recordUserInteraction()
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Bloquear") {
                        coordinator.lock()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        if coordinator.biometricUnlockAvailable {
                            Button("Desativar biometria", role: .destructive) {
                                coordinator.disableBiometricUnlock()
                            }
                        } else {
                            Button("Ativar biometria") {
                                coordinator.enableBiometricUnlock()
                            }
                        }
                        Button("Atualizar") {
                            Task { await coordinator.reloadVault() }
                        }
                        Button("Sair", role: .destructive) {
                            Task { await coordinator.signOut() }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }
}
