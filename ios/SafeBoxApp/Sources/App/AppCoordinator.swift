import Foundation
import SafeBoxCrypto
import SwiftUI

@MainActor
final class AppCoordinator: ObservableObject {
    enum Phase: Equatable {
        case signedOut
        case locked
        case loading
        case unlocked
    }

    @Published var phase: Phase = .signedOut
    @Published var email = ""
    @Published var password = ""
    @Published var masterPassword = ""
    @Published var statusMessage = ""
    @Published var errorMessage: String?
    @Published var ultraWarning: String?
    @Published private(set) var vaultItems: [VaultItemSummary] = []
    @Published private(set) var folders: [FolderSummary] = []

    private let environment: SafeBoxAppEnvironment
    private var unlockedSession: UnlockedVaultSession?
    private var currentVault: VaultReadResult?

    init(environment: SafeBoxAppEnvironment) {
        self.environment = environment
    }

    func signIn() async {
        errorMessage = nil
        statusMessage = "Entrando com seguranca..."
        phase = .loading

        do {
            try await environment.auth.signIn(email: email, password: password)
            masterPassword = ""
            phase = .locked
        } catch {
            phase = .signedOut
            errorMessage = Self.message(for: error)
        }
    }

    func unlockVault() async {
        errorMessage = nil
        ultraWarning = nil
        statusMessage = "Desbloqueando cofre..."
        phase = .loading

        do {
            let unlockService = VaultUnlockService(
                profileProvider: environment.profileProvider,
                guardService: UnlockSessionGuard(kdfPipeline: environment.kdfPipeline)
            )
            let session = try await unlockService.unlock(masterPassword: masterPassword)
            unlockedSession = session
            ultraWarning = session.warning == .highResourceKdfWarning
                ? "Seu cofre usa ULTRA. Pode ser lento em alguns iPhones; recomendamos HIGH no mobile."
                : nil

            try await loadVault(using: session.key)
            phase = .unlocked
        } catch {
            unlockedSession = nil
            masterPassword = ""
            phase = .locked
            errorMessage = Self.message(for: error)
        }
    }

    func reloadVault() async {
        guard let key = unlockedSession?.key else {
            phase = .locked
            return
        }

        errorMessage = nil
        statusMessage = "Atualizando cofre..."
        phase = .loading

        do {
            try await loadVault(using: key)
            phase = .unlocked
        } catch {
            phase = .unlocked
            errorMessage = Self.message(for: error)
        }
    }

    func lock() {
        unlockedSession = nil
        currentVault = nil
        vaultItems = []
        folders = []
        masterPassword = ""
        phase = .locked
    }

    func signOut() async {
        try? await environment.auth.signOut()
        unlockedSession = nil
        currentVault = nil
        vaultItems = []
        folders = []
        email = ""
        password = ""
        masterPassword = ""
        phase = .signedOut
    }

    private func loadVault(using key: Data) async throws {
        let service = VaultSyncService(remoteStore: environment.vaultStore)
        let result = try await service.readVault(key: key)
        currentVault = result
        folders = result.folders
        vaultItems = try VaultItemSummary.decodeList(from: result.plaintext.rawJSON, folders: result.folders)
    }

    private static func message(for error: Error) -> String {
        if let appError = error as? SafeBoxAppError {
            return appError.localizedDescription
        }
        if let syncError = error as? VaultSyncError {
            switch syncError {
            case .missingKDFProfile:
                return "Nao encontramos a configuracao da sua senha-mestra. Configure pelo web e tente novamente."
            case .tamperDetected:
                return "A verificacao de integridade do cofre falhou. Recarregue antes de continuar."
            case .emptyVault:
                return "Seu cofre ainda esta vazio."
            case .unsupportedEnvelope:
                return "Este formato de cofre ainda nao e suportado no iOS."
            case .invalidPlaintext:
                return "O conteudo do cofre nao pode ser lido com seguranca."
            case .versionConflict:
                return "O cofre mudou em outro dispositivo. Recarregue antes de salvar."
            case .folderLoadFailed:
                return "Nao foi possivel carregar suas pastas agora."
            }
        }
        if let cryptoError = error as? VaultCryptoError {
            switch cryptoError {
            case .invalidMasterPassword:
                return "Senha-mestra incorreta."
            case .keyRotationDetected:
                return "Sua senha-mestra foi alterada em outro dispositivo. Desbloqueie novamente."
            default:
                return "Nao foi possivel desbloquear o cofre com seguranca."
            }
        }
        return "Algo saiu do trilho. Tente novamente em instantes."
    }
}
