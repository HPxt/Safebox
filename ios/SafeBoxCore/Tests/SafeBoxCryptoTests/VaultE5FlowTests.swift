import Foundation
import XCTest
@testable import SafeBoxCrypto

final class VaultE5FlowTests: XCTestCase {
    func testUnlockFetchesProfileAndReturnsUltraWarning() async throws {
        let vector = try TestVectorsLoader3.load().kdfVectors.first { $0.name == "ultra-standard" }!
        let provider = StaticProfileProvider(profile: UserKDFProfile(
            saltBase64: vector.saltBase64,
            params: vector.kdfParams,
            keyHashBase64: vector.keyHashBase64,
            source: .usersTable
        ))
        let service = VaultUnlockService(
            profileProvider: provider,
            guardService: UnlockSessionGuard(kdfPipeline: KDFPipeline(argon2Provider: FixedArgon2Provider2(output: Data(hex: vector.derivedKeyHex)!)))
        )

        let session = try await service.unlock(masterPassword: vector.password)

        XCTAssertEqual(session.kdfLevel, .ultra)
        XCTAssertEqual(session.warning, .highResourceKdfWarning)
        XCTAssertEqual(session.keyHashBase64, vector.keyHashBase64)
    }

    func testUnlockThrowsInvalidMasterPasswordForWrongPassword() async throws {
        let vector = try TestVectorsLoader3.load().kdfVectors.first { $0.name == "low-ascii-short" }!
        let provider = StaticProfileProvider(profile: UserKDFProfile(
            saltBase64: vector.saltBase64,
            params: vector.kdfParams,
            keyHashBase64: vector.keyHashBase64,
            source: .usersTable
        ))
        let wrongKey = Data(repeating: 0xff, count: 32)
        let service = VaultUnlockService(
            profileProvider: provider,
            guardService: UnlockSessionGuard(kdfPipeline: KDFPipeline(argon2Provider: FixedArgon2Provider2(output: wrongKey)))
        )

        do {
            _ = try await service.unlock(masterPassword: "wrong")
            XCTFail("Expected invalidMasterPassword")
        } catch {
            XCTAssertEqual(error as? VaultCryptoError, .invalidMasterPassword)
        }
    }

    func testReadVaultVerifiesHashDecryptsAndLoadsFolders() async throws {
        let fixture = try TestVectorsLoader3.load()
        let vector = fixture.aeadVectors.first { $0.name == "aead-envelope-v2" }!
        let kdf = fixture.kdfVectors.first { $0.name == vector.kdfVectorRef }!
        let record = VaultRecord(
            encryptedData: vector.canonicalEnvelopeJsonUtf8,
            dataHash: vector.dataHashHexLower,
            version: 7,
            source: .backend
        )
        let remote = InMemoryVaultRemoteStore(record: record, folders: [FolderSummary(id: "folder-1", name: "Work")])
        let service = VaultSyncService(remoteStore: remote)

        let result = try await service.readVault(key: Data(hex: kdf.derivedKeyHex)!)

        XCTAssertEqual(result.record.version, 7)
        XCTAssertEqual(result.plaintext.utf8String, vector.plaintextJsonUtf8)
        XCTAssertEqual(result.folders, [FolderSummary(id: "folder-1", name: "Work")])
    }

    func testReadVaultRejectsTamperedDataHash() async throws {
        let fixture = try TestVectorsLoader3.load()
        let vector = fixture.aeadVectors[0]
        let kdf = fixture.kdfVectors.first { $0.name == vector.kdfVectorRef }!
        let record = VaultRecord(
            encryptedData: vector.canonicalEnvelopeJsonUtf8,
            dataHash: String(repeating: "0", count: 64),
            version: 1,
            source: .backend
        )
        let service = VaultSyncService(remoteStore: InMemoryVaultRemoteStore(record: record))

        do {
            _ = try await service.readVault(key: Data(hex: kdf.derivedKeyHex)!)
            XCTFail("Expected tamperDetected")
        } catch {
            XCTAssertEqual(error as? VaultSyncError, .tamperDetected)
        }
    }

