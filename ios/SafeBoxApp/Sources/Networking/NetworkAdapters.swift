import Foundation
import SafeBoxCrypto

final class SafeBoxSessionStore: @unchecked Sendable {
    private let lock = NSLock()
    private var accessToken: String?
    private var currentUserID: String?
    private var userMetadata: [String: Any] = [:]

    func update(accessToken: String, userID: String, userMetadata: [String: Any]) {
        lock.lock()
        self.accessToken = accessToken
        self.currentUserID = userID
        self.userMetadata = userMetadata
        lock.unlock()
    }

    func clear() {
        lock.lock()
        accessToken = nil
        currentUserID = nil
        userMetadata = [:]
        lock.unlock()
    }

    func token() throws -> String {
        lock.lock()
        defer { lock.unlock() }
        guard let accessToken else {
            throw SafeBoxAppError.missingProductionAdapter("authenticated access token")
        }
        return accessToken
    }

    func userID() throws -> String {
        lock.lock()
        defer { lock.unlock() }
        guard let currentUserID else {
            throw SafeBoxAppError.missingProductionAdapter("authenticated user id")
        }
        return currentUserID
    }

    func metadata() -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        return userMetadata
    }
}

struct SupabasePasswordAuthProvider: AuthSessionProviding {
    let supabaseURL: URL
    let anonKey: String
    let sessionStore: SafeBoxSessionStore
    let urlSession: URLSession

    init(supabaseURL: URL, anonKey: String, sessionStore: SafeBoxSessionStore, urlSession: URLSession = .shared) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.sessionStore = sessionStore
        self.urlSession = urlSession
    }

    func signIn(email: String, password: String) async throws {
        let url = supabaseURL.appendingPathComponent("auth/v1/token")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        guard let requestURL = components?.url else {
            throw SafeBoxAppError.missingProductionAdapter("Supabase auth URL")
        }

        var request = URLRequest(url: requestURL)
        request.httpMethod = "POST"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])

        let (data, response) = try await urlSession.data(for: request)
        try HTTPResponseValidator.validate(response: response, data: data)
        let payload = try JSONDecoder().decode(AuthTokenResponse.self, from: data)
        sessionStore.update(
            accessToken: payload.accessToken,
            userID: payload.user.id,
            userMetadata: payload.user.userMetadata ?? [:]
        )
    }

    func signOut() async throws {
        sessionStore.clear()
    }

    func currentUserID() throws -> String? {
        try? sessionStore.userID()
    }
}

struct SupabaseUsersKDFProfileProvider: UserKDFProfileProviding {
    let supabaseURL: URL
    let anonKey: String
    let sessionStore: SafeBoxSessionStore
    let urlSession: URLSession

    init(supabaseURL: URL, anonKey: String, sessionStore: SafeBoxSessionStore, urlSession: URLSession = .shared) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.sessionStore = sessionStore
        self.urlSession = urlSession
    }

    func fetchKDFProfile() async throws -> UserKDFProfile? {
        let userID = try sessionStore.userID()
        var components = URLComponents(url: supabaseURL.appendingPathComponent("rest/v1/users"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "id", value: "eq.\(userID)"),
            URLQueryItem(name: "select", value: "kdf_salt,kdf_params,key_hash")
        ]
        guard let url = components?.url else {
            throw VaultSyncError.missingKDFProfile
        }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(try sessionStore.token())", forHTTPHeaderField: "Authorization")

        let (data, response) = try await urlSession.data(for: request)
        try HTTPResponseValidator.validate(response: response, data: data)
        let rows = try JSONDecoder().decode([UserKDFRow].self, from: data)
        return rows.first?.profile(source: .usersTable)
    }
}

struct SupabaseMetadataKDFProfileProvider: UserKDFProfileProviding {
    let sessionStore: SafeBoxSessionStore

