import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
import SafeBoxCrypto
@testable import SafeBoxNativeAdapters

final class StagingFlowTests: XCTestCase {
    struct Fixture: Decodable {
        struct User: Decodable { let email: String; let password: String }
        let users: [User]
        let masterPassword: String
    }
    private let authURL = URL(string: "https://xxynxmktvonnldokhyem.supabase.co")!
    private let backendURL = URL(string: "https://safebox-backend-staging.vercel.app")!
    private let publicKey = "sb_publishable_4_j0-3MA5vPNhLbAIsuwzw_UA1SjRg3"

    func testNativeReadsWebCryptoWrite() async throws {
        guard ProcessInfo.processInfo.environment["SAFEBOX_NATIVE_FLOW_PHASE"] == "web-readback",
              let file = ProcessInfo.processInfo.environment["SAFEBOX_STAGING_FIXTURE"] else {
            throw XCTSkip("Executed only after the runner verifies Swift ciphertext and writes with WebCrypto")
        }
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: URL(fileURLWithPath: file)))
        let environment = SafeBoxAppEnvironment.production(supabaseURL: authURL, supabaseAnonKey: publicKey, backendURL: backendURL)
        try await environment.auth.signIn(email: fixture.users[0].email, password: fixture.users[0].password)
        let unlock = VaultUnlockService(profileProvider: environment.profileProvider,
                                        guardService: UnlockSessionGuard(kdfPipeline: environment.kdfPipeline))
        let session = try await unlock.unlock(masterPassword: fixture.masterPassword)
        let read = try await VaultSyncService(remoteStore: environment.vaultStore).readVault(key: session.key)
        let items = try XCTUnwrap(JSONSerialization.jsonObject(with: read.plaintext.rawJSON) as? [[String: Any]])
        XCTAssertEqual(read.record.version, 3)
        XCTAssertTrue(items.first?["notes"] as? String == "WebCrypto synthetic roundtrip")
        try await environment.auth.signOut()
        print("CHECK: production-composed native adapters decrypt the WebCrypto-written snapshot")
    }

    func testRealNativeStagingFlow() async throws {
        if ProcessInfo.processInfo.environment["SAFEBOX_NATIVE_FLOW_PHASE"] == "web-readback" {
            throw XCTSkip("Initial flow already completed")
        }
        guard let file = ProcessInfo.processInfo.environment["SAFEBOX_STAGING_FIXTURE"] else {
            throw XCTSkip("Opt-in only: use scripts/staging/test-native.mjs")
        }
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: URL(fileURLWithPath: file)))
        let clock = TestClock()
        let store = SafeBoxSessionStore(supabaseURL: authURL, anonKey: publicKey, now: { clock.now() })
        let auth = SupabasePasswordAuthProvider(supabaseURL: authURL, anonKey: publicKey, sessionStore: store)
        let remote = BackendVaultRemoteStore(backendURL: backendURL, sessionStore: store)
        let profile = SupabaseUsersKDFProfileProvider(supabaseURL: authURL, anonKey: publicKey, sessionStore: store)
        let pipeline = KDFPipeline(argon2Provider: LibArgon2Provider())
        let unlock = VaultUnlockService(profileProvider: profile, guardService: UnlockSessionGuard(kdfPipeline: pipeline))

        do {
            try await auth.signIn(email: fixture.users[0].email, password: UUID().uuidString)
            XCTFail("Incorrect login password accepted")
        } catch { XCTAssertThrowsError(try store.token()) }
        try await auth.signIn(email: fixture.users[0].email, password: fixture.users[0].password)
        XCTAssertNotNil(try auth.currentUserID())
        print("CHECK: real native login and incorrect-password rejection passed")

        do {
            _ = try await unlock.unlock(masterPassword: "Wrong-Synthetic-Master-Password!")
            XCTFail("Incorrect master password accepted")
        } catch { XCTAssertTrue(error as? VaultCryptoError == .invalidMasterPassword) }
        let session = try await unlock.unlock(masterPassword: fixture.masterPassword)
        XCTAssertEqual(session.key.count, 32)
        print("CHECK: real KDF profile, wrong master rejection and local Argon2 unlock passed")

        let sync = VaultSyncService(remoteStore: remote)
        let draft = VaultCredentialDraft(title: "Synthetic native flow", username: "fictitious-user",
                                        password: "Synthetic-Vault-Only!", website: "https://example.test")
        let plaintext = try VaultPlaintextPayload(jsonString: "[]").upsertingCredential(draft)
        let created = try await sync.writeVault(plaintext: plaintext, key: session.key, expectedVersion: nil)
        XCTAssertEqual(created.version, 1)
        XCTAssertFalse(created.encryptedData.contains(draft.password))
        let read = try await sync.readVault(key: session.key)
        XCTAssertTrue(try read.plaintext.credentialDraft(id: draft.id)?.password == draft.password)
        print("CHECK: native AES-GCM create, HTTPS read and local decrypt passed")

        let direct = SupabaseDirectVaultReadStore(supabaseURL: authURL, anonKey: publicKey, sessionStore: store)
        let directRead = try await VaultSyncService(remoteStore: direct).readVault(key: session.key)
        XCTAssertTrue(try directRead.plaintext.credentialDraft(id: draft.id)?.password == draft.password)
        print("CHECK: native direct Supabase read fallback and local decrypt passed")

        let otherStore = SafeBoxSessionStore(supabaseURL: authURL, anonKey: publicKey)
        let otherAuth = SupabasePasswordAuthProvider(supabaseURL: authURL, anonKey: publicKey, sessionStore: otherStore)
        try await otherAuth.signIn(email: fixture.users[1].email, password: fixture.users[1].password)
        let otherVault = try await BackendVaultRemoteStore(backendURL: backendURL, sessionStore: otherStore).fetchVault()
        XCTAssertNil(otherVault)
        let otherDirect = try await SupabaseDirectVaultReadStore(supabaseURL: authURL, anonKey: publicKey, sessionStore: otherStore).fetchVault()
        XCTAssertNil(otherDirect)
        try await otherAuth.signOut()
        print("CHECK: user B sees no user A vault through API or REST")

        let updated = try await sync.writeVault(plaintext: plaintext, key: session.key, expectedVersion: created.version)
        XCTAssertEqual(updated.version, 2)
        do {
            _ = try await sync.writeVault(plaintext: plaintext, key: session.key, expectedVersion: created.version)
            XCTFail("Stale write accepted")
        } catch { XCTAssertTrue(error as? VaultSyncError == .versionConflict) }
        print("CHECK: native update and HTTP 409 mapping passed")

        let before = try store.token()
        clock.advance()
        XCTAssertThrowsError(try store.token())
        let rotated = try await store.validToken()
        XCTAssertTrue(before != rotated)
        _ = try await sync.readVault(key: session.key)
        print("CHECK: simulated local expiry triggered a real Supabase refresh; HTTPS read passed")

        try await auth.signOut()
        XCTAssertThrowsError(try store.token())
        XCTAssertNil(try auth.currentUserID())
        do { _ = try await remote.fetchVault(); XCTFail("Read after local logout accepted") }
        catch { XCTAssertTrue(error as? SafeBoxAppError == .authSessionExpired) }
        try await auth.signIn(email: fixture.users[0].email, password: fixture.users[0].password)
        let restored = try await unlock.unlock(masterPassword: fixture.masterPassword)
        let reopened = try await sync.readVault(key: restored.key)
        XCTAssertEqual(reopened.record.version, 2)
        try await auth.signOut()
        print("CHECK: logout clears native session; fresh login/unlock reopens encrypted vault")
    }
}

private final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var offset: TimeInterval = 0
    func now() -> Date {
        lock.lock(); defer { lock.unlock() }
        return Date().addingTimeInterval(offset)
    }
    func advance() {
        lock.lock(); defer { lock.unlock() }
        offset += 86400
    }
}