    func testWriteVaultStripsVersionPreservesNullAndUnknownFields() async throws {
        let fixture = try TestVectorsLoader3.load()
        let kdf = fixture.kdfVectors.first { $0.name == "low-ascii-short" }!
        let plaintext = """
        [{"id":"1","title":"Item","version":99,"notes":null,"unknownField":{"nested":true},"itemType":"credential"}]
        """
        let payload = try VaultPlaintextPayload(jsonString: plaintext)
        let remote = InMemoryVaultRemoteStore(record: nil)
        let service = VaultSyncService(remoteStore: remote)

        let written = try await service.writeVault(
            plaintext: payload,
            key: Data(hex: kdf.derivedKeyHex)!,
            expectedVersion: nil,
            nonce12: Data(repeating: 7, count: 12)
        )
        let result = try await VaultSyncService(remoteStore: InMemoryVaultRemoteStore(record: written))
            .readVault(key: Data(hex: kdf.derivedKeyHex)!)
        let json = try JSONSerialization.jsonObject(with: result.plaintext.rawJSON) as? [[String: Any]]
        let item = try XCTUnwrap(json?.first)

        XCTAssertNil(item["version"])
        XCTAssertTrue(item.keys.contains("notes"))
        XCTAssertTrue(item["notes"] is NSNull)
        XCTAssertNotNil(item["unknownField"])
    }

    func testWriteVaultPropagatesVersionConflictFor409Handling() async throws {
        let fixture = try TestVectorsLoader3.load()
        let kdf = fixture.kdfVectors.first { $0.name == "low-ascii-short" }!
        let remote = InMemoryVaultRemoteStore(record: nil, updateError: VaultSyncError.versionConflict)
        let service = VaultSyncService(remoteStore: remote)
        let payload = try VaultPlaintextPayload(jsonString: "[]")

        do {
            _ = try await service.writeVault(
                plaintext: payload,
                key: Data(hex: kdf.derivedKeyHex)!,
                expectedVersion: 3,
                nonce12: Data(repeating: 1, count: 12)
            )
            XCTFail("Expected versionConflict")
        } catch {
            XCTAssertEqual(error as? VaultSyncError, .versionConflict)
        }
    }

    func testFallbackProfileProviderUsesMetadataWhenUsersTableIsMissing() async throws {
        let vector = try TestVectorsLoader3.load().kdfVectors.first { $0.name == "low-ascii-short" }!
        let metadataProfile = UserKDFProfile(
            saltBase64: vector.saltBase64,
            params: vector.kdfParams,
            keyHashBase64: vector.keyHashBase64,
            source: .userMetadata
        )
        let provider = FallbackUserKDFProfileProvider(providers: [
            StaticProfileProvider(profile: nil),
            StaticProfileProvider(profile: metadataProfile)
        ])

        let profile = try await provider.fetchKDFProfile()

        XCTAssertEqual(profile?.source, .userMetadata)
        XCTAssertEqual(profile?.keyHashBase64, vector.keyHashBase64)
    }

    func testFallbackVaultStoreReadsBackendThenSupabaseCredentialsThenLegacyVaults() async throws {
        let fixture = try TestVectorsLoader3.load()
        let vector = fixture.aeadVectors.first { $0.name == "aead-envelope-v2" }!
        let kdf = fixture.kdfVectors.first { $0.name == vector.kdfVectorRef }!
        let legacyRecord = VaultRecord(
            encryptedData: vector.canonicalEnvelopeJsonUtf8,
            dataHash: vector.dataHashHexLower,
            version: 4,
            source: .supabaseLegacyVaults
        )
        let backend = InMemoryVaultRemoteStore(record: nil)
        let credentials = InMemoryVaultRemoteStore(record: nil)
        let legacy = InMemoryVaultRemoteStore(record: legacyRecord)
        let folders = InMemoryVaultRemoteStore(record: nil, folders: [FolderSummary(id: "folder-legacy", name: "Legacy")])
        let fallback = FallbackVaultRemoteStore(
            primary: backend,
            readFallbacks: [credentials, legacy],
            folderStore: folders
        )
        let service = VaultSyncService(remoteStore: fallback)

        let result = try await service.readVault(key: Data(hex: kdf.derivedKeyHex)!)

        XCTAssertEqual(result.record.source, .supabaseLegacyVaults)
        XCTAssertEqual(result.record.version, 4)
        XCTAssertEqual(result.folders, [FolderSummary(id: "folder-legacy", name: "Legacy")])
    }

