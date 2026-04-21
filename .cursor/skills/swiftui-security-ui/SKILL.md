---
name: swiftui-security-ui
description: >-
  Padroes SwiftUI seguros para o SafeBox iOS: anti-screenshot e anti-screen-recording
  na UI sensivel, auto-lock por inatividade, campo de senha mestra sem vazar via
  teclado/autofill/clipboard, clipboard com expiracao automatica, mascaramento de
  senhas no switch foreground/background, e gating de UI por estado da sessao.
  Use sempre que criar tela que mostra credenciais, senha-mestra, notas, totpSecret
  ou clipboard de dados sensiveis. Risco medio mas alto volume: muito facil vazar
  por copy-paste, print em app switcher, teclado de 3rd party.
triggers:
  - "**/Views/**/*.swift"
  - "**/Screens/**/*.swift"
  - "**/CredentialDetail*.swift"
  - "**/UnlockView*.swift"
  - "**/MasterPassword*.swift"
  - "**/SecureField*.swift"
  - ".cursor/skills/swiftui-security-ui/**"
---

# swiftui-security-ui

## Por que essa skill existe

Mesmo com cripto e Keychain perfeitos, uma UI mal feita pode vazar senhas por:

- Screenshot tirado pelo usuario (voluntario ou BugReport que captura a tela)
- Screen recording ativo durante unlock (familia/amigo capturando tela)
- App switcher (multitasking) mostrando a ultima tela (senha visivel)
- Clipboard acessivel por qualquer app em foreground
- Teclados terceiros (GBoard, SwiftKey) capturando o que o usuario digita
- iOS AutoFill do sistema oferecendo reuso da senha mestra em outros campos

O SafeBox precisa prevenir cada um desses vetores na camada de UI, complementando a seguranca das camadas inferiores.

## 1. Anti-screenshot / anti-screen-recording

### Estrategia

iOS nao tem API publica para bloquear screenshots em apps normais (so DRM content). Mitigacao:

1. Detectar screenshot => notificar usuario (`UIApplication.userDidTakeScreenshotNotification`)
2. Detectar screen recording => aplicar blur/obscure (`UIScreen.capturedDidChangeNotification`)
3. Ao ir para background => aplicar blur overlay (evita thumbnail vazar via app switcher)

### Implementacao

```swift
import SwiftUI
import UIKit
import Combine

@MainActor
final class ScreenPrivacyObserver: ObservableObject {
    @Published private(set) var isCapturing: Bool = false
    @Published private(set) var isInBackground: Bool = false
    @Published private(set) var screenshotTakenAt: Date? = nil

    private var cancellables = Set<AnyCancellable>()

    init() {
        let nc = NotificationCenter.default

        nc.publisher(for: UIApplication.userDidTakeScreenshotNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.screenshotTakenAt = Date()
            }
            .store(in: &cancellables)

        nc.publisher(for: UIScreen.capturedDidChangeNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.isCapturing = UIScreen.main.isCaptured
            }
            .store(in: &cancellables)

        nc.publisher(for: UIApplication.willResignActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.isInBackground = true
            }
            .store(in: &cancellables)

        nc.publisher(for: UIApplication.didBecomeActiveNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.isInBackground = false
            }
            .store(in: &cancellables)
    }
}

struct SensitiveContainer<Content: View>: View {
    @EnvironmentObject var privacy: ScreenPrivacyObserver
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack {
            content()
                .blur(radius: privacy.isCapturing || privacy.isInBackground ? 20 : 0)
                .allowsHitTesting(!(privacy.isCapturing || privacy.isInBackground))

            if privacy.isCapturing {
                Color(.systemBackground)
                    .overlay(
                        VStack(spacing: 12) {
                            Image(systemName: "eye.slash.fill").font(.largeTitle)
                            Text("Gravacao de tela detectada").font(.headline)
                            Text("Conteudo oculto enquanto a gravacao estiver ativa.")
                                .multilineTextAlignment(.center)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                    )
                    .ignoresSafeArea()
            }
        }
    }
}
```

### Uso

Envelopar TODA tela com conteudo sensivel (credenciais visiveis, campo de senha mestra em edicao, TOTP):

```swift
CredentialDetailView(credential: c)
    .modifier(SensitiveViewModifier())

struct SensitiveViewModifier: ViewModifier {
    @EnvironmentObject var privacy: ScreenPrivacyObserver
    func body(content: Content) -> some View {
        SensitiveContainer { content }
    }
}
```

### Regra de ouro

- Telas sensiveis (credencial, TOTP, senha-mestra): envelopadas
- Tela de welcome, about, help: nao precisam
- Se em duvida: envelopar (custo eh zero quando nao ha captura)

## 2. Campo de senha mestra seguro

