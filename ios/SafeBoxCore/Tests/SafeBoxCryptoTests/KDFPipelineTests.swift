import Foundation
import XCTest
@testable import SafeBoxCrypto

final class KDFPipelineTests: XCTestCase {
    func testPBKDF2AndCombinedInputMatchAllVectorsBeforeArgon2() throws {
        let vectors = try TestVectorsLoader2.load()

        for vector in vectors.kdfVectors {
            let expectedPBKDF2 = try XCTUnwrap(Data(hex: vector.pbkdf2Hex))
            let expectedPBKDF2Base64 = expectedPBKDF2.base64EncodedString()
            let expectedCombinedData = Data((expectedPBKDF2Base64 + vector.testPassphrase).utf8)
            let expectedSalt = try XCTUnwrap(Data(base64Encoded: vector.saltBase64))
            let expectedOutput = try XCTUnwrap(Data(hex: vector.derivedKeyHex))

            let spy = Argon2Spy(expectedOutput: expectedOutput)
            let pipeline = KDFPipeline(argon2Provider: spy)

            let output = try pipeline.deriveVaultKey(
                password: vector.testPassphrase,
                saltBase64: vector.saltBase64,
                params: vector.kdfParams
            )

            XCTAssertEqual(output, expectedOutput, "Derived key mismatch for vector \(vector.name)")
            XCTAssertEqual(spy.lastPassword, expectedCombinedData, "Combined input mismatch for vector \(vector.name)")
            XCTAssertEqual(spy.lastSalt, expectedSalt, "Argon2 salt mismatch for vector \(vector.name)")
            XCTAssertEqual(spy.lastParams, vector.kdfParams, "KDF params mismatch for vector \(vector.name)")
            XCTAssertEqual(
                pipeline.keyHashBase64(rawKey: expectedOutput),
                vector.keyHashBase64,
                "key_hash mismatch for vector \(vector.name)"
            )
        }
    }

    func testLibArgon2MatchesNonSlowKDFVectors() throws {
        let vectors = try TestVectorsLoader2.load()
        try assertLibArgon2Matches(vectors: vectors.kdfVectors.filter { !$0.optionalSlow })
    }

    func testLibArgon2MatchesSlowKDFVectorsWhenEnabled() throws {
        guard ProcessInfo.processInfo.environment["SAFEBOX_RUN_SLOW_ARGON2_TESTS"] == "1" else {
            throw XCTSkip("Set SAFEBOX_RUN_SLOW_ARGON2_TESTS=1 to run ULTRA Argon2 vectors.")
        }

        let vectors = try TestVectorsLoader2.load()
        try assertLibArgon2Matches(vectors: vectors.kdfVectors.filter(\.optionalSlow))
    }

    private func assertLibArgon2Matches(vectors: [KDFVector2]) throws {
        let pipeline = KDFPipeline(argon2Provider: LibArgon2Provider())

        for vector in vectors {
            let output = try pipeline.deriveVaultKey(
                password: vector.testPassphrase,
                saltBase64: vector.saltBase64,
                params: vector.kdfParams
            )

            XCTAssertEqual(output.map { String(format: "%02x", $0) }.joined(), vector.derivedKeyHex, "Argon2 derived key mismatch for vector \(vector.name)")
            XCTAssertEqual(pipeline.keyHashBase64(rawKey: output), vector.keyHashBase64, "key_hash mismatch for vector \(vector.name)")
        }
    }
}

private final class Argon2Spy: Argon2Providing, @unchecked Sendable {
    let expectedOutput: Data
    var lastPassword: Data?
    var lastSalt: Data?
    var lastParams: KDFParams?

    init(expectedOutput: Data) {
        self.expectedOutput = expectedOutput
    }

    func deriveKey(password: Data, salt: Data, params: KDFParams) throws -> Data {
        lastPassword = password
        lastSalt = salt
        lastParams = params
        return expectedOutput
    }
}

private struct TestVectorsFile2: Decodable {
    let kdfVectors: [KDFVector2]
}

private struct KDFVector2: Decodable {
    let name: String
    let testPassphrase: String
    let saltBase64: String
    let optionalSlow: Bool
    let kdfParams: KDFParams
    let pbkdf2Hex: String
    let derivedKeyHex: String
    let keyHashBase64: String
}

private enum TestVectorsLoader2 {
    static func load() throws -> TestVectorsFile2 {
        let fileURL = try XCTUnwrap(
            Bundle.module.url(forResource: "test-vectors", withExtension: "json")
        )
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(TestVectorsFile2.self, from: data)
    }
}