    func fetchKDFProfile() async throws -> UserKDFProfile? {
        let metadata = sessionStore.metadata()
        guard
            let salt = metadata["kdf_salt"] as? String,
            let hash = metadata["key_hash"] as? String,
            let paramsJSON = metadata["kdf_params"]
        else {
            return nil
        }

        let paramsData = try JSONSerialization.data(withJSONObject: paramsJSON)
        let params = try JSONDecoder().decode(KDFParams.self, from: paramsData)
        return UserKDFProfile(saltBase64: salt, params: params, keyHashBase64: hash, source: .userMetadata)
    }
}

struct BackendVaultRemoteStore: VaultRemoteStoring {
    let backendURL: URL
    let sessionStore: SafeBoxSessionStore
    let urlSession: URLSession

    init(backendURL: URL, sessionStore: SafeBoxSessionStore, urlSession: URLSession = .shared) {
        self.backendURL = backendURL
        self.sessionStore = sessionStore
        self.urlSession = urlSession
    }

    func fetchVault() async throws -> VaultRecord? {
        let data = try await request(path: "api/vault", method: "GET", body: nil)
        let response = try JSONDecoder().decode(APIResponse<VaultDTO>.self, from: data)
        return response.data?.record(source: .backend)
    }

    func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        let body = try JSONEncoder().encode(VaultWriteBody(encryptedData: payload.encryptedData, dataHash: payload.dataHash, expectedVersion: nil))
        let data = try await request(path: "api/vault", method: "POST", body: body)
        let response = try JSONDecoder().decode(APIResponse<VaultDTO>.self, from: data)
        guard let record = response.data?.record(source: .backend) else {
            throw VaultSyncError.emptyVault
        }
        return record
    }

    func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        let body = try JSONEncoder().encode(VaultWriteBody(encryptedData: payload.encryptedData, dataHash: payload.dataHash, expectedVersion: payload.expectedVersion))
        let data = try await request(path: "api/vault", method: "PUT", body: body)
        let response = try JSONDecoder().decode(APIResponse<VaultDTO>.self, from: data)
        guard let record = response.data?.record(source: .backend) else {
            throw VaultSyncError.emptyVault
        }
        return record
    }

    func fetchFolders() async throws -> [FolderSummary] {
        []
    }

    private func request(path: String, method: String, body: Data?) async throws -> Data {
        var request = URLRequest(url: backendURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("Bearer \(try sessionStore.token())", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await urlSession.data(for: request)
        try HTTPResponseValidator.validate(response: response, data: data)
        return data
    }
}

struct SupabaseDirectVaultReadStore: VaultRemoteStoring {
    let supabaseURL: URL
    let anonKey: String
    let sessionStore: SafeBoxSessionStore
    let urlSession: URLSession

    init(supabaseURL: URL, anonKey: String, sessionStore: SafeBoxSessionStore, urlSession: URLSession = .shared) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.sessionStore = sessionStore
        self.urlSession = urlSession
    }

    func fetchVault() async throws -> VaultRecord? {
        if let credentialsVault = try await fetchCredentialsVault() {
            return credentialsVault
        }
        return try await fetchLegacyVault()
    }

    func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        _ = payload
        throw SafeBoxAppError.missingProductionAdapter("Direct Supabase vault writes are disabled on iOS v1")
    }

    func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        _ = payload
        throw SafeBoxAppError.missingProductionAdapter("Direct Supabase vault writes are disabled on iOS v1")
    }

    func fetchFolders() async throws -> [FolderSummary] {
        []
    }

    private func fetchCredentialsVault() async throws -> VaultRecord? {
        let data = try await supabaseRequest(
            table: "credentials",
            queryItems: [
                URLQueryItem(name: "select", value: "id,enc_blob,data_hash,version,created_at,updated_at"),
                URLQueryItem(name: "user_id", value: "eq.\(try sessionStore.userID())"),
                URLQueryItem(name: "enc_blob", value: "not.is.null"),
                URLQueryItem(name: "order", value: "updated_at.desc"),
                URLQueryItem(name: "limit", value: "1"),
            ]
        )
        let rows = try JSONDecoder().decode([CredentialVaultRow].self, from: data)
        return rows.first?.record()
    }

    private func fetchLegacyVault() async throws -> VaultRecord? {
        let data = try await supabaseRequest(
            table: "vaults",
            queryItems: [
                URLQueryItem(name: "select", value: "id,encrypted_data,data_hash,version,created_at,updated_at"),
                URLQueryItem(name: "user_id", value: "eq.\(try sessionStore.userID())"),
                URLQueryItem(name: "order", value: "updated_at.desc"),
                URLQueryItem(name: "limit", value: "1"),
            ]
        )
        let rows = try JSONDecoder().decode([LegacyVaultRow].self, from: data)
        return try rows.first?.record()
    }

    private func supabaseRequest(table: String, queryItems: [URLQueryItem]) async throws -> Data {
        var components = URLComponents(url: supabaseURL.appendingPathComponent("rest/v1/\(table)"), resolvingAgainstBaseURL: false)
        components?.queryItems = queryItems
        guard let url = components?.url else {
            throw SafeBoxAppError.missingProductionAdapter("Supabase REST URL")
        }
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(try sessionStore.token())", forHTTPHeaderField: "Authorization")
        let (data, response) = try await urlSession.data(for: request)
        try HTTPResponseValidator.validate(response: response, data: data)
        return data
    }
}

