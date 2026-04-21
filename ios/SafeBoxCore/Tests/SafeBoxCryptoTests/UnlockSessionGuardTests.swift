import XCTest
@testable import SafeBoxCrypto

final class UnlockSessionGuardTests: XCTestCase {
    func testVerifyThrowsInvalidMasterPasswordForHashMismatch() throws {
        let expectedKey = try XCTUnwrap(Data(hex: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"))
        let wrongKey = try XCTUnwrap(Data(hex: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"))
        let pipeline = KDFPipeline(argon2Provider: FixedArgon2Provider(output: wrongKey))
        let guardService = UnlockSessionGuard(kdfPipeline: pipeline)
        let expectedHash = KDFPipeline(argon2Provider: FixedArgon2Provider(output: expectedKey)).keyHashBase64(rawKey: expectedKey)

        XCTAssertThrowsError(
            try guardService.verifyMasterPassword(
                password: "wrong-password",
                saltBase64: Data(repeating: 1, count: 32).base64EncodedString(),
                params: KDFParams(
                    algorithm: "argon2id",
                    level: "LOW",
                    memorySize: 65536,
                    iterations: 3,
                    parallelism: 4,
                    hashLength: 32
                ),
                expectedKeyHashBase64: expectedHash
            )
        ) { error in
            XCTAssertEqual(error as? VaultCryptoError, .invalidMasterPassword)
        }
    }

    func testNeedsReunlockWhenKeyHashChanges() throws {
        let key = try XCTUnwrap(Data(hex: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"))
        let pipeline = KDFPipeline(argon2Provider: LibArgon2Provider())
        let guardService = UnlockSessionGuard(kdfPipeline: pipeline)

        let currentHash = pipeline.keyHashBase64(rawKey: key)
        XCTAssertFalse(guardService.needsReunlock(cachedKey: key, latestKeyHashBase64: currentHash))
        XCTAssertTrue(guardService.needsReunlock(cachedKey: key, latestKeyHashBase64: "invalid-hash-base64"))
    }
}

private struct FixedArgon2Provider: Argon2Providing {
    let output: Data

    func deriveKey(password: Data, salt: Data, params: KDFParams) throws -> Data {
        output
    }
}
