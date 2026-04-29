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

    /// Tempo sem interação antes de relock automático (somente com cofre desbloqueado).
    static let vaultInactivityTimeout: TimeInterval = 15 * 60

    /// Grant de leitura do índice AutoFill no App Group (E7.E); renovado com interação e ao desbloquear.
    static let autoFillExtensionGrantTTL: TimeInterval = 5 * 60

    @Published var phase: Phase = .signedOut
    @Published var email = ""
    @Published var password = ""
    @Published var masterPassword = ""
    @Published var statusMessage = ""
    @Published var errorMessage: String?
    @Published var ultraWarning: String?
    @Published private(set) var vaultItems: [VaultItemSummary] = []
    @Published private(set) var folders: [FolderSummary] = []
    @Published private(set) var biometricUnlockAvailable = false

    private let environment: SafeBoxAppEnvironment
    private let autoFillSessionStore: AutoFillSharedSessionStore
    private let autoFillCandidatesStore: AutoFillSharedCandidatesStore
    private let credentialDonation: CredentialIdentityDonating
    private let biometricVaultKeyStore: BiometricVaultKeyStoring
    private var sessionMachine = SessionStateMachine()
    private let lockPolicy = LockPolicy(inactivityTimeout: Self.vaultInactivityTimeout)
    private var lastInteractionAt: Date?
    private var unlockedSession: UnlockedVaultSession?
    private var currentVault: VaultReadResult?

    init(
        environment: SafeBoxAppEnvironment,
        autoFillSessionStore: AutoFillSharedSessionStore = AutoFillSharedSessionStore(
            appGroupIdentifier: AutoFillBridgeConstants.appGroupID
        ),
        autoFillCandidatesStore: AutoFillSharedCandidatesStore = AutoFillSharedCandidatesStore(
            appGroupIdentifier: AutoFillBridgeConstants.appGroupID
        ),
        credentialDonation: CredentialIdentityDonating = CredentialIdentityDonationService(),
        biometricVaultKeyStore: BiometricVaultKeyStoring = KeychainBiometricVaultKeyStore()
    ) {
        self.environment = environment
        self.autoFillSessionStore = autoFillSessionStore
        self.autoFillCandidatesStore = autoFillCandidatesStore
        self.credentialDonation = credentialDonation
        self.biometricVaultKeyStore = biometricVaultKeyStore
        self.biometricUnlockAvailable = Self.isBiometricUnlockAvailable(using: biometricVaultKeyStore)
    }

    /// Normaliza `relockRequired` / rotação / biometria para `signedInLocked` antes de novo `unlockRequested`.
    func prepareUnlockSurface() {
        switch sessionMachine.state {
        case .relockRequired, .keyRotationDetected, .biometryInvalidated:
            _ = try? sessionMachine.handle(.relockAcknowledged)
        default:
            break
        }
        biometricUnlockAvailable = Self.isBiometricUnlockAvailable(using: biometricVaultKeyStore)
        syncPhaseFromSession()
    }

    func recordUserInteraction() {
        guard sessionMachine.state == .unlocked else { return }
        lastInteractionAt = Date()
        try? refreshAutoFillGrantOnly()
    }

    func handleSceneBecameActive() {
        checkInactivityLock()
        if sessionMachine.state == .unlocked {
            recordUserInteraction()
        }
    }

    func handleSceneMovedToBackground() {
        relockUnlockedVaultOnBackground()
    }

    func checkInactivityLock() {
        guard sessionMachine.state == .unlocked else { return }
        guard lockPolicy.shouldRelock(trigger: .inactivityCheck(lastInteractionAt: lastInteractionAt)) else {
            return
        }
        clearVaultDataKeepingAuthSession()
        _ = try? sessionMachine.handle(.inactivityTimeout)
        syncPhaseFromSession()
    }

    private func relockUnlockedVaultOnBackground() {
        guard sessionMachine.state == .unlocked else { return }
        clearVaultDataKeepingAuthSession()
        _ = try? sessionMachine.handle(.appDidEnterBackground)
        syncPhaseFromSession()
    }

    private func clearVaultDataKeepingAuthSession() {
        revokeAutoFillExtensionAccess()
        unlockedSession = nil
        currentVault = nil
        vaultItems = []
        folders = []
        masterPassword = ""
        ultraWarning = nil
        lastInteractionAt = nil
    }

    /// E7.E: remove grant, índice compartilhado e identidades do QuickType (fail-closed na extensão).
    private func revokeAutoFillExtensionAccess() {
        try? autoFillSessionStore.deleteState()
        try? autoFillCandidatesStore.clearAll()
        Task { @MainActor in
            try? await credentialDonation.removeAll()
        }
    }

    private func refreshAutoFillGrantOnly() throws {
        guard sessionMachine.state == .unlocked else { return }
        let until = Date().addingTimeInterval(Self.autoFillExtensionGrantTTL)
        try autoFillSessionStore.saveState(
            AutoFillSharedHostSessionState(vaultUnlocked: true, grantExpiresAt: until)
        )
    }

    private func republishAutoFillBridge() async throws {
        let candidates = vaultItems.compactMap { $0.autoFillCredentialCandidate() }
        let until = Date().addingTimeInterval(Self.autoFillExtensionGrantTTL)
        try autoFillSessionStore.saveState(
            AutoFillSharedHostSessionState(vaultUnlocked: true, grantExpiresAt: until)
        )
        try autoFillCandidatesStore.replaceCandidates(candidates)
        try await credentialDonation.replaceAll(
            candidates: candidates,
            domain: AutoFillBridgeConstants.associatedDomainLabel
        )
    }

    private func republishAutoFillBridgeIgnoringErrors() async {
        do {
            try await republishAutoFillBridge()
        } catch {
            // App Group / capability ausente (ex.: simulador) — cofre no app segue válido.
        }
    }

    private func syncPhaseFromSession() {
        switch sessionMachine.authStatus {
        case .signedOut:
            phase = .signedOut
        case .expired:
            phase = .signedOut
        case .signedIn:
            switch sessionMachine.vaultStatus {
            case .unlocking:
                phase = .loading
            case .unlocked:
                phase = .unlocked
            case .locked, .relockRequired:
                phase = .locked
            }
        }
    }

    func signIn() async {
        errorMessage = nil
        statusMessage = "Entrando com seguranca..."
        phase = .loading

        do {
            try await environment.auth.signIn(email: email, password: password)
            masterPassword = ""
            _ = try sessionMachine.handle(.loginSucceeded)
            syncPhaseFromSession()
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
            try sessionMachine.handle(.unlockRequested)
            syncPhaseFromSession()
        } catch {
            masterPassword = ""
            syncPhaseFromSession()
            errorMessage = "Nao foi possivel iniciar o desbloqueio. Volte e tente novamente."
            return
        }

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
            do {
                try sessionMachine.handle(.unlockSucceeded)
            } catch {
                clearVaultDataKeepingAuthSession()
                _ = try? sessionMachine.handle(.unlockFailed)
                syncPhaseFromSession()
                errorMessage = "Estado da sessao inconsistente apos carregar o cofre. Tente desbloquear novamente."
                return
            }
            lastInteractionAt = Date()
            biometricUnlockAvailable = Self.isBiometricUnlockAvailable(using: biometricVaultKeyStore)
            syncPhaseFromSession()
            await republishAutoFillBridgeIgnoringErrors()
        } catch {
            unlockedSession = nil
            masterPassword = ""
            if Self.isAuthSessionExpired(error) {
                handleAuthSessionExpired()
            } else if let crypto = error as? VaultCryptoError, case .keyRotationDetected = crypto {
                try? biometricVaultKeyStore.deleteVaultKey()
                _ = try? sessionMachine.handle(.keyRotationDetected)
            } else {
                _ = try? sessionMachine.handle(.unlockFailed)
            }
            syncPhaseFromSession()
            errorMessage = Self.message(for: error)
        }
    }

    func unlockVaultWithBiometrics() async {
        errorMessage = nil
        ultraWarning = nil
        statusMessage = "Validando biometria..."
        phase = .loading

        do {
            try sessionMachine.handle(.unlockRequested)
            syncPhaseFromSession()
        } catch {
            syncPhaseFromSession()
            errorMessage = "Nao foi possivel iniciar o desbloqueio por biometria."
            return
        }

        do {
            guard let profile = try await environment.profileProvider.fetchKDFProfile() else {
                throw VaultSyncError.missingKDFProfile
            }
            let key = try await biometricVaultKeyStore.loadVaultKey(
                localizedReason: "Desbloquear seu cofre SafeBox"
            )
            let computedHash = environment.kdfPipeline.keyHashBase64(rawKey: key)
            guard computedHash == profile.keyHashBase64 else {
                try? biometricVaultKeyStore.deleteVaultKey()
                throw VaultCryptoError.keyRotationDetected
            }

            let policy = MobileKDFPolicy()
            let level = try policy.parseLevel(profile.params.level)
            let warning = policy.preUnlockWarning(for: level)
            let session = UnlockedVaultSession(
                key: key,
                keyHashBase64: profile.keyHashBase64,
                kdfParams: profile.params,
                kdfLevel: level,
                warning: warning
            )
            unlockedSession = session
            ultraWarning = warning == .highResourceKdfWarning
                ? "Seu cofre usa ULTRA. Pode ser lento em alguns iPhones; recomendamos HIGH no mobile."
                : nil

            try await loadVault(using: key)
            try sessionMachine.handle(.unlockSucceeded)
            lastInteractionAt = Date()
            syncPhaseFromSession()
            await republishAutoFillBridgeIgnoringErrors()
        } catch {
            unlockedSession = nil
            masterPassword = ""
            if Self.isAuthSessionExpired(error) {
                handleAuthSessionExpired()
            } else if let biometricError = error as? BiometricVaultKeyStoreError,
                      biometricError == .biometryInvalidated {
                try? biometricVaultKeyStore.deleteVaultKey()
                _ = try? sessionMachine.handle(.biometryInvalidated)
            } else if let crypto = error as? VaultCryptoError, case .keyRotationDetected = crypto {
                try? biometricVaultKeyStore.deleteVaultKey()
                _ = try? sessionMachine.handle(.keyRotationDetected)
            } else {
                _ = try? sessionMachine.handle(.unlockFailed)
            }
            biometricUnlockAvailable = Self.isBiometricUnlockAvailable(using: biometricVaultKeyStore)
            syncPhaseFromSession()
            errorMessage = Self.message(for: error)
        }
    }

    func enableBiometricUnlock() {
        guard let key = unlockedSession?.key else {
            errorMessage = "Desbloqueie o cofre com a senha-mestra antes de ativar a biometria."
            return
        }

        do {
            try biometricVaultKeyStore.saveVaultKey(key)
            biometricUnlockAvailable = Self.isBiometricUnlockAvailable(using: biometricVaultKeyStore)
            statusMessage = "Biometria ativada para este aparelho."
            errorMessage = nil
        } catch {
            biometricUnlockAvailable = false
            errorMessage = Self.message(for: error)
        }
    }

    func disableBiometricUnlock() {
        do {
            try biometricVaultKeyStore.deleteVaultKey()
            biometricUnlockAvailable = false
            statusMessage = "Biometria desativada neste aparelho."
            errorMessage = nil
        } catch {
            errorMessage = Self.message(for: error)
        }
    }

    func reloadVault() async {
        guard let key = unlockedSession?.key else {
            syncPhaseFromSession()
            return
        }

        errorMessage = nil
        statusMessage = "Atualizando cofre..."
        phase = .loading

        do {
            try await loadVault(using: key)
            syncPhaseFromSession()
            await republishAutoFillBridgeIgnoringErrors()
        } catch {
            if Self.isAuthSessionExpired(error) {
                handleAuthSessionExpired()
            } else if let crypto = error as? VaultCryptoError, case .keyRotationDetected = crypto {
                clearVaultDataKeepingAuthSession()
                try? biometricVaultKeyStore.deleteVaultKey()
                _ = try? sessionMachine.handle(.keyRotationDetected)
                syncPhaseFromSession()
            } else {
                syncPhaseFromSession()
            }
            errorMessage = Self.message(for: error)
        }
    }

    func draftForEditing(itemID: String) -> VaultCredentialDraft? {
        guard let currentVault else { return nil }
        return try? currentVault.plaintext.credentialDraft(id: itemID)
    }

    func saveCredential(_ draft: VaultCredentialDraft) async {
        guard draft.isValidForSave else {
            errorMessage = "Informe pelo menos um titulo e uma senha."
            return
        }
        guard let key = unlockedSession?.key else {
            errorMessage = "Desbloqueie o cofre antes de salvar."
            syncPhaseFromSession()
            return
        }

        errorMessage = nil
        statusMessage = "Salvando item..."
        phase = .loading

        do {
            let basePlaintext = try currentVault?.plaintext ?? VaultPlaintextPayload(jsonString: "[]")
            var draftForWrite = draft
            if draftForWrite.userId.isEmpty, let userID = try environment.auth.currentUserID() {
                draftForWrite.userId = userID
            }
            let updatedPlaintext = try basePlaintext.upsertingCredential(draftForWrite)
            let service = VaultSyncService(remoteStore: environment.vaultStore)
            _ = try await service.writeVault(
                plaintext: updatedPlaintext,
                key: key,
                expectedVersion: currentVault?.record.version
            )
            try await loadVault(using: key)
            recordUserInteraction()
            syncPhaseFromSession()
            await republishAutoFillBridgeIgnoringErrors()
        } catch {
            if Self.isAuthSessionExpired(error) {
                handleAuthSessionExpired()
            } else if let syncError = error as? VaultSyncError, syncError == .versionConflict {
                syncPhaseFromSession()
            } else {
                syncPhaseFromSession()
            }
            errorMessage = Self.message(for: error)
        }
    }

    func deleteCredential(id: String) async {
        guard let key = unlockedSession?.key, let currentVault else {
            errorMessage = "Desbloqueie o cofre antes de excluir."
            syncPhaseFromSession()
            return
        }

        errorMessage = nil
        statusMessage = "Excluindo item..."
        phase = .loading

        do {
            let updatedPlaintext = try currentVault.plaintext.deletingCredential(id: id)
            let service = VaultSyncService(remoteStore: environment.vaultStore)
            _ = try await service.writeVault(
                plaintext: updatedPlaintext,
                key: key,
                expectedVersion: currentVault.record.version
            )
            try await loadVault(using: key)
            recordUserInteraction()
            syncPhaseFromSession()
            await republishAutoFillBridgeIgnoringErrors()
        } catch {
            if Self.isAuthSessionExpired(error) {
                handleAuthSessionExpired()
            } else {
                syncPhaseFromSession()
            }
            errorMessage = Self.message(for: error)
        }
    }

    func lock() {
        guard sessionMachine.state == .unlocked else { return }
        clearVaultDataKeepingAuthSession()
        _ = try? sessionMachine.handle(.vaultLockRequested)
        syncPhaseFromSession()
    }

    func signOut() async {
        revokeAutoFillExtensionAccess()
        try? biometricVaultKeyStore.deleteVaultKey()
        _ = try? sessionMachine.handle(.logoutRequested)
        try? await environment.auth.signOut()
        unlockedSession = nil
        currentVault = nil
        vaultItems = []
        folders = []
        email = ""
        password = ""
        masterPassword = ""
        lastInteractionAt = nil
        ultraWarning = nil
        errorMessage = nil
        biometricUnlockAvailable = false
        if sessionMachine.state != .signedOut {
            sessionMachine = SessionStateMachine(initialState: .signedOut)
        }
        syncPhaseFromSession()
    }

    private func loadVault(using key: Data) async throws {
        let service = VaultSyncService(remoteStore: environment.vaultStore)
        let result = try await service.readVault(key: key)
        currentVault = result
        folders = result.folders
        vaultItems = try VaultItemSummary.decodeList(from: result.plaintext.rawJSON, folders: result.folders)
    }

    private func handleAuthSessionExpired() {
        clearVaultDataKeepingAuthSession()
        try? biometricVaultKeyStore.deleteVaultKey()
        password = ""
        masterPassword = ""
        biometricUnlockAvailable = false
        _ = try? sessionMachine.handle(.authSessionExpired)
        syncPhaseFromSession()
    }

    private static func message(for error: Error) -> String {
        if let appError = error as? SafeBoxAppError {
            return appError.localizedDescription
        }
        if let biometricError = error as? BiometricVaultKeyStoreError {
            switch biometricError {
            case .unavailable:
                return "Biometria indisponivel. Use sua senha-mestra."
            case .authenticationFailed:
                return "Nao foi possivel validar a biometria. Use sua senha-mestra."
            case .biometryInvalidated:
                return "Sua biometria mudou neste aparelho. Desbloqueie com a senha-mestra."
            case .keychainFailure:
                return "Nao foi possivel acessar o desbloqueio por biometria agora."
            }
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

    private static func isAuthSessionExpired(_ error: Error) -> Bool {
        error as? SafeBoxAppError == .authSessionExpired
    }

    private static func isBiometricUnlockAvailable(using store: BiometricVaultKeyStoring) -> Bool {
        store.canAttemptBiometricUnlock() && store.hasStoredVaultKey()
    }
}

private enum AutoFillBridgeConstants {
    static let appGroupID = "group.app.safebox.ios.shared"
    static let associatedDomainLabel = "safebox.app"
}
