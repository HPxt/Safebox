import Foundation

// MARK: - Host <-> Extension session contract (E7.E)

/// Estado mínimo que o app host publica no App Group para a extensão AutoFill
/// decidir se o cofre está liberado para leitura do índice (fail-closed).
public struct AutoFillSharedHostSessionState: Codable, Sendable, Equatable {
    public var schemaVersion: Int
    public var vaultUnlocked: Bool
    public var grantExpiresAt: Date?

    public init(schemaVersion: Int = 1, vaultUnlocked: Bool, grantExpiresAt: Date?) {
        self.schemaVersion = schemaVersion
        self.vaultUnlocked = vaultUnlocked
        self.grantExpiresAt = grantExpiresAt
    }

    public func isExtensionAccessAllowed(at date: Date, expectedSchema: Int = 1) -> Bool {
        guard schemaVersion == expectedSchema else { return false }
        guard vaultUnlocked, let grantExpiresAt else { return false }
        return date < grantExpiresAt
    }
}

public protocol AutoFillHostSessionReading: Sendable {
    func loadSessionState() throws -> AutoFillSharedHostSessionState?
}

public enum AutoFillSharedStoreError: Error, Sendable, Equatable {
    case appGroupUnavailable
}

extension JSONEncoder {
    static var safeBoxISO8601: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }
}

extension JSONDecoder {
    static var safeBoxISO8601: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }
}

/// Leitura/gravação atômica do arquivo de sessão no container do App Group.
public struct AutoFillSharedSessionStore: Sendable {
    public let appGroupIdentifier: String
    public let fileName: String

    public init(appGroupIdentifier: String, fileName: String = "autofill-host-session.json") {
        self.appGroupIdentifier = appGroupIdentifier
        self.fileName = fileName
    }

    private func fileURL() throws -> URL {
        #if os(iOS) || os(macOS) || os(tvOS) || os(watchOS) || os(visionOS)
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            throw AutoFillSharedStoreError.appGroupUnavailable
        }
        return base.appendingPathComponent(fileName, isDirectory: false)
        #else
        throw AutoFillSharedStoreError.appGroupUnavailable
        #endif
    }

    public func loadState() throws -> AutoFillSharedHostSessionState? {
        let url = try fileURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        return try JSONDecoder.safeBoxISO8601.decode(AutoFillSharedHostSessionState.self, from: data)
    }

    public func saveState(_ state: AutoFillSharedHostSessionState) throws {
        let url = try fileURL()
        let data = try JSONEncoder.safeBoxISO8601.encode(state)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    public func deleteState() throws {
        let url = try fileURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        try FileManager.default.removeItem(at: url)
    }
}

extension AutoFillSharedSessionStore: AutoFillHostSessionReading {
    public func loadSessionState() throws -> AutoFillSharedHostSessionState? {
        try loadState()
    }
}

/// Índice somente metadado (`AutoFillCredentialCandidate`) no App Group — sem senhas.
public struct AutoFillSharedCandidatesStore: Sendable {
    public let appGroupIdentifier: String
    public let fileName: String

    public init(appGroupIdentifier: String, fileName: String = "autofill-index.json") {
        self.appGroupIdentifier = appGroupIdentifier
        self.fileName = fileName
    }

    private func fileURL() throws -> URL {
        #if os(iOS) || os(macOS) || os(tvOS) || os(watchOS) || os(visionOS)
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            throw AutoFillSharedStoreError.appGroupUnavailable
        }
        return base.appendingPathComponent(fileName, isDirectory: false)
        #else
        throw AutoFillSharedStoreError.appGroupUnavailable
        #endif
    }

    public func loadCandidatesSync() throws -> [AutoFillCredentialCandidate] {
        let url = try fileURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([AutoFillCredentialCandidate].self, from: data)
    }

    public func replaceCandidates(_ candidates: [AutoFillCredentialCandidate]) throws {
        let url = try fileURL()
        let data = try JSONEncoder().encode(candidates)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    public func clearAll() throws {
        try replaceCandidates([])
    }
}

extension AutoFillSharedCandidatesStore: AutoFillIndexStoring {
    public func loadCandidates() async throws -> [AutoFillCredentialCandidate] {
        try loadCandidatesSync()
    }
}

// MARK: - Normalização de host para ASCredentialServiceIdentifier

public enum AutoFillServiceIdentifierNormalization {
    public static func host(from raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let withScheme = trimmed.contains("://") ? trimmed : "https://\(trimmed)"
        if let url = URL(string: withScheme), let host = url.host, !host.isEmpty {
            return host.lowercased()
        }
        return trimmed.lowercased()
    }
}
