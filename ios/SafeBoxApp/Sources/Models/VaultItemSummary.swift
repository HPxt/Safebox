import Foundation
import SafeBoxCrypto

struct VaultItemSummary: Identifiable, Equatable {
    let id: String
    let title: String
    let subtitle: String
    let itemType: String
    let folderName: String?
    /// Host do site (campo `website` do item) para AutoFill; opcional.
    let website: String?
    let username: String?

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
                folderName: folderId.flatMap { folderNames[$0] },
                website: website,
                username: username
            )
        }
    }

    /// Metadado apenas (sem senha) para o índice compartilhado com a extensão.
    func autoFillCredentialCandidate() -> AutoFillCredentialCandidate? {
        guard itemType.lowercased() == "credential" else { return nil }
        guard let website, let host = AutoFillServiceIdentifierNormalization.host(from: website) else {
            return nil
        }
        let user: String
        if let username, !username.isEmpty {
            user = username
        } else {
            user = subtitle
        }
        return AutoFillCredentialCandidate(
            id: id,
            serviceIdentifier: host,
            username: user,
            displayName: title,
            itemTitle: title,
            folderName: folderName
        )
    }
}
