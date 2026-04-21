import XCTest
@testable import SafeBoxCrypto

final class MobileKDFPolicyTests: XCTestCase {
    func testUltraIsSupportedForUnlockButNotConfigurable() {
        let policy = MobileKDFPolicy()

        XCTAssertTrue(policy.isSupportedForUnlock(level: .ultra))
        XCTAssertFalse(policy.isConfigurableOnMobile(level: .ultra))
        XCTAssertEqual(policy.defaultOnMobileSetup, .low)
        XCTAssertEqual(policy.recommendedMobileMax, .high)
    }

    func testUltraReturnsWarningBeforeUnlock() {
        let policy = MobileKDFPolicy()
        XCTAssertEqual(policy.preUnlockWarning(for: .ultra), .highResourceKdfWarning)
        XCTAssertNil(policy.preUnlockWarning(for: .high))
    }

    func testInvalidLevelThrowsKdfInvalidParams() {
        let policy = MobileKDFPolicy()
        XCTAssertThrowsError(try policy.parseLevel("SUPER")) { error in
            XCTAssertEqual(error as? VaultCryptoError, .kdfPolicyFailure(.kdfInvalidParams))
        }
    }
}
