import AuthenticationServices
import Foundation
import SafeBoxCrypto

final class CredentialProviderViewController: ASCredentialProviderViewController {
    private let provider: AutoFillCredentialProviding = AutoFillProviderFactory.makeProvider()

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        Task { @MainActor in
            do {
                let candidates = try await provider.candidates(for: serviceIdentifiers.map(\.identifier))
                if candidates.isEmpty {
                    cancelRequest(
                        code: ASExtensionError.Code.userCanceled.rawValue,
                        description: "Nenhuma credencial elegivel encontrada para este dominio."
                    )
                    return
                }
                // Until the selection UI is wired, fail closed instead of leaving
                // the system AutoFill request waiting indefinitely.
                cancelRequest(
                    code: ASExtensionError.Code.userInteractionRequired.rawValue,
                    description: "Abra o app SafeBox para desbloquear e selecionar a credencial."
                )
            } catch AutoFillProviderError.locked {
                cancelRequest(
                    code: ASExtensionError.Code.userInteractionRequired.rawValue,
                    description: "Desbloqueie o cofre no app SafeBox para usar AutoFill."
                )
            } catch {
                cancelRequest(
                    code: ASExtensionError.Code.failed.rawValue,
                    description: "AutoFill indisponivel no momento."
                )
            }
        }
    }

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        _ = credentialIdentity
        // E7 / política SafeBox: nunca injetar senha sem UI + biometria explícita.
        extensionContext.cancelRequest(
            withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.Code.userInteractionRequired.rawValue,
                userInfo: [NSLocalizedDescriptionKey: "Abra o SafeBox e use AutoFill pela interface protegida do cofre."]
            )
        )
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        // Keep read-only and fail closed until extension UI flow is wired.
        extensionContext.cancelRequest(
            withError: NSError(
                domain: "app.safebox.autofill",
                code: ASExtensionError.Code.userInteractionRequired.rawValue,
                userInfo: [NSLocalizedDescriptionKey: "Abra o app SafeBox para desbloquear o cofre antes do AutoFill."]
            )
        )
    }

    private func cancelRequest(code: Int, description: String) {
        extensionContext.cancelRequest(
            withError: NSError(
                domain: "app.safebox.autofill",
                code: code,
                userInfo: [NSLocalizedDescriptionKey: description]
            )
        )
    }
}
