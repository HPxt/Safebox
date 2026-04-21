import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var coordinator: AppCoordinator

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 22) {
                Spacer(minLength: 32)

                VStack(alignment: .leading, spacing: 8) {
                    Text("SafeBox")
                        .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Text("Entre para acessar seu cofre criptografado.")
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 14) {
                    TextField("Email", text: $coordinator.email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .modifier(SafeBoxTextFieldStyle())

                    SecureField("Senha da conta", text: $coordinator.password)
                        .textContentType(.password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .modifier(SafeBoxTextFieldStyle())
                }

                if let error = coordinator.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    Task { await coordinator.signIn() }
                } label: {
                    Text("Entrar")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(coordinator.email.isEmpty || coordinator.password.isEmpty)

                Text("Cadastro in-app fica fora do v1. Para criar conta e senha-mestra, use o web.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Spacer()
            }
            .padding(24)
            .navigationTitle("Login")
        }
    }
}

struct SafeBoxTextFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(14)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
