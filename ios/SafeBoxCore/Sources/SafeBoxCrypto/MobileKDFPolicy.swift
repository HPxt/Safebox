import Foundation

public enum MobileKDFPolicyState: String, Sendable, Equatable {
    case unsupportedConfigurationForMobile
    case highResourceKdfWarning
    case kdfResourceFailure
    case kdfInvalidParams
}

public enum KDFLevel: String, Sendable, CaseIterable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"
    case ultra = "ULTRA"
}

public struct MobileKDFPolicy: Sendable {
    public let supportedForUnlock: Set<KDFLevel> = [.low, .medium, .high, .ultra]
    public let configurableOnMobile: [KDFLevel] = [.low, .medium, .high]
    public let defaultOnMobileSetup: KDFLevel = .low
    public let recommendedMobileMax: KDFLevel = .high

    public init() {}

    public func isSupportedForUnlock(level: KDFLevel) -> Bool {
        supportedForUnlock.contains(level)
    }

    public func isConfigurableOnMobile(level: KDFLevel) -> Bool {
        configurableOnMobile.contains(level)
    }

    public func preUnlockWarning(for level: KDFLevel) -> MobileKDFPolicyState? {
        if level == .ultra {
            return .highResourceKdfWarning
        }
        return nil
    }

    public func validateConfiguration(level: KDFLevel) -> MobileKDFPolicyState? {
        guard isConfigurableOnMobile(level: level) else {
            return .unsupportedConfigurationForMobile
        }
        return nil
    }

    public func parseLevel(_ rawValue: String) throws -> KDFLevel {
        guard let level = KDFLevel(rawValue: rawValue.uppercased()) else {
            throw VaultCryptoError.kdfPolicyFailure(.kdfInvalidParams)
        }
        return level
    }
}