```swift
struct MasterPasswordField: View {
    @Binding var password: String
    @FocusState private var isFocused: Bool

    var body: some View {
        SecureField("Senha mestra", text: $password)
            .textContentType(.password)  // iOS oferece salvar, mas NAO sugere usar autofill no SafeBox
            .submitLabel(.done)
            .autocorrectionDisabled(true)
            .textInputAutocapitalization(.never)
            .keyboardType(.asciiCapable)  // evita emoji/sugestao; senha e texto livre mas sem IME
            .focused($isFocused)
            .onChange(of: isFocused) { _, focused in
                // opcional: limpar clipboard quando usuario entra no campo
                if focused { ClipboardSanitizer.clearIfSensitive() }
            }
    }
}
```

### Decisoes

- `SecureField` (nao `TextField` com `.passwordField()`): iOS renderiza dots automaticamente, nao ecoa caractere
- `textContentType(.password)`: permite que iOS proponha salvar no Keychain (aceitavel)
- **NAO** usar `textContentType(.newPassword)` na tela de login: isso ativa gerador de senha, que nao faz sentido em login
- `autocorrectionDisabled`: impede que senha apareca em barra de sugestoes
- `textInputAutocapitalization(.never)`: nao capitalizar primeiro char
- `.keyboardType(.asciiCapable)`: impede teclado de emojis/sugestao agressiva; user ainda pode trocar teclado manualmente
- Teclados de 3rd party: iOS permite; SafeBox nao pode bloquear. Documentar no guia de usuario.

## 3. Auto-lock por inatividade

### Requisito

Apos X minutos sem interacao OU ir para background por mais de Y minutos, limpar chave AES em memoria e pedir unlock novamente.

### Parametros (v1)

- X (inatividade ativa): 10 min default, configuravel em Settings (min 1, max 60)
- Y (background): 30s para fundo breve (OK), > 30s bloqueia
- Ao destrancar device apos long lock: sempre re-pedir unlock (policy)

### Implementacao

```swift
@MainActor
final class SessionInactivityLock: ObservableObject {
    @Published var isLocked: Bool = true
    private var lastActivityAt: Date = Date()
    private var backgroundEnteredAt: Date?
    private var timer: Timer?

    var inactivityTimeoutSeconds: TimeInterval = 10 * 60
    var backgroundToleranceSeconds: TimeInterval = 30

    func recordActivity() {
        lastActivityAt = Date()
    }

    func applicationDidEnterBackground() {
        backgroundEnteredAt = Date()
    }

    func applicationDidBecomeActive() {
        if let bgAt = backgroundEnteredAt {
            let elapsed = Date().timeIntervalSince(bgAt)
            if elapsed > backgroundToleranceSeconds {
                lockNow()
            }
        }
        backgroundEnteredAt = nil
        startTimer()
    }

    func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                if Date().timeIntervalSince(self.lastActivityAt) > self.inactivityTimeoutSeconds {
                    self.lockNow()
                }
            }
        }
    }

    func lockNow() {
        CryptoVaultKeyStore.shared.clearInMemory()  // chave AES e zerada
        isLocked = true
    }
}
```

### Hook em todos os gestos

```swift
ContentView()
    .background(
        // Detectar qualquer toque na tela via UIKit
        TapRecorder(onTap: { sessionLock.recordActivity() })
    )
```

## 4. Clipboard com expiracao automatica

### Requisito

Usuario copia senha -> backup local lembra o conteudo -> clipboard limpa em 30s (ou se usuario copiar outra coisa antes).

### Implementacao

```swift
@MainActor
enum ClipboardSanitizer {
    private static let marker = "app.safebox.ios.clipboard-tag"
    static let defaultExpiry: TimeInterval = 30

    /// Copia com UIPasteboardOption e agenda limpeza condicional (apenas se conteudo ainda for o que copiamos).
    static func copyWithExpiry(_ value: String, expireAfter: TimeInterval = defaultExpiry) {
        // universalClipboard expiration: iOS 14+
        let expirationDate = Date().addingTimeInterval(expireAfter)
        UIPasteboard.general.setItems(
            [[UIPasteboard.typeAutomatic: value, "app.safebox.copied": Date().timeIntervalSince1970]],
            options: [
                .localOnly: true,               // NAO compartilhar com outros devices via Universal Clipboard
                .expirationDate: expirationDate
            ]
        )

        // Backup: agendar limpeza em Timer caso expirationDate nao funcione (paranoico)
        Task { [expireAfter] in
            try? await Task.sleep(nanoseconds: UInt64(expireAfter * 1_000_000_000))
            await clearIfStillOurs()
        }
    }

    static func clearIfStillOurs() async {
        let pb = UIPasteboard.general
        // Se o clipboard foi sobrescrito pelo usuario, nao mexer
        let items = pb.items
        if items.contains(where: { $0.keys.contains("app.safebox.copied") }) {
            pb.items = []
        }
    }

    static func clearIfSensitive() {
        // Chamar ao entrar em telas de senha-mestra, etc.
        clearMarkedOnly()
    }

    private static func clearMarkedOnly() {
        let pb = UIPasteboard.general
        if pb.items.contains(where: { $0.keys.contains("app.safebox.copied") }) {
            pb.items = []
        }
    }
}
```

