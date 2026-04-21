import Foundation
import XCTest
@testable import SafeBoxCrypto

final class VaultEnvelopeCodecTests: XCTestCase {
    func testDataHashMatchesAllAEADVectors() throws {
        let vectors = try TestVectorsLoader.load()
        let codec = VaultEnvelopeCodec()

        for vector in vectors.aeadVectors {
            let envelope = VaultSnapshotV2Envelope(
                nonce: vector.nonceBase64,
                encrypted: vector.encryptedBase64
            )
            let hash = try codec.dataHashHexLower(envelope: envelope)
            XCTAssertEqual(hash, vector.dataHashHexLower, "Hash mismatch for vector \(vector.name)")
        }
    }

    func testDecryptMatchesPlaintextForAllAEADVectors() throws {
        let vectors = try TestVectorsLoader.load()
        let codec = VaultEnvelopeCodec()

        let kdfByName = Dictionary(uniqueKeysWithValues: vectors.kdfVectors.map { ($0.name, $0) })
        for vector in vectors.aeadVectors {
            guard let kdf = kdfByName[vector.kdfVectorRef] else {
                XCTFail("Missing KDF vector \(vector.kdfVectorRef)")
                continue
            }
            let key = try XCTUnwrap(Data(hex: kdf.derivedKeyHex))
            let envelope = VaultSnapshotV2Envelope(
                nonce: vector.nonceBase64,
                encrypted: vector.encryptedBase64
            )
            let plaintext = try codec.decrypt(envelope: envelope, key: key)
            XCTAssertEqual(String(decoding: plaintext, as: UTF8.self), vector.plaintextJsonUtf8)
        }
    }

    func testEncryptMatchesWebCryptoPayloadForAllAEADVectors() throws {
        let vectors = try TestVectorsLoader.load()
        let codec = VaultEnvelopeCodec()

        let kdfByName = Dictionary(uniqueKeysWithValues: vectors.kdfVectors.map { ($0.name, $0) })
        for vector in vectors.aeadVectors {
            guard let kdf = kdfByName[vector.kdfVectorRef] else {
                XCTFail("Missing KDF vector \(vector.kdfVectorRef)")
                continue
            }
            let key = try XCTUnwrap(Data(hex: kdf.derivedKeyHex))
            let nonce = try XCTUnwrap(Data(base64Encoded: vector.nonceBase64))
            let envelope = try codec.encrypt(
                plaintextUTF8: Data(vector.plaintextJsonUtf8.utf8),
                key: key,
                nonce12: nonce
            )

            XCTAssertEqual(envelope.nonce, vector.nonceBase64, "Nonce mismatch for vector \(vector.name)")
            XCTAssertEqual(envelope.encrypted, vector.encryptedBase64, "Ciphertext mismatch for vector \(vector.name)")
            XCTAssertEqual(
                String(decoding: try codec.canonicalEnvelopeJSON(envelope: envelope), as: UTF8.self),
                vector.canonicalEnvelopeJsonUtf8,
                "Canonical envelope JSON mismatch for vector \(vector.name)"
            )
            XCTAssertEqual(
                try codec.dataHashHexLower(envelope: envelope),
                vector.dataHashHexLower,
                "dataHash mismatch after encrypt for vector \(vector.name)"
            )
        }
    }
}

private struct TestVectorsFile: Decodable {
    let kdfVectors: [KDFVector]
    let aeadVectors: [AEADVector]
}

private struct KDFVector: Decodable {
    let name: String
    let derivedKeyHex: String
}

private struct AEADVector: Decodable {
    let name: String
    let kdfVectorRef: String
    let nonceBase64: String
    let encryptedBase64: String
    let plaintextJsonUtf8: String
    let canonicalEnvelopeJsonUtf8: String
    let dataHashHexLower: String
}

private enum TestVectorsLoader {
    static func load() throws -> TestVectorsFile {
        let fileURL = try XCTUnwrap(
            Bundle.module.url(forResource: "test-vectors", withExtension: "json")
        )
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(TestVectorsFile.self, from: data)
    }
}

