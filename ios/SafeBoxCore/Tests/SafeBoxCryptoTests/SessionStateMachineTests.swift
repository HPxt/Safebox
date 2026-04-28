import XCTest
@testable import SafeBoxCrypto

final class SessionStateMachineTests: XCTestCase {
    func testCanonicalUnlockFlow() throws {
        var machine = SessionStateMachine()
        XCTAssertEqual(machine.state, .signedOut)

        try machine.handle(.loginSucceeded)
        XCTAssertEqual(machine.state, .signedInLocked)

        try machine.handle(.unlockRequested)
        XCTAssertEqual(machine.state, .unlocking)

        try machine.handle(.unlockSucceeded)
        XCTAssertEqual(machine.state, .unlocked)
        XCTAssertEqual(machine.authStatus, .signedIn)
        XCTAssertEqual(machine.vaultStatus, .unlocked)
    }

    func testInactivityTriggersRelockRequired() throws {
        var machine = SessionStateMachine(initialState: .unlocked)
        try machine.handle(.inactivityTimeout)
        XCTAssertEqual(machine.state, .relockRequired)
        XCTAssertEqual(machine.vaultStatus, .relockRequired)
    }

    func testVaultLockRequestedTriggersRelockRequired() throws {
        var machine = SessionStateMachine(initialState: .unlocked)
        try machine.handle(.vaultLockRequested)
        XCTAssertEqual(machine.state, .relockRequired)
        XCTAssertEqual(machine.vaultStatus, .relockRequired)
    }

    func testRelockRequiredCanTransitionDirectlyBackToUnlocking() throws {
        var machine = SessionStateMachine(initialState: .relockRequired)
        try machine.handle(.unlockRequested)
        XCTAssertEqual(machine.state, .unlocking)
        XCTAssertEqual(machine.vaultStatus, .unlocking)
    }

    func testKeyRotationMovesToDedicatedState() throws {
        var machine = SessionStateMachine(initialState: .unlocked)
        try machine.handle(.keyRotationDetected)
        XCTAssertEqual(machine.state, .keyRotationDetected)
    }

    func testKeyRotationCanBeDetectedWhileAlreadyLocked() throws {
        var machine = SessionStateMachine(initialState: .signedInLocked)
        try machine.handle(.keyRotationDetected)
        XCTAssertEqual(machine.state, .keyRotationDetected)
        XCTAssertEqual(machine.vaultStatus, .relockRequired)
    }

    func testBiometryInvalidatedMovesToDedicatedState() throws {
        var machine = SessionStateMachine(initialState: .unlocked)
        try machine.handle(.biometryInvalidated)
        XCTAssertEqual(machine.state, .biometryInvalidated)
    }

    func testBiometryInvalidatedCanBeDetectedWhileRelockIsPending() throws {
        var machine = SessionStateMachine(initialState: .relockRequired)
        try machine.handle(.biometryInvalidated)
        XCTAssertEqual(machine.state, .biometryInvalidated)
        XCTAssertEqual(machine.vaultStatus, .relockRequired)
    }

    func testAuthSessionExpiredLeadsToSessionExpiredThenSignedOut() throws {
        var machine = SessionStateMachine(initialState: .unlocked)
        try machine.handle(.authSessionExpired)
        XCTAssertEqual(machine.state, .sessionExpired)
        XCTAssertEqual(machine.authStatus, .expired)
        XCTAssertEqual(machine.vaultStatus, .locked)

        try machine.handle(.relockAcknowledged)
        XCTAssertEqual(machine.state, .signedOut)
    }

    func testLoginAfterExpiredSessionStartsLockedAgain() throws {
        var machine = SessionStateMachine(initialState: .sessionExpired)
        try machine.handle(.loginSucceeded)
        XCTAssertEqual(machine.state, .signedInLocked)
        XCTAssertEqual(machine.authStatus, .signedIn)
        XCTAssertEqual(machine.vaultStatus, .locked)
    }

    func testInvalidTransitionThrows() {
        XCTAssertThrowsError(try SessionStateMachine.transition(from: .signedOut, event: .unlockSucceeded)) { error in
            guard case let SessionTransitionError.invalidTransition(from, event) = error else {
                return XCTFail("Unexpected error type")
            }
            XCTAssertEqual(from, .signedOut)
            XCTAssertEqual(event, .unlockSucceeded)
        }
    }
}
