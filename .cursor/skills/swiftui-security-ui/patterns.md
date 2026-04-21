# SwiftUI Security Patterns (referencia rapida)

Snippets testados para os padroes mais comuns do SafeBox iOS. Para contexto e regras, ver `SKILL.md`.

## 1. Reveal/hide password toggle

```swift
struct PasswordReveal: View {
    @Binding var password: String
    @State private var revealed: Bool = false

    var body: some View {
        HStack {
            if revealed {
                Text(password)
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)  // apenas quando revelado explicitamente
            } else {
                Text(String(repeating: "•", count: max(password.count, 8)))
                    .font(.system(.body, design: .monospaced))
            }
            Spacer()
            Button(action: { revealed.toggle() }) {
                Image(systemName: revealed ? "eye.slash" : "eye")
            }
            .accessibilityLabel(revealed ? "Ocultar senha" : "Mostrar senha")
        }
    }
}
```

## 2. Copy-to-clipboard com feedback

```swift
struct CopyButton: View {
    let value: String
    let label: String
    @State private var copied = false

    var body: some View {
        Button(action: copy) {
            HStack(spacing: 6) {
                Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc")
                Text(copied ? "Copiado" : label)
            }
            .font(.footnote)
        }
        .accessibilityLabel("Copiar \(label)")
    }

    private func copy() {
        ClipboardSanitizer.copyWithExpiry(value)
        copied = true
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await MainActor.run { copied = false }
        }
    }
}
```

## 3. Auto-lock overlay

```swift
struct AppRoot: View {
    @StateObject var sessionLock = SessionInactivityLock()
    @StateObject var privacy = ScreenPrivacyObserver()

    var body: some View {
        Group {
            if sessionLock.isLocked {
                UnlockView()
            } else {
                MainTabView()
            }
        }
        .environmentObject(sessionLock)
        .environmentObject(privacy)
        .onAppear { sessionLock.startTimer() }
        .background(TapRecorder(onTap: { sessionLock.recordActivity() }))
    }
}

struct TapRecorder: UIViewRepresentable {
    let onTap: () -> Void
    func makeUIView(context: Context) -> UIView {
        let v = UIView()
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped))
        tap.cancelsTouchesInView = false
        v.addGestureRecognizer(tap)
        return v
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onTap: onTap) }
    final class Coordinator: NSObject {
        let onTap: () -> Void
        init(onTap: @escaping () -> Void) { self.onTap = onTap }
        @objc func tapped() { onTap() }
    }
}
```

## 4. Sensitive container modifier

```swift
struct SensitiveViewModifier: ViewModifier {
    @EnvironmentObject var privacy: ScreenPrivacyObserver
    func body(content: Content) -> some View {
        content
            .blur(radius: privacy.isInBackground || privacy.isCapturing ? 20 : 0)
            .overlay(alignment: .center) {
                if privacy.isCapturing {
                    VStack(spacing: 12) {
                        Image(systemName: "eye.slash.fill").font(.largeTitle)
                        Text("Conteudo oculto")
                            .font(.headline)
                        Text("Gravacao de tela detectada.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
            }
    }
}

extension View {
    func sensitive() -> some View { modifier(SensitiveViewModifier()) }
}
```

Uso:

```swift
CredentialDetailView(credential: credential).sensitive()
```

## 5. TOTP countdown visual

```swift
struct TotpCode: View {
    let secret: String
    @State private var code: String = "------"
    @State private var progress: Double = 0.0
    @State private var timer: Timer?

    var body: some View {
        VStack(spacing: 6) {
            Text(code)
                .font(.system(.title2, design: .monospaced))
                .tracking(4)
            ProgressView(value: progress)
                .progressViewStyle(.linear)
                .tint(progress < 0.25 ? .red : .accentColor)
        }
        .onAppear(perform: start)
        .onDisappear { timer?.invalidate() }
        .accessibilityLabel("Codigo TOTP")
    }

    private func start() {
        update()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            update()
        }
    }

    private func update() {
        let now = Date().timeIntervalSince1970
        let elapsed = now.truncatingRemainder(dividingBy: 30)
        progress = 1.0 - (elapsed / 30.0)
        code = TOTPGenerator.generate(secret: secret, at: now)
    }
}
```

## 6. Lock button manual

```swift
struct LockButton: View {
    @EnvironmentObject var sessionLock: SessionInactivityLock
    var body: some View {
        Button(role: .destructive) {
            sessionLock.lockNow()
        } label: {
            Label("Bloquear cofre", systemImage: "lock.fill")
        }
    }
}
```

## 7. Account deletion (confirmacao dupla)

```swift
struct DeleteAccountView: View {
    @State private var typedConfirmation: String = ""
    @State private var isDeleting = false
    private let requiredWord = "DELETE"

    var body: some View {
        Form {
            Section("Acao irreversivel") {
                Text("Isto apagara permanentemente sua conta, seu cofre e todos os backups.")
                    .foregroundStyle(.secondary)
            }
            Section("Digite \(requiredWord) para confirmar") {
                TextField("Confirmacao", text: $typedConfirmation)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
            Section {
                Button(role: .destructive) {
                    Task { await performDelete() }
                } label: {
                    if isDeleting { ProgressView() } else { Text("Apagar conta") }
                }
                .disabled(typedConfirmation != requiredWord || isDeleting)
            }
        }
    }

    @MainActor
    private func performDelete() async {
        isDeleting = true
        defer { isDeleting = false }
        // 1. Requer re-auth (senha-mestra OU Face ID) antes desta tela
        // 2. Chamar DELETE /api/auth/account
        // 3. Chamar wipe completo (ver apple-compliance-ios, swift-keychain-secure, swift-autofill-extension)
        // 4. Navegar para Welcome
    }
}
```

## 8. Anti-patterns (nao fazer)

```swift
// NAO: texto selecionavel por padrao em campo de senha
Text(credential.password)
    .textSelection(.enabled)

// NAO: imprimir em debug
print("User logged in: \(user.email) pw: \(password)")

// NAO: passar senha como Identifiable para ForEach (vaza em crash logs)
ForEach(credentials) { c in
    CellView(password: c.password)  // password no struct Identifiable
}

// NAO: usar AppStorage com conteudo sensivel
@AppStorage("last_visited_password") var last: String = ""
```
