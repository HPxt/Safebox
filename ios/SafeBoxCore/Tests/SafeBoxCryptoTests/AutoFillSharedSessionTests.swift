import XCTest
@testable import SafeBoxCrypto

final class AutoFillSharedSessionTests: XCTestCase {
    func testHostSessionRejectsWhenLocked() {
        let state = AutoFillSharedHostSessionState(vaultUnlocked: false, grantExpiresAt: Date().addingTimeInterval(3600))
        XCTAssertFalse(state.isExtensionAccessAllowed(at: Date()))
    }

    func testHostSessionRejectsWhenExpired() {
        let past = Date().addingTimeInterval(-60)
        let state = AutoFillSharedHostSessionState(vaultUnlocked: true, grantExpiresAt: past)
        XCTAssertFalse(state.isExtensionAccessAllowed(at: Date()))
    }

    func testHostSessionAllowsBeforeExpiry() {
        let future = Date().addingTimeInterval(3600)
        let state = AutoFillSharedHostSessionState(vaultUnlocked: true, grantExpiresAt: future)
        XCTAssertTrue(state.isExtensionAccessAllowed(at: Date()))
    }

    func testHostSessionRejectsWrongSchema() {
        let future = Date().addingTimeInterval(3600)
        let state = AutoFillSharedHostSessionState(schemaVersion: 99, vaultUnlocked: true, grantExpiresAt: future)
        XCTAssertFalse(state.isExtensionAccessAllowed(at: Date(), expectedSchema: 1))
    }

    func testGatingProviderBlocksWithoutGrant() async throws {
        let reader = FixedSessionReader(state: nil)
        let inner = DomainFilteringAutoFillProvider(
            indexStore: StaticAutoFillIndexStore(candidates: [
                AutoFillCredentialCandidate(
                    id: "1",
                    serviceIdentifier: "example.com",
                    username: "a",
                    displayName: "a",
                    itemTitle: "t",
                    folderName: nil
                )
            ]),
            secretResolver: StaticAutoFillSecretResolver(value: AutoFillResolvedCredential(candidateID: "1", username: "a", password: "p"))
        )
        let gating = AutoFillSessionGatingProvider(sessionReader: reader, inner: inner)
        do {
            _ = try await gating.candidates(for: ["example.com"])
            XCTFail("expected locked")
        } catch {
            XCTAssertEqual(error as? AutoFillProviderError, .locked)
        }
    }

    func testGatingProviderPassesWithValidGrant() async throws {
        let future = Date().addingTimeInterval(600)
        let reader = FixedSessionReader(state: AutoFillSharedHostSessionState(vaultUnlocked: true, grantExpiresAt: future))
        let inner = DomainFilteringAutoFillProvider(
            indexStore: StaticAutoFillIndexStore(candidates: [
                AutoFillCredentialCandidate(
                    id: "1",
                    serviceIdentifier: "example.com",
                    username: "a",
                    displayName: "a",
                    itemTitle: "t",
                    folderName: nil
                )
            ]),
            secretResolver: StaticAutoFillSecretResolver(value: AutoFillResolvedCredential(candidateID: "1", username: "a", password: "p"))
        )
        let gating = AutoFillSessionGatingProvider(sessionReader: reader, inner: inner)
        let found = try await gating.candidates(for: ["https://example.com/path"])
        XCTAssertEqual(found.count, 1)
    }
}

private struct FixedSessionReader: AutoFillHostSessionReading {
    let state: AutoFillSharedHostSessionState?

    func loadSessionState() throws -> AutoFillSharedHostSessionState? {
        state
    }
}

private struct StaticAutoFillIndexStore: AutoFillIndexStoring {
    let candidates: [AutoFillCredentialCandidate]

    func loadCandidates() async throws -> [AutoFillCredentialCandidate] {
        candidates
    }
}

private struct StaticAutoFillSecretResolver: AutoFillSecretResolving {
    let value: AutoFillResolvedCredential

    func resolveCredential(candidateID: String) async throws -> AutoFillResolvedCredential {
        guard candidateID == value.candidateID else {
            throw AutoFillProviderError.candidateNotFound
        }
        return value
    }
}
