import Foundation
import SafeBoxCrypto
#if canImport(AuthenticationServices)
import AuthenticationServices
#endif

protocol CredentialIdentityDonating {
    func replaceAll(candidates: [AutoFillCredentialCandidate], domain: String) async throws
    func removeAll() async throws
}

struct CredentialIdentityDonationService: CredentialIdentityDonating {
    func replaceAll(candidates: [AutoFillCredentialCandidate], domain _: String) async throws {
        #if canImport(AuthenticationServices)
        try await removeAll()
        let identities = candidates.map { candidate in
            ASPasswordCredentialIdentity(
                serviceIdentifier: ASCredentialServiceIdentifier(
                    identifier: candidate.serviceIdentifier,
                    type: .domain
                ),
                user: candidate.username,
                recordIdentifier: candidate.id
            )
        }
        try await withCheckedThrowingContinuation { continuation in
            ASCredentialIdentityStore.shared.saveCredentialIdentities(identities) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                if success {
                    continuation.resume()
                    return
                }
                continuation.resume(throwing: NSError(
                    domain: "app.safebox.autofill.identity",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Falha ao doar identidades de credencial."]
                ))
            }
        }
        #else
        _ = candidates
        #endif
    }

    func removeAll() async throws {
        #if canImport(AuthenticationServices)
        try await withCheckedThrowingContinuation { continuation in
            ASCredentialIdentityStore.shared.removeAllCredentialIdentities { success, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                if success {
                    continuation.resume()
                    return
                }
                continuation.resume(throwing: NSError(
                    domain: "app.safebox.autofill.identity",
                    code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Falha ao remover identidades de credencial."]
                ))
            }
        }
        #endif
    }
}
