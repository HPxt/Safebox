import Foundation

/// Exige grant válido no App Group antes de delegar ao provider interno (fail-closed).
public struct AutoFillSessionGatingProvider<Inner: AutoFillCredentialProviding>: AutoFillCredentialProviding {
    private let sessionReader: any AutoFillHostSessionReading
    private let clock: any ClockProviding
    private let inner: Inner

    public init(
        sessionReader: any AutoFillHostSessionReading,
        clock: any ClockProviding = SystemClock(),
        inner: Inner
    ) {
        self.sessionReader = sessionReader
        self.clock = clock
        self.inner = inner
    }

    public init(
        sessionStore: AutoFillSharedSessionStore,
        clock: any ClockProviding = SystemClock(),
        inner: Inner
    ) {
        self.sessionReader = sessionStore
        self.clock = clock
        self.inner = inner
    }

    private func assertActiveGrant() throws {
        guard let state = try sessionReader.loadSessionState(),
              state.isExtensionAccessAllowed(at: clock.now()) else {
            throw AutoFillProviderError.locked
        }
    }

    public func candidates(for serviceIdentifiers: [String]) async throws -> [AutoFillCredentialCandidate] {
        try assertActiveGrant()
        return try await inner.candidates(for: serviceIdentifiers)
    }

    public func password(for candidateID: String, accessGrant: AutoFillAccessGrant?) async throws -> AutoFillResolvedCredential {
        try assertActiveGrant()
        return try await inner.password(for: candidateID, accessGrant: accessGrant)
    }
}
