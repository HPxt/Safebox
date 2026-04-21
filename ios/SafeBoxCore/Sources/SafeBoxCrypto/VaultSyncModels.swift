import Foundation

public enum VaultSyncError: Error, Equatable {
    case missingKDFProfile
    case tamperDetected
    case emptyVault
    case unsupportedEnvelope
    case invalidPlaintext
    case versionConflict
    case folderLoadFailed
}

public enum KDFProfileSource: String, Sendable, Equatable {
    case usersTable
    case userMetadata
}

public struct UserKDFProfile: Sendable, Equatable {
    public let saltBase64: String
    public let params: KDFParams
    public let keyHashBase64: String
    public let source: KDFProfileSource

    public init(saltBase64: String, params: KDFParams, keyHashBase64: String, source: KDFProfileSource) {
        self.saltBase64 = saltBase64
        self.params = params
        self.keyHashBase64 = keyHashBase64
        self.source = source
    }
}

public struct UnlockedVaultSession: Sendable, Equatable {
    public let key: Data
    public let keyHashBase64: String
    public let kdfParams: KDFParams
    public let kdfLevel: KDFLevel
    public let warning: MobileKDFPolicyState?

    public init(
        key: Data,
        keyHashBase64: String,
        kdfParams: KDFParams,
        kdfLevel: KDFLevel,
        warning: MobileKDFPolicyState?
    ) {
        self.key = key
        self.keyHashBase64 = keyHashBase64
        self.kdfParams = kdfParams
        self.kdfLevel = kdfLevel
        self.warning = warning
    }
}

public enum VaultFetchSource: String, Sendable, Equatable {
    case backend
    case supabaseCredentials
    case supabaseLegacyVaults
}

public struct VaultRecord: Sendable, Equatable {
    public let encryptedData: String
    public let dataHash: String
    public let version: Int
    public let source: VaultFetchSource

    public init(encryptedData: String, dataHash: String, version: Int, source: VaultFetchSource) {
        self.encryptedData = encryptedData
        self.dataHash = dataHash
        self.version = version
        self.source = source
    }
}

public struct VaultWritePayload: Sendable, Equatable {
    public let encryptedData: String
    public let dataHash: String
    public let expectedVersion: Int?

    public init(encryptedData: String, dataHash: String, expectedVersion: Int?) {
        self.encryptedData = encryptedData
        self.dataHash = dataHash
        self.expectedVersion = expectedVersion
    }
}

public struct FolderSummary: Sendable, Equatable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct VaultReadResult: Sendable, Equatable {
    public let record: VaultRecord
    public let plaintext: VaultPlaintextPayload
    public let folders: [FolderSummary]

    public init(record: VaultRecord, plaintext: VaultPlaintextPayload, folders: [FolderSummary]) {
        self.record = record
        self.plaintext = plaintext
        self.folders = folders
    }
}

public protocol UserKDFProfileProviding: Sendable {
    func fetchKDFProfile() async throws -> UserKDFProfile?
}

public protocol VaultRemoteStoring: Sendable {
    func fetchVault() async throws -> VaultRecord?
    func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord
    func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord
    func fetchFolders() async throws -> [FolderSummary]
}
