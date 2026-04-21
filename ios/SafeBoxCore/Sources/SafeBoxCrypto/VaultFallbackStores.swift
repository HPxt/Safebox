public struct FallbackUserKDFProfileProvider: UserKDFProfileProviding {
    private let providers: [any UserKDFProfileProviding]

    public init(providers: [any UserKDFProfileProviding]) {
        self.providers = providers
    }

    public func fetchKDFProfile() async throws -> UserKDFProfile? {
        for provider in providers {
            if let profile = try await provider.fetchKDFProfile() {
                return profile
            }
        }
        return nil
    }
}

public struct FallbackVaultRemoteStore: VaultRemoteStoring {
    private let writeStore: any VaultRemoteStoring
    private let readStores: [any VaultRemoteStoring]
    private let folderStore: (any VaultRemoteStoring)?

    public init(
        primary: any VaultRemoteStoring,
        readFallbacks: [any VaultRemoteStoring] = [],
        folderStore: (any VaultRemoteStoring)? = nil
    ) {
        self.writeStore = primary
        self.readStores = [primary] + readFallbacks
        self.folderStore = folderStore
    }

    public func fetchVault() async throws -> VaultRecord? {
        var lastError: Error?
        for store in readStores {
            do {
                if let record = try await store.fetchVault() {
                    return record
                }
            } catch {
                lastError = error
                continue
            }
        }
        if let lastError {
            throw lastError
        }
        return nil
    }

    public func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        try await writeStore.createVault(payload)
    }

    public func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        try await writeStore.updateVault(payload)
    }

    public func fetchFolders() async throws -> [FolderSummary] {
        do {
            return try await (folderStore ?? writeStore).fetchFolders()
        } catch {
            throw VaultSyncError.folderLoadFailed
        }
    }
}
