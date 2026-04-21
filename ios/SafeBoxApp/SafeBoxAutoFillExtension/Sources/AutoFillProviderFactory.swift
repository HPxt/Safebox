import Foundation
import SafeBoxCrypto

enum AutoFillProviderFactory {
    static func makeProvider() -> AutoFillCredentialProviding {
        DomainFilteringAutoFillProvider(
            indexStore: EmptyAutoFillIndexStore(),
            secretResolver: LockedAutoFillSecretResolver()
        )
    }
}

private struct EmptyAutoFillIndexStore: AutoFillIndexStoring {
    func loadCandidates() async throws -> [AutoFillCredentialCandidate] {
        []
    }
}

private struct LockedAutoFillSecretResolver: AutoFillSecretResolving {
    func resolveCredential(candidateID _: String) async throws -> AutoFillResolvedCredential {
        throw AutoFillProviderError.locked
    }
}