### Usabilidade

- UI mostra indicador: "Senha copiada. Limpa em 30s."
- Botoes de copiar username/password/totp usam todos `copyWithExpiry`

## 5. Login e formularios: evitar AutoFill indevido

Em tela de login do SafeBox:

```swift
TextField("Email", text: $email)
    .textContentType(.emailAddress)

SecureField("Senha mestra", text: $password)
    .textContentType(.password)
```

`textContentType(.password)` aqui e desejavel: permite o sistema oferecer salvar a senha-mestra no iCloud Keychain do usuario (user choice; eles podem recusar). Isso nao interfere com o cofre do SafeBox, so da conveniencia na proxima vez que abrirem o app.

NAO usar `textContentType(.newPassword)` nesta tela: isso ativa gerador de senha.

## 6. Logs e debug view

### Proibido em Release

- `print("password: \(password)")` -- mesmo em debug e perigoso: debug builds tambem geram crashlogs
- `NSLog` com dados sensiveis
- UIKit `debugDescription` que inclua `password` como auto-mirror de struct

### OK

```swift
import OSLog

let logger = Logger(subsystem: "app.safebox.ios", category: "auth")

logger.info("Unlock attempted userId=\(userId, privacy: .private)")
logger.error("Unlock failed: \(reason, privacy: .public)")
```

- Sempre usar `privacy: .private` para qualquer ID/email/nome
- Nunca logar senha/conteudo do vault, nem mesmo hash parcial

## 7. Checklist de revisao de PR (UI)

- [ ] Toda tela sensivel (credencial, TOTP, senha-mestra, notas) esta envelopada com `SensitiveContainer`
- [ ] `SecureField` (nao `TextField`) usado para senha mestra e campos de senha em credenciais
- [ ] Campos de senha tem `autocorrectionDisabled`, `textInputAutocapitalization(.never)`, `keyboardType(.asciiCapable)` (ou equivalente)
- [ ] Copia de senha usa `ClipboardSanitizer.copyWithExpiry` com `.localOnly = true`
- [ ] Gestos registram atividade para auto-lock (nao deixar timer rodar enquanto user preenche form longo)
- [ ] Transicoes entre telas nao imprimem dados sensiveis via `print`
- [ ] OSLog usa `privacy: .private` para qualquer dado potencialmente sensivel
- [ ] Screenshots de teste nao mostram senha real (usar `demo-password`)
- [ ] App switcher thumbnail testado manualmente: esta blurada quando app em background
- [ ] Lock manual funciona: botao "Bloquear cofre" limpa chave em memoria imediatamente

## 8. Padroes a evitar

- NAO usar `.textSelection(.enabled)` em views que mostram senha em claro (a menos que seja o botao de revelar, com indicador claro)
- NAO usar `SharePreview`/`ShareLink` com conteudo do vault
- NAO passar dados sensiveis pelo `UIActivityViewController`
- NAO armazenar `@AppStorage` de flag que derive conteudo sensivel
- NAO conectar `@EnvironmentObject` com a chave AES; passe apenas referencias indiretas via servico

## 9. Testes sugeridos

### UI Tests

- Abrir credencial -> verificar que senha nao esta na Accessibility hierarchy em plaintext (usar `accessibilityLabel = "password field"` sem revelar valor)
- Toggle revelar senha -> valor aparece -> background do app -> voltar -> senha deve estar novamente obscurecida

### Snapshot tests

- Capturar snapshot de credencial SEM revelar: assert que texto da senha esta mascarado
- Capturar snapshot com screen-recording simulado: asset que overlay de blur aparece

### Manual

- Testar com screen recording ativo do iOS (ControlCenter -> Record) e verificar blur
- Testar clipboard: copiar senha -> abrir Notes -> colar -> esperar 30s -> tentar colar de novo -> nada
- Testar app switcher: entrar em credencial -> duplo-toque Home -> verificar que preview esta blurado

## 10. Referencias cruzadas

- `swift-keychain-secure` -- auto-lock triggers clear do Keychain in-memory
- `apple-compliance-ios` -- Screenshots para App Store nao podem mostrar dados reais
- `swift-autofill-extension` -- evitar copiar senha em extension; injetar direto via ASPasswordCredential
