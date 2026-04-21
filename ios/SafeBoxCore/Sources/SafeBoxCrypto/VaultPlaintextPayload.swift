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

    private static func validateCredentialArray(_ data: Data) throws {
        let json = try JSONSerialization.jsonObject(with: data)
        guard json is [[String: Any]] else {
            throw VaultSyncError.invalidPlaintext
        }
    }
}
