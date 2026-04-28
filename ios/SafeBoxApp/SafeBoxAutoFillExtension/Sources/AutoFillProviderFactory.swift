import Foundation
import SafeBoxCrypto

enum AutoFillProviderFactory {
    private static let appGroupID = "group.app.safebox.ios.shared"

    static func makeProvider() -> AutoFillCredentialProviding {
        let sessionStore = AutoFillSharedSessionStore(appGroupIdentifier: appGroupID)
        let indexStore = AutoFillSharedCandidatesStore(appGroupIdentifier: appGroupID)
        let inner = DomainFilteringAutoFillProvider(
            indexStore: indexStore,
            secretResolver: LockedAutoFillSecretResolver()
        )
        return AutoFillSessionGatingProvider(sessionStore: sessionStore, inner: inner)
    }
}

private struct LockedAutoFillSecretResolver: AutoFillSecretResolving {
    func resolveCredential(candidateID _: String) async throws -> AutoFillResolvedCredential {
        throw AutoFillProviderError.locked
    }
}
