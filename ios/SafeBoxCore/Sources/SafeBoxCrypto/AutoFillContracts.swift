import Foundation

public struct AutoFillCredentialCandidate: Codable, Sendable, Equatable {
    public let id: String
    public let serviceIdentifier: String
    public let username: String
    public let displayName: String
    public let itemTitle: String
    public let folderName: String?

    public init(
        id: String,
        serviceIdentifier: String,
        username: String,
        displayName: String,
        itemTitle: String,
        folderName: String?
    ) {
        self.id = id
        self.serviceIdentifier = serviceIdentifier
        self.username = username
        self.displayName = displayName
        self.itemTitle = itemTitle
        self.folderName = folderName
    }
}

public struct AutoFillResolvedCredential: Codable, Sendable, Equatable {
    public let candidateID: String
    public let username: String
    public let password: String

    public init(candidateID: String, username: String, password: String) {
        self.candidateID = candidateID
        self.username = username
        self.password = password
    }
}

public enum AutoFillProviderError: Error, Equatable {
    case locked
    case unavailable
    case candidateNotFound
}

public struct AutoFillAccessGrant: Sendable, Equatable {
    public enum Source: String, Sendable {
        case alreadyUnlockedSession
        case localAuthentication
    }

    public let source: Source

    private init(source: Source) {
        self.source = source
    }

    public static func alreadyUnlockedSession() -> AutoFillAccessGrant {
        AutoFillAccessGrant(source: .alreadyUnlockedSession)
    }

    public static func localAuthenticationSucceeded() -> AutoFillAccessGrant {
        AutoFillAccessGrant(source: .localAuthentication)
    }
}

public protocol AutoFillCredentialProviding: Sendable {
    func candidates(for serviceIdentifiers: [String]) async throws -> [AutoFillCredentialCandidate]
    func password(for candidateID: String, accessGrant: AutoFillAccessGrant?) async throws -> AutoFillResolvedCredential
}

public struct DomainFilteringAutoFillProvider: AutoFillCredentialProviding {
    private let matcher: DomainMatcher
    private let indexStore: AutoFillIndexStoring
    private let secretResolver: AutoFillSecretResolving

    public init(
        matcher: DomainMatcher = DomainMatcher(),
        indexStore: AutoFillIndexStoring,
        secretResolver: AutoFillSecretResolving
    ) {
        self.matcher = matcher
        self.indexStore = indexStore
        self.secretResolver = secretResolver
    }

    public func candidates(for serviceIdentifiers: [String]) async throws -> [AutoFillCredentialCandidate] {
        let all = try await indexStore.loadCandidates()
        let requested = serviceIdentifiers.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !requested.isEmpty else {
            return []
        }
        return all.filter { candidate in
            requested.contains { matcher.matches(credentialWebsite: candidate.serviceIdentifier, requestedHostOrURL: $0) }
        }
    }

    public func password(for candidateID: String, accessGrant: AutoFillAccessGrant?) async throws -> AutoFillResolvedCredential {
        guard accessGrant != nil else {
            throw AutoFillProviderError.locked
        }
        return try await secretResolver.resolveCredential(candidateID: candidateID)
    }
}

public protocol AutoFillIndexStoring: Sendable {
    func loadCandidates() async throws -> [AutoFillCredentialCandidate]
}

public protocol AutoFillSecretResolving: Sendable {
    func resolveCredential(candidateID: String) async throws -> AutoFillResolvedCredential
}