struct SupabaseFoldersRemoteStore: VaultRemoteStoring {
    let supabaseURL: URL
    let anonKey: String
    let sessionStore: SafeBoxSessionStore
    let urlSession: URLSession

    init(supabaseURL: URL, anonKey: String, sessionStore: SafeBoxSessionStore, urlSession: URLSession = .shared) {
        self.supabaseURL = supabaseURL
        self.anonKey = anonKey
        self.sessionStore = sessionStore
        self.urlSession = urlSession
    }

    func fetchVault() async throws -> VaultRecord? {
        throw SafeBoxAppError.missingProductionAdapter("SupabaseFoldersRemoteStore.fetchVault")
    }

    func createVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        _ = payload
        throw SafeBoxAppError.missingProductionAdapter("SupabaseFoldersRemoteStore.createVault")
    }

    func updateVault(_ payload: VaultWritePayload) async throws -> VaultRecord {
        _ = payload
        throw SafeBoxAppError.missingProductionAdapter("SupabaseFoldersRemoteStore.updateVault")
    }

    func fetchFolders() async throws -> [FolderSummary] {
        var components = URLComponents(url: supabaseURL.appendingPathComponent("rest/v1/folders"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "select", value: "id,name"),
            URLQueryItem(name: "user_id", value: "eq.\(try sessionStore.userID())"),
            URLQueryItem(name: "order", value: "name.asc"),
        ]
        guard let url = components?.url else {
            throw VaultSyncError.folderLoadFailed
        }

        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(try sessionStore.token())", forHTTPHeaderField: "Authorization")
        let (data, response) = try await urlSession.data(for: request)
        try HTTPResponseValidator.validate(response: response, data: data)
        return try JSONDecoder().decode([FolderRow].self, from: data).map { $0.summary() }
    }
}

enum HTTPResponseValidator {
    static func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            return
        }
        if http.statusCode == 409 {
            throw VaultSyncError.versionConflict
        }
        if http.statusCode == 401 {
            throw SafeBoxAppError.authSessionExpired
        }
        guard (200..<300).contains(http.statusCode) else {
            throw SafeBoxAppError.httpRequestFailed(
                statusCode: http.statusCode,
                code: sanitizedErrorCode(from: data)
            )
        }
    }

    private static func sanitizedErrorCode(from data: Data) -> String? {
        guard
            let body = try? JSONDecoder().decode(APIErrorBody.self, from: data),
            let rawCode = body.code?.trimmingCharacters(in: .whitespacesAndNewlines),
            rawCode.range(of: #"^[A-Z0-9_:-]{1,64}$"#, options: .regularExpression) != nil
        else {
            return nil
        }
        return rawCode
    }
}

