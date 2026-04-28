import Foundation

public enum SessionState: String, Sendable, Equatable {
    case signedOut
    case signedInLocked
    case unlocking
    case unlocked
    case relockRequired
    case biometryInvalidated
    case keyRotationDetected
    case sessionExpired
}

public enum SessionEvent: Sendable, Equatable {
    case loginSucceeded
    case unlockRequested
    case unlockSucceeded
    case unlockFailed
    case inactivityTimeout
    case appDidEnterBackground
    case vaultLockRequested
    case logoutRequested
    case keyRotationDetected
    case biometryInvalidated
    case authSessionExpired
    case relockAcknowledged
}

public enum SessionTransitionError: Error, Equatable {
    case invalidTransition(from: SessionState, event: SessionEvent)
}

public enum AuthSessionStatus: String, Sendable, Equatable {
    case signedOut
    case signedIn
    case expired
}

public enum VaultUnlockStatus: String, Sendable, Equatable {
    case locked
    case unlocking
    case unlocked
    case relockRequired
}

public struct SessionStateMachine: Sendable {
    public private(set) var state: SessionState

    public init(initialState: SessionState = .signedOut) {
        self.state = initialState
    }

    @discardableResult
    public mutating func handle(_ event: SessionEvent) throws -> SessionState {
        let next = try Self.transition(from: state, event: event)
        state = next
        return next
    }

    public static func transition(from current: SessionState, event: SessionEvent) throws -> SessionState {
        switch (current, event) {
        case (.signedOut, .loginSucceeded),
             (.sessionExpired, .loginSucceeded):
            return .signedInLocked

        case (.signedInLocked, .unlockRequested),
             (.relockRequired, .unlockRequested):
            return .unlocking
        case (.unlocking, .unlockSucceeded):
            return .unlocked
        case (.unlocking, .unlockFailed):
            return .signedInLocked

        case (.unlocked, .inactivityTimeout),
             (.unlocked, .appDidEnterBackground),
             (.unlocked, .vaultLockRequested):
            return .relockRequired
        case (.signedInLocked, .keyRotationDetected),
             (.relockRequired, .keyRotationDetected),
             (.unlocked, .keyRotationDetected):
            return .keyRotationDetected
        case (.signedInLocked, .biometryInvalidated),
             (.relockRequired, .biometryInvalidated),
             (.unlocked, .biometryInvalidated):
            return .biometryInvalidated

        case (.relockRequired, .relockAcknowledged),
             (.keyRotationDetected, .relockAcknowledged),
             (.biometryInvalidated, .relockAcknowledged):
            return .signedInLocked

        case (.signedInLocked, .authSessionExpired),
             (.unlocking, .authSessionExpired),
             (.unlocked, .authSessionExpired),
             (.relockRequired, .authSessionExpired),
             (.keyRotationDetected, .authSessionExpired),
             (.biometryInvalidated, .authSessionExpired):
            return .sessionExpired

        case (.sessionExpired, .relockAcknowledged),
             (.sessionExpired, .logoutRequested):
            return .signedOut

        case (.signedInLocked, .logoutRequested),
             (.unlocking, .logoutRequested),
             (.unlocked, .logoutRequested),
             (.relockRequired, .logoutRequested),
             (.keyRotationDetected, .logoutRequested),
             (.biometryInvalidated, .logoutRequested):
            return .signedOut

        default:
            throw SessionTransitionError.invalidTransition(from: current, event: event)
        }
    }

    public var authStatus: AuthSessionStatus {
        switch state {
        case .signedOut:
            return .signedOut
        case .sessionExpired:
            return .expired
        default:
            return .signedIn
        }
    }

    public var vaultStatus: VaultUnlockStatus {
        switch state {
        case .signedOut, .signedInLocked, .sessionExpired:
            return .locked
        case .unlocking:
            return .unlocking
        case .unlocked:
            return .unlocked
        case .relockRequired, .keyRotationDetected, .biometryInvalidated:
            return .relockRequired
        }
    }
}
