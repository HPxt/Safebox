import Foundation
import SafeBoxCrypto

protocol AuthSessionProviding: Sendable {
    func signIn(email: String, password: String) async throws
    func signOut() async throws
}

struct SafeBoxAppEnvironment: Sendable {
    let auth: any AuthSessionProviding
    let profileProvider: any UserKDFProfileProviding
    let vaultStore: any VaultRemoteStoring
    let kdfPipeline: KDFPipeline

    static var unconfigured: SafeBoxAppEnvironment {
        let auth = UnconfiguredAuthSessionProvider()
        let profile = FallbackUserKDFProfileProvider(providers: [UnconfiguredKDFProfileProvider()])
        let vault = FallbackVaultRemoteStore(primary: UnconfiguredVaultRemoteStore())
        return SafeBoxAppEnvironment(
            auth: auth,
            profileProvider: profile,
            vaultStore: vault,
            kdfPipeline: KDFPipeline(argon2Provider: LibArgon2Provider())
        )
    }

    static func production(supabaseURL: URL, supabaseAnonKey: String, backendURL: URL) -> SafeBoxAppEnvironment {
        let sessionStore = SafeBoxSessionStore()
        let auth = SupabasePasswordAuthProvider(
            supabaseURL: supabaseURL,
            anonKey: supabaseAnonKey,
            sessionStore: sessionStore
        )
        let usersProfile = SupabaseUsersKDFProfileProvider(
            supabaseURL: supabaseURL,
            anonKey: supabaseAnonKey,
            sessionStore: sessionStore
        )
        let metadataProfile = SupabaseMetadataKDFProfileProvider(sessionStore: sessionStore)
        let backendVault = BackendVaultRemoteStore(backendURL: backendURL, sessionStore: sessionStore)

        return SafeBoxAppEnvironment(
            auth: auth,
            profileProvider: FallbackUserKDFProfileProvider(providers: [usersProfile, metadataProfile]),
            vaultStore: FallbackVaultRemoteStore(primary: backendVault),
            kdfPipeline: KDFPipeline(argon2Provider: LibArgon2Provider())
        )
    }
}

enum SafeBoxAppError: LocalizedError, Equatable {
    case missingProductionAdapter(String)

    var errorDescription: String? {
        switch self {
        case let .missingProductionAdapter(name):
            return "Adapter de producao ainda nao configurado: \(name)."
        }
    }
}

private struct UnconfiguredAuthSessionProvider: AuthSessionProviding {
    func signIn(email: String, password: String) async throws {
        throw SafeBoxAppError.missingProductionAdapter("AuthSessionProvider")
    }

    func signOut() async throws {}
}

private struct UnconfiguredKDFProfileProvider: UserKDFProfileProviding {
    func fetchKDFProfile() async throws -> UserKDFProfile? {
        throw SafeBoxAppError.missingProductionAdapter("UserKDFProfileProvider")
    }
}

private struct UnconfiguredVaultRemoteStore: VaultRemoteStoring {
    func fetchVault() async throws -> VaultRecord? {
        throw SafeBoxAppError.missingProductionAdapter("VaultRemoteStore")
    }

    func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        throw SafeBoxAppError.missingProductionAdapter("VaultRemoteStore")
    }

    func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        throw SafeBoxAppError.missingProductionAdapter("VaultRemoteStore")
    }

    func fetchFolders() async throws -> [FolderSummary] {
        throw SafeBoxAppError.missingProductionAdapter("VaultRemoteStore")
    }
}
