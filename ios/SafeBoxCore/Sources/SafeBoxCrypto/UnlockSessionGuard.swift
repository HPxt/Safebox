import Foundation

public struct UnlockSessionGuard: Sendable {
    private let kdfPipeline: KDFPipeline

    public init(kdfPipeline: KDFPipeline) {
        self.kdfPipeline = kdfPipeline
    }

    public func verifyMasterPassword(
        password: String,
        saltBase64: String,
        params: KDFParams,
        expectedKeyHashBase64: String
    ) throws -> Data {
        let key = try kdfPipeline.deriveVaultKey(password: password, saltBase64: saltBase64, params: params)
        let computed = kdfPipeline.keyHashBase64(rawKey: key)
        guard computed == expectedKeyHashBase64 else {
            throw VaultCryptoError.invalidMasterPassword
        }
        return key
    }

    public func needsReunlock(cachedKey: Data, latestKeyHashBase64: String) -> Bool {
        kdfPipeline.keyHashBase64(rawKey: cachedKey) != latestKeyHashBase64
    }
}
