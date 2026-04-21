import Crypto
import Foundation

public struct VaultEnvelopeCodec: Sendable {
    public init() {}

    public func encrypt(plaintextUTF8: Data, key: Data, nonce12: Data) throws -> VaultSnapshotV2Envelope {
        guard nonce12.count == 12 else {
            throw VaultCryptoError.invalidNonceLength
        }
        let symmetricKey = SymmetricKey(data: key)
        let nonce = try AES.GCM.Nonce(data: nonce12)
        let sealed = try AES.GCM.seal(plaintextUTF8, using: symmetricKey, nonce: nonce)
        let webCryptoPayload = sealed.ciphertext + sealed.tag

        return VaultSnapshotV2Envelope(
            nonce: nonce12.base64EncodedString(),
            encrypted: webCryptoPayload.base64EncodedString()
        )
    }

    public func decrypt(envelope: VaultSnapshotV2Envelope, key: Data) throws -> Data {
        guard envelope.version == "vault-snapshot-v2" else {
            throw VaultCryptoError.invalidEnvelopeVersion
        }
        guard let nonceData = Data(base64Encoded: envelope.nonce),
              nonceData.count == 12,
              let encryptedData = Data(base64Encoded: envelope.encrypted) else {
            throw VaultCryptoError.invalidBase64
        }

        let symmetricKey = SymmetricKey(data: key)
        let nonce = try AES.GCM.Nonce(data: nonceData)
        guard encryptedData.count >= 16 else {
            throw VaultCryptoError.invalidCiphertext
        }
        let tagStart = encryptedData.count - 16
        let ciphertext = encryptedData.prefix(tagStart)
        let tag = encryptedData.suffix(16)
        let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        return try AES.GCM.open(box, using: symmetricKey)
    }

    public func canonicalEnvelopeJSON(envelope: VaultSnapshotV2Envelope) throws -> Data {
        // Fixed order must remain exactly: version, nonce, encrypted.
        let json = "{\"version\":\"\(escapeJSON(envelope.version))\",\"nonce\":\"\(escapeJSON(envelope.nonce))\",\"encrypted\":\"\(escapeJSON(envelope.encrypted))\"}"
        return Data(json.utf8)
    }

    public func dataHashHexLower(envelope: VaultSnapshotV2Envelope) throws -> String {
        let canonical = try canonicalEnvelopeJSON(envelope: envelope)
        return Data(SHA256.hash(data: canonical)).map { String(format: "%02x", $0) }.joined()
    }

    private func escapeJSON(_ value: String) -> String {
        var escaped = ""
        escaped.reserveCapacity(value.count)
        for scalar in value.unicodeScalars {
            switch scalar {
            case "\"":
                escaped.append("\\\"")
            case "\\":
                escaped.append("\\\\")
            case "\u{08}":
                escaped.append("\\b")
            case "\u{0C}":
                escaped.append("\\f")
            case "\n":
                escaped.append("\\n")
            case "\r":
                escaped.append("\\r")
            case "\t":
                escaped.append("\\t")
            default:
                if scalar.value < 0x20 {
                    escaped.append(String(format: "\\u%04x", scalar.value))
                } else {
                    escaped.append(String(scalar))
                }
            }
        }
        return escaped
    }
}