    func testFallbackVaultStoreContinuesWhenBackendFetchFails() async throws {
        let fixture = try TestVectorsLoader3.load()
        let vector = fixture.aeadVectors.first { $0.name == "aead-envelope-v2" }!
        let fallbackRecord = VaultRecord(
            encryptedData: vector.canonicalEnvelopeJsonUtf8,
            dataHash: vector.dataHashHexLower,
            version: 8,
            source: .supabaseCredentials
        )
        let backend = InMemoryVaultRemoteStore(record: nil, fetchError: VaultSyncError.emptyVault)
        let credentials = InMemoryVaultRemoteStore(record: fallbackRecord)
        let fallback = FallbackVaultRemoteStore(primary: backend, readFallbacks: [credentials])

        let record = try await fallback.fetchVault()

        XCTAssertEqual(record?.source, .supabaseCredentials)
        XCTAssertEqual(record?.version, 8)
    }

    func testFallbackVaultStoreMapsFolderFailuresToStableError() async throws {
        let failingFolders = InMemoryVaultRemoteStore(record: nil, foldersError: VaultSyncError.emptyVault)
        let fallback = FallbackVaultRemoteStore(
            primary: InMemoryVaultRemoteStore(record: nil),
            folderStore: failingFolders
        )

        do {
            _ = try await fallback.fetchFolders()
            XCTFail("Expected folderLoadFailed")
        } catch {
            XCTAssertEqual(error as? VaultSyncError, .folderLoadFailed)
        }
    }
}

private final class StaticProfileProvider: UserKDFProfileProviding, @unchecked Sendable {
    let profile: UserKDFProfile?

    init(profile: UserKDFProfile?) {
        self.profile = profile
    }

    func fetchKDFProfile() async throws -> UserKDFProfile? {
        profile
    }
}

private final class InMemoryVaultRemoteStore: VaultRemoteStoring, @unchecked Sendable {
    private var record: VaultRecord?
    private let folders: [FolderSummary]
    private let fetchError: Error?
    private let updateError: Error?
    private let foldersError: Error?

    init(
        record: VaultRecord?,
        folders: [FolderSummary] = [],
        fetchError: Error? = nil,
        updateError: Error? = nil,
        foldersError: Error? = nil
    ) {
        self.record = record
        self.folders = folders
        self.fetchError = fetchError
        self.updateError = updateError
        self.foldersError = foldersError
    }

    func fetchVault() async throws -> VaultRecord? {
        if let fetchError {
            throw fetchError
        }
        return record
    }

    func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        let record = VaultRecord(encryptedData: payload.encryptedData, dataHash: payload.dataHash, version: 1, source: .backend)
        self.record = record
        return record
    }

    func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        if let updateError {
            throw updateError
        }
        let record = VaultRecord(encryptedData: payload.encryptedData, dataHash: payload.dataHash, version: (payload.expectedVersion ?? 0) + 1, source: .backend)
        self.record = record
        return record
    }

    func fetchFolders() async throws -> [FolderSummary] {
        if let foldersError {
            throw foldersError
        }
        return folders
    }
}

private struct FixedArgon2Provider2: Argon2Providing {
    let output: Data

    func deriveKey(password: Data, salt: Data, params: KDFParams) throws -> Data {
        output
    }
}

private struct TestVectorsFile3: Decodable {
    let kdfVectors: [KDFVector3]
    let aeadVectors: [AEADVector3]
}

private struct KDFVector3: Decodable {
    let name: String
    let password: String
    let saltBase64: String
    let kdfParams: KDFParams
    let derivedKeyHex: String
    let keyHashBase64: String
}

private struct AEADVector3: Decodable {
    let name: String
    let kdfVectorRef: String
    let plaintextJsonUtf8: String
    let canonicalEnvelopeJsonUtf8: String
    let dataHashHexLower: String
}

private enum TestVectorsLoader3 {
    static func load() throws -> TestVectorsFile3 {
        let fileURL = try XCTUnwrap(Bundle.module.url(forResource: "test-vectors", withExtension: "json"))
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(TestVectorsFile3.self, from: data)
    }
}
