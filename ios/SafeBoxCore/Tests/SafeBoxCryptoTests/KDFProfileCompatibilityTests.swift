import Foundation
import XCTest
@testable import SafeBoxCrypto

final class KDFProfileCompatibilityTests: XCTestCase {
    private func profile(_ extra: [String: Any] = [:]) throws -> Data {
        var values: [String: Any] = ["algorithm": "argon2id", "memorySize": 65536,
                                   "iterations": 3, "parallelism": 4, "hashLength": 32]
        values.merge(extra, uniquingKeysWith: { _, new in new })
        return try JSONSerialization.data(withJSONObject: values)
    }

    func testKnownLegacyProfileGetsLabelWithoutChangingCost() throws {
        let decoded = try JSONDecoder().decode(KDFParams.self, from: profile())
        XCTAssertEqual(decoded, KDFParams(algorithm: "argon2id", level: "LOW", memorySize: 65536,
                                         iterations: 3, parallelism: 4, hashLength: 32))
    }

    func testUnknownUnlabelledProfilesAreRejected() throws {
        for difference: [String: Any] in [["memorySize": 8192], ["iterations": 1],
                                         ["parallelism": 1], ["hashLength": 16], ["algorithm": "unknown"]] {
            let data = try profile(difference)
            XCTAssertThrowsError(try JSONDecoder().decode(KDFParams.self, from: data))
        }
    }

    func testExplicitLevelRoundTripsUnchanged() throws {
        let decoded = try JSONDecoder().decode(KDFParams.self, from: profile(["level": "HIGH"]))
        XCTAssertEqual(decoded.level, "HIGH")
        XCTAssertEqual(try JSONDecoder().decode(KDFParams.self, from: JSONEncoder().encode(decoded)), decoded)
    }

    func testNullLabelIsNotTreatedAsMissing() throws {
        let data = try profile(["level": NSNull()])
        XCTAssertThrowsError(try JSONDecoder().decode(KDFParams.self, from: data))
    }
}
