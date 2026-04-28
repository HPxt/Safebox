import Foundation
import XCTest
@testable import SafeBoxCrypto

final class LockPolicyTests: XCTestCase {
    func testTimeoutWithInjectableClockTriggersRelock() {
        let now = Date(timeIntervalSince1970: 10_000)
        let lastInteraction = now.addingTimeInterval(-301)
        let policy = LockPolicy(
            inactivityTimeout: 300,
            clock: FixedClock(fixedNow: now)
        )

        let reason = policy.lockReason(for: .inactivityCheck(lastInteractionAt: lastInteraction))
        XCTAssertEqual(reason, .inactivityTimeout)
    }

    func testTimeoutWithinWindowDoesNotRelock() {
        let now = Date(timeIntervalSince1970: 10_000)
        let lastInteraction = now.addingTimeInterval(-60)
        let policy = LockPolicy(
            inactivityTimeout: 300,
            clock: FixedClock(fixedNow: now)
        )

        XCTAssertNil(policy.lockReason(for: .inactivityCheck(lastInteractionAt: lastInteraction)))
    }

    func testBackgroundAlwaysRelocks() {
        let policy = LockPolicy(inactivityTimeout: 300, clock: FixedClock(fixedNow: Date()))
        XCTAssertEqual(policy.lockReason(for: .appDidEnterBackground), .appDidEnterBackground)
    }

    func testBiometryInvalidatedAlwaysRelocks() {
        let policy = LockPolicy(inactivityTimeout: 300, clock: FixedClock(fixedNow: Date()))
        XCTAssertEqual(policy.lockReason(for: .biometryInvalidated), .biometryInvalidated)
    }

    func testLogoutClearsSharedSensitiveState() {
        let policy = LockPolicy(inactivityTimeout: 300, clock: FixedClock(fixedNow: Date()))
        let state = InMemorySensitiveState()
        XCTAssertFalse(state.cleared)

        let reason = policy.applyLockIfNeeded(trigger: .logoutRequested, sensitiveState: state)
        XCTAssertEqual(reason, .logoutRequested)
        XCTAssertTrue(state.cleared)
    }
}

private struct FixedClock: ClockProviding {
    let fixedNow: Date

    func now() -> Date {
        fixedNow
    }
}

private final class InMemorySensitiveState: SensitiveStateInvalidating, @unchecked Sendable {
    private(set) var cleared = false

    func clearSensitiveState() {
        cleared = true
    }
}
