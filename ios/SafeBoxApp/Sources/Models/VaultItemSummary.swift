import Foundation
import SafeBoxCrypto

struct VaultItemSummary: Identifiable, Equatable {
    let id: String
    let title: String
    let subtitle: String
    let itemType: String
    let folderName: String?

    static func decodeList(from data: Data, folders: [FolderSummary]) throws -> [VaultItemSummary] {
        let folderNames = Dictionary(uniqueKeysWithValues: folders.map { ($0.id, $0.name) })
        let raw = try JSONSerialization.jsonObject(with: data)
        guard let items = raw as? [[String: Any]] else {
            throw VaultSyncError.invalidPlaintext
        }

        return items.map { item in
            let id = item["id"] as? String ?? UUID().uuidString
            let title = item["title"] as? String
                ?? item["name"] as? String
                ?? "Item sem titulo"
            let username = item["username"] as? String
            let website = item["website"] as? String
            let subtitle = username?.isEmpty == false ? username! : (website ?? "Sem usuario")
            let type = item["itemType"] as? String ?? "credential"
            let folderId = item["folderId"] as? String

            return VaultItemSummary(
                id: id,
                title: title,
                subtitle: subtitle,
                itemType: type,
                folderName: folderId.flatMap { folderNames[$0] }
            )
        }
    }
}
