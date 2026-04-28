import XCTest
@testable import SafeBoxCrypto

final class AutoFillEncryptedIndexCodecTests: XCTestCase {
    private let codec = AutoFillEncryptedIndexCodec()
    private let vaultKey = Data((0..<32).map { UInt8($0) })
    private let nonce = Data((100..<112).map { UInt8($0) })
    private let candidates = [
        AutoFillCredentialCandidate(
            id: "credential-1",
            serviceIdentifier: "example.com",
            username: "alice@example.com",
            displayName: "alice@example.com",
            itemTitle: "Example",
            folderName: "Pessoal"
        ),
        AutoFillCredentialCandidate(
            id: "credential-2",
            serviceIdentifier: "login.safe.example",
            username: "bob",
            displayName: "bob",
            itemTitle: "Safe Example",
            folderName: nil
        ),
    ]

    func testRoundTripKeepsCandidatesEncryptedUntilDecrypt() throws {
        let envelope = try codec.encrypt(candidates: candidates, vaultKey: vaultKey, nonce12: nonce)

        XCTAssertEqual(envelope.version, "autofill-index-v1")
        XCTAssertEqual(envelope.nonce, nonce.base64EncodedString())
        XCTAssertFalse(envelope.encrypted.contains("alice@example.com"))
        XCTAssertFalse(envelope.encrypted.contains("example.com"))

        let decrypted = try codec.decrypt(envelope: envelope, vaultKey: vaultKey)
        XCTAssertEqual(decrypted, candidates)
    }

    func testRejectsWrongVaultKey() throws {
        let envelope = try codec.encrypt(candidates: candidates, vaultKey: vaultKey, nonce12: nonce)
        let wrongKey = Data(repeating: 7, count: 32)

        XCTAssertThrowsError(try codec.decrypt(envelope: envelope, vaultKey: wrongKey))
    }

    func testRejectsTamperedCiphertext() throws {
        let envelope = try codec.encrypt(candidates: candidates, vaultKey: vaultKey, nonce12: nonce)
        var raw = Data(base64Encoded: envelope.encrypted)!
        raw[0] ^= 0xff
        let tampered = AutoFillEncryptedIndexEnvelope(
            nonce: envelope.nonce,
            encrypted: raw.base64EncodedString()
        )

        XCTAssertThrowsError(try codec.decrypt(envelope: tampered, vaultKey: vaultKey))
    }

    func testRejectsInvalidKeyAndNonceLength() {
        XCTAssertThrowsError(try codec.encrypt(candidates: candidates, vaultKey: Data(repeating: 1, count: 31), nonce12: nonce)) { error in
            XCTAssertEqual(error as? VaultCryptoError, .invalidKeyLength)
        }

        XCTAssertThrowsError(try codec.encrypt(candidates: candidates, vaultKey: vaultKey, nonce12: Data(repeating: 1, count: 11))) { error in
            XCTAssertEqual(error as? VaultCryptoError, .invalidNonceLength)
        }
    }
}
