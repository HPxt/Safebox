import SwiftUI

struct UnlockView: View {
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                Spacer(minLength: 40)

                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundStyle(.blue)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Desbloquear cofre")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("Digite sua senha-mestra. Ela nunca e enviada ao servidor.")
                        .foregroundStyle(.secondary)
                }

                SecureField("Senha-mestra", text: $coordinator.masterPassword)
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled(true)
                    .modifier(SafeBoxTextFieldStyle())

                if let warning = coordinator.ultraWarning {
                    Text(warning)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }

                if let error = coordinator.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await coordinator.unlockVault() }
                } label: {
                    Text("Desbloquear")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(coordinator.masterPassword.isEmpty)

                Button("Sair da conta") {
                    Task { await coordinator.signOut() }
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)

                Spacer()
            }
            .padding(24)
            .navigationTitle("Cofre bloqueado")
        }
    }
}