private struct APIErrorBody: Decodable {
    let code: String?
}

private struct AuthTokenResponse: Decodable {
    let accessToken: String
    let user: AuthUser

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case user
    }
}

private struct AuthUser: Decodable {
    let id: String
    let userMetadata: [String: Any]?

    enum CodingKeys: String, CodingKey {
        case id
        case userMetadata = "user_metadata"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        if let value = try? container.decode(JSONValue.self, forKey: .userMetadata) {
            userMetadata = value.objectValue
        } else {
            userMetadata = nil
        }
    }
}

private struct UserKDFRow: Decodable {
    let kdfSalt: String
    let kdfParams: KDFParams
    let keyHash: String

    enum CodingKeys: String, CodingKey {
        case kdfSalt = "kdf_salt"
        case kdfParams = "kdf_params"
        case keyHash = "key_hash"
    }

    func profile(source: KDFProfileSource) -> UserKDFProfile {
        UserKDFProfile(saltBase64: kdfSalt, params: kdfParams, keyHashBase64: keyHash, source: source)
    }
}

private struct APIResponse<T: Decodable>: Decodable {
    let success: Bool?
    let data: T?
}

private struct VaultDTO: Decodable {
    let encryptedData: String
    let dataHash: String
    let version: Int

    enum CodingKeys: String, CodingKey {
        case encryptedData
        case dataHash
        case version
    }

    func record(source: VaultFetchSource) -> VaultRecord {
        VaultRecord(encryptedData: encryptedData, dataHash: dataHash, version: version, source: source)
    }
}

private struct VaultWriteBody: Encodable {
    let encryptedData: String
    let dataHash: String
    let expectedVersion: Int?
}

private struct CredentialVaultRow: Decodable {
    let encBlob: String
    let dataHash: String
    let version: Int

    enum CodingKeys: String, CodingKey {
        case encBlob = "enc_blob"
        case dataHash = "data_hash"
        case version
    }

    func record() -> VaultRecord {
        VaultRecord(
            encryptedData: encBlob,
            dataHash: dataHash,
            version: version,
            source: .supabaseCredentials
        )
    }
}

private struct LegacyVaultRow: Decodable {
    let encryptedData: VaultSnapshotV2Envelope
    let dataHash: String
    let version: Int

    enum CodingKeys: String, CodingKey {
        case encryptedData = "encrypted_data"
        case dataHash = "data_hash"
        case version
    }

    func record() throws -> VaultRecord {
        let envelopeJSON = try VaultEnvelopeCodec().canonicalEnvelopeJSON(envelope: encryptedData)
        return VaultRecord(
            encryptedData: String(decoding: envelopeJSON, as: UTF8.self),
            dataHash: dataHash,
            version: version,
            source: .supabaseLegacyVaults
        )
    }
}

private struct FolderRow: Decodable {
    let id: String
    let name: String

    func summary() -> FolderSummary {
        FolderSummary(id: id, name: name)
    }
}

private enum JSONValue: Decodable {
    case object([String: Any])
    case array([Any])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value.mapValues(\.anyValue))
        } else {
            let value = try container.decode([JSONValue].self)
            self = .array(value.map(\.anyValue))
        }
    }

    var objectValue: [String: Any]? {
        if case let .object(value) = self {
            return value
        }
        return nil
    }

    var anyValue: Any {
        switch self {
        case let .object(value):
            return value
        case let .array(value):
            return value
        case let .string(value):
            return value
        case let .number(value):
            return value
        case let .bool(value):
            return value
        case .null:
            return NSNull()
        }
    }
}
