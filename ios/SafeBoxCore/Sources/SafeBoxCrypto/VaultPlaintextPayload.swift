import Foundation

public struct VaultPlaintextPayload: Sendable, Equatable {
    public let rawJSON: Data

    public init(rawJSON: Data) throws {
        try Self.validateCredentialArray(rawJSON)
        self.rawJSON = rawJSON
    }

    public init(jsonString: String) throws {
        try self.init(rawJSON: Data(jsonString.utf8))
    }

    public var utf8String: String {
        String(decoding: rawJSON, as: UTF8.self)
    }

    public func dataForWrite(strippingVersionFields: Bool = true) throws -> Data {
        guard strippingVersionFields else {
            return rawJSON
        }

        let json = try JSONSerialization.jsonObject(with: rawJSON)
        guard var items = json as? [[String: Any]] else {
            throw VaultSyncError.invalidPlaintext
        }

        for index in items.indices {
            items[index].removeValue(forKey: "version")
        }

        guard JSONSerialization.isValidJSONObject(items) else {
            throw VaultSyncError.invalidPlaintext
        }
        return try JSONSerialization.data(withJSONObject: items, options: [])
    }

    public func credentialDraft(id: String) throws -> VaultCredentialDraft? {
        let items = try decodedItems()
        guard let item = items.first(where: { $0["id"] as? String == id }) else {
            return nil
        }

        return VaultCredentialDraft(
            id: id,
            title: item["title"] as? String ?? "",
            username: item["username"] as? String ?? "",
            password: item["encryptedPassword"] as? String ?? "",
            website: item["website"] as? String ?? "",
            notes: item["notes"] as? String ?? ""
        )
    }

    public func upsertingCredential(_ draft: VaultCredentialDraft, now: Date = Date()) throws -> VaultPlaintextPayload {
        var items = try decodedItems()
        let timestamp = Self.iso8601Formatter.string(from: now)
        let existingIndex = items.firstIndex { $0["id"] as? String == draft.id }

        if let existingIndex {
            var item = items[existingIndex]
            item["title"] = draft.title
            item["username"] = draft.username
            item["email"] = draft.email
            item["encryptedPassword"] = draft.password
            item["website"] = cleanOptionalString(draft.website)
            item["notes"] = draft.notes
            item["updatedAt"] = timestamp
            item["itemType"] = item["itemType"] as? String ?? "credential"
            item["isFavorite"] = item["isFavorite"] as? Bool ?? false
            item["isHidden"] = item["isHidden"] as? Bool ?? false
            item.removeValue(forKey: "version")
            items[existingIndex] = item
        } else {
            items.append([
                "id": draft.id,
                "userId": draft.userId,
                "title": draft.title,
                "username": draft.username,
                "email": draft.email,
                "encryptedPassword": draft.password,
                "website": cleanOptionalString(draft.website),
                "notes": draft.notes,
                "isFavorite": false,
                "isHidden": false,
                "createdAt": timestamp,
                "updatedAt": timestamp,
                "itemType": "credential",
                "totpSecret": NSNull(),
                "requireMasterPassword": false,
            ])
        }

        return try Self(items: items)
    }

    public func deletingCredential(id: String) throws -> VaultPlaintextPayload {
        let items = try decodedItems().filter { $0["id"] as? String != id }
        return try Self(items: items)
    }

    private static func validateCredentialArray(_ data: Data) throws {
        let json = try JSONSerialization.jsonObject(with: data)
        guard json is [[String: Any]] else {
            throw VaultSyncError.invalidPlaintext
        }
    }

    private init(items: [[String: Any]]) throws {
        guard JSONSerialization.isValidJSONObject(items) else {
            throw VaultSyncError.invalidPlaintext
        }
        let data = try JSONSerialization.data(withJSONObject: items, options: [])
        try self.init(rawJSON: data)
    }

    private func decodedItems() throws -> [[String: Any]] {
        let json = try JSONSerialization.jsonObject(with: rawJSON)
        guard let items = json as? [[String: Any]] else {
            throw VaultSyncError.invalidPlaintext
        }
        return items
    }

    private func cleanOptionalString(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

public struct VaultCredentialDraft: Sendable, Equatable, Identifiable {
    public let id: String
    public var userId: String
    public var title: String
    public var username: String
    public var email: String
    public var password: String
    public var website: String
    public var notes: String

    public init(
        id: String = UUID().uuidString,
        userId: String = "",
        title: String,
        username: String = "",
        email: String = "",
        password: String,
        website: String = "",
        notes: String = ""
    ) {
        self.id = id
        self.userId = userId
        self.title = title
        self.username = username
        self.email = email
        self.password = password
        self.website = website
        self.notes = notes
    }

    public var isValidForSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !password.isEmpty
    }
}
