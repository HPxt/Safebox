import Foundation

public enum LockReason: String, Sendable, Equatable {
    case inactivityTimeout
    case appDidEnterBackground
    case logoutRequested
    case keyRotationDetected
    case authSessionExpired
    case biometryInvalidated
}

public enum LockTrigger: Sendable, Equatable {
    case inactivityCheck(lastInteractionAt: Date?)
    case appDidEnterBackground
    case logoutRequested
    case keyRotationDetected
    case authSessionExpired
    case biometryInvalidated
}

public protocol ClockProviding: Sendable {
    func now() -> Date
}

public struct SystemClock: ClockProviding {
    public init() {}
    public func now() -> Date { Date() }
}

public protocol SensitiveStateInvalidating: Sendable {
    func clearSensitiveState()
}

public struct LockPolicy: Sendable {
    public let inactivityTimeout: TimeInterval
    private let clock: ClockProviding

    public init(inactivityTimeout: TimeInterval, clock: ClockProviding = SystemClock()) {
        self.inactivityTimeout = inactivityTimeout
        self.clock = clock
    }

    public func lockReason(for trigger: LockTrigger) -> LockReason? {
        switch trigger {
        case let .inactivityCheck(lastInteractionAt):
            guard let lastInteractionAt else { return nil }
            let idle = clock.now().timeIntervalSince(lastInteractionAt)
            return idle >= inactivityTimeout ? .inactivityTimeout : nil
        case .appDidEnterBackground:
            return .appDidEnterBackground
        case .logoutRequested:
            return .logoutRequested
        case .keyRotationDetected:
            return .keyRotationDetected
        case .authSessionExpired:
            return .authSessionExpired
        case .biometryInvalidated:
            return .biometryInvalidated
        }
    }

    public func shouldRelock(trigger: LockTrigger) -> Bool {
        lockReason(for: trigger) != nil
    }

    public func applyLockIfNeeded(
        trigger: LockTrigger,
        sensitiveState: SensitiveStateInvalidating
    ) -> LockReason? {
        guard let reason = lockReason(for: trigger) else {
            return nil
        }
        sensitiveState.clearSensitiveState()
        return reason
    }
}
