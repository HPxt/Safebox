import Foundation

public struct VaultUnlockService: Sendable {
    private let profileProvider: UserKDFProfileProviding
    private let guardService: UnlockSessionGuard
    private let mobilePolicy: MobileKDFPolicy

    public init(
        profileProvider: UserKDFProfileProviding,
        guardService: UnlockSessionGuard,
        mobilePolicy: MobileKDFPolicy = MobileKDFPolicy()
    ) {
        self.profileProvider = profileProvider
        self.guardService = guardService
        self.mobilePolicy = mobilePolicy
    }

    public func unlock(masterPassword: String) async throws -> UnlockedVaultSession {
        guard let profile = try await profileProvider.fetchKDFProfile() else {
            throw VaultSyncError.missingKDFProfile
        }

        let level = try mobilePolicy.parseLevel(profile.params.level)
        guard mobilePolicy.isSupportedForUnlock(level: level) else {
            throw VaultCryptoError.kdfPolicyFailure(.unsupportedConfigurationForMobile)
        }

        let key = try guardService.verifyMasterPassword(
            password: masterPassword,
            saltBase64: profile.saltBase64,
            params: profile.params,
            expectedKeyHashBase64: profile.keyHashBase64
        )

        return UnlockedVaultSession(
            key: key,
            keyHashBase64: profile.keyHashBase64,
            kdfParams: profile.params,
            kdfLevel: level,
            warning: mobilePolicy.preUnlockWarning(for: level)
        )
    }

    public func needsReunlock(cachedKey: Data, latestKeyHashBase64: String) -> Bool {
        guardService.needsReunlock(cachedKey: cachedKey, latestKeyHashBase64: latestKeyHashBase64)
    }
}
