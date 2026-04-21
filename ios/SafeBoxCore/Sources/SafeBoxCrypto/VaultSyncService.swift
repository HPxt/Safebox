import Foundation
#if canImport(Security)
import Security
#endif

public struct VaultSyncService: Sendable {
    private let remoteStore: VaultRemoteStoring
    private let codec: VaultEnvelopeCodec

    public init(remoteStore: VaultRemoteStoring, codec: VaultEnvelopeCodec = VaultEnvelopeCodec()) {
        self.remoteStore = remoteStore
        self.codec = codec
    }

    public func readVault(key: Data) async throws -> VaultReadResult {
        guard let record = try await remoteStore.fetchVault() else {
            throw VaultSyncError.emptyVault
        }

        try verifyDataHash(record: record)
        let envelope = try decodeEnvelope(from: record.encryptedData)
        let plaintextData = try codec.decrypt(envelope: envelope, key: key)
        let plaintext = try VaultPlaintextPayload(rawJSON: plaintextData)
        let folders = try await remoteStore.fetchFolders()
        return VaultReadResult(record: record, plaintext: plaintext, folders: folders)
    }

    public func writeVault(
        plaintext: VaultPlaintextPayload,
        key: Data,
        expectedVersion: Int?,
        nonce12: Data? = nil
    ) async throws -> VaultRecord {
        let nonce: Data
        if let nonce12 {
            nonce = nonce12
        } else {
            nonce = try randomNonce12()
        }
        let encryptedPayload = try plaintext.dataForWrite(strippingVersionFields: true)
        let envelope = try codec.encrypt(plaintextUTF8: encryptedPayload, key: key, nonce12: nonce)
        let envelopeJSON = try codec.canonicalEnvelopeJSON(envelope: envelope)
        let encryptedData = String(decoding: envelopeJSON, as: UTF8.self)
        let dataHash = try codec.dataHashHexLower(envelope: envelope)
        let payload = VaultWritePayload(
            encryptedData: encryptedData,
            dataHash: dataHash,
            expectedVersion: expectedVersion
        )

        if expectedVersion == nil {
            return try await remoteStore.createVault(payload)
        }
        return try await remoteStore.updateVault(payload)
    }

    public func handleWriteError(_ error: Error) throws {
        if let syncError = error as? VaultSyncError, syncError == .versionConflict {
            throw VaultSyncError.versionConflict
        }
        throw error
    }

    private func verifyDataHash(record: VaultRecord) throws {
        let computed = codec.dataHashHexLower(envelopeJSON: record.encryptedData)
        guard computed == record.dataHash else {
            throw VaultSyncError.tamperDetected
        }
    }

    private func decodeEnvelope(from encryptedData: String) throws -> VaultSnapshotV2Envelope {
        let data = Data(encryptedData.utf8)
        let envelope = try JSONDecoder().decode(VaultSnapshotV2Envelope.self, from: data)
        guard envelope.version == "vault-snapshot-v2" else {
            throw VaultSyncError.unsupportedEnvelope
        }
        return envelope
    }

    private func randomNonce12() throws -> Data {
        var nonce = Data(count: 12)
        try nonce.withUnsafeMutableBytes { buffer in
            guard let base = buffer.baseAddress else {
                throw VaultCryptoError.invalidNonceLength
            }
            #if canImport(Security)
            let status = SecRandomCopyBytes(kSecRandomDefault, 12, base)
            guard status == errSecSuccess else {
                throw VaultCryptoError.randomGenerationFailed
            }
            #else
            let bytes = (0..<12).map { _ in UInt8.random(in: UInt8.min...UInt8.max) }
            buffer.copyBytes(from: bytes)
            #endif
        }
        return nonce
    }
}
