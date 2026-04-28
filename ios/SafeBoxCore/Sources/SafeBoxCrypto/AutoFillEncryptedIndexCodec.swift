import Crypto
import Foundation

public struct AutoFillEncryptedIndexEnvelope: Codable, Sendable, Equatable {
    public let version: String
    public let nonce: String
    public let encrypted: String

    public init(version: String = "autofill-index-v1", nonce: String, encrypted: String) {
        self.version = version
        self.nonce = nonce
        self.encrypted = encrypted
    }
}

/// Criptografa o indice compartilhado com a extensao AutoFill.
///
/// O host deriva uma chave de indice a partir da chave do cofre ja desbloqueada.
/// A extensao so deve receber essa chave por Keychain compartilhado protegido por
/// biometria, validado em device no gate Mac/Xcode Cloud.
public struct AutoFillEncryptedIndexCodec: Sendable {
    public static let version = "autofill-index-v1"
    private static let hkdfInfo = Data("safebox-autofill-index-v1".utf8)

    public init() {}

    public func encrypt(
        candidates: [AutoFillCredentialCandidate],
        vaultKey: Data,
        nonce12: Data
    ) throws -> AutoFillEncryptedIndexEnvelope {
        guard vaultKey.count == 32 else {
            throw VaultCryptoError.invalidKeyLength
        }
        guard nonce12.count == 12 else {
            throw VaultCryptoError.invalidNonceLength
        }

        let plaintext = try JSONEncoder().encode(candidates)
        let indexKey = deriveIndexKey(vaultKey: vaultKey)
        let nonce = try AES.GCM.Nonce(data: nonce12)
        let sealed = try AES.GCM.seal(plaintext, using: indexKey, nonce: nonce)
        let wirePayload = sealed.ciphertext + sealed.tag

        return AutoFillEncryptedIndexEnvelope(
            nonce: nonce12.base64EncodedString(),
            encrypted: wirePayload.base64EncodedString()
        )
    }

    public func decrypt(
        envelope: AutoFillEncryptedIndexEnvelope,
        vaultKey: Data
    ) throws -> [AutoFillCredentialCandidate] {
        guard envelope.version == Self.version else {
            throw VaultCryptoError.invalidEnvelopeVersion
        }
        guard vaultKey.count == 32 else {
            throw VaultCryptoError.invalidKeyLength
        }
        guard let nonceData = Data(base64Encoded: envelope.nonce),
              nonceData.count == 12,
              let encryptedData = Data(base64Encoded: envelope.encrypted) else {
            throw VaultCryptoError.invalidBase64
        }
        guard encryptedData.count >= 16 else {
            throw VaultCryptoError.invalidCiphertext
        }

        let tagStart = encryptedData.count - 16
        let ciphertext = encryptedData.prefix(tagStart)
        let tag = encryptedData.suffix(16)
        let nonce = try AES.GCM.Nonce(data: nonceData)
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        let plaintext = try AES.GCM.open(sealedBox, using: deriveIndexKey(vaultKey: vaultKey))
        return try JSONDecoder().decode([AutoFillCredentialCandidate].self, from: plaintext)
    }

    private func deriveIndexKey(vaultKey: Data) -> SymmetricKey {
        HKDF<SHA256>.deriveKey(
            inputKeyMaterial: SymmetricKey(data: vaultKey),
            salt: Data(),
            info: Self.hkdfInfo,
            outputByteCount: 32
        )
    }
}
