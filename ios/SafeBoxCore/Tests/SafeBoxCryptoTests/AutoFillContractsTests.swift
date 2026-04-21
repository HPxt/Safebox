import XCTest
@testable import SafeBoxCrypto

final class AutoFillContractsTests: XCTestCase {
    func testLockedStateReturnsError() async throws {
        let provider = DomainFilteringAutoFillProvider(
            indexStore: StaticAutoFillIndexStore(candidates: []),
            secretResolver: StaticAutoFillSecretResolver(value: AutoFillResolvedCredential(candidateID: "1", username: "u", password: "p"))
        )

        do {
            _ = try await provider.password(for: "1", accessGrant: nil)
            XCTFail("Expected locked")
        } catch {
            XCTAssertEqual(error as? AutoFillProviderError, .locked)
        }
    }

    func testPasswordResolutionRequiresExplicitAccessGrant() async throws {
        let provider = DomainFilteringAutoFillProvider(
            indexStore: StaticAutoFillIndexStore(candidates: []),
            secretResolver: StaticAutoFillSecretResolver(value: AutoFillResolvedCredential(candidateID: "1", username: "u", password: "p"))
        )

        let resolved = try await provider.password(
            for: "1",
            accessGrant: .localAuthenticationSucceeded()
        )

        XCTAssertEqual(resolved.password, "p")
    }

    func testCandidateWithoutMatchingDomainIsFilteredOut() async throws {
        let candidates = [
            AutoFillCredentialCandidate(
                id: "1",
                serviceIdentifier: "example.com",
                username: "alice",
                displayName: "alice",
                itemTitle: "Example",
                folderName: nil
            ),
            AutoFillCredentialCandidate(
                id: "2",
                serviceIdentifier: "internal.local",
                username: "bob",
                displayName: "bob",
                itemTitle: "Internal",
                folderName: nil
            )
        ]
        let provider = DomainFilteringAutoFillProvider(
            indexStore: StaticAutoFillIndexStore(candidates: candidates),
            secretResolver: StaticAutoFillSecretResolver(value: AutoFillResolvedCredential(candidateID: "1", username: "alice", password: "secret"))
        )

        let filtered = try await provider.candidates(for: ["https://login.example.com"])
        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.first?.id, "1")
    }

    func testCandidateModelDoesNotExposePasswordField() {
        let candidate = AutoFillCredentialCandidate(
            id: "1",
            serviceIdentifier: "example.com",
            username: "alice",
            displayName: "Alice",
            itemTitle: "Site",
            folderName: "Work"
        )
        let mirror = Mirror(reflecting: candidate)
        let propertyNames = Set(mirror.children.compactMap { $0.label })
        XCTAssertFalse(propertyNames.contains("password"))
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
