import Foundation
import SafeBoxCrypto

enum AutoFillSharedIndexStoreError: Error {
    case appGroupUnavailable
}

/// App Group storage for minimal AutoFill index metadata only.
/// Never persist plaintext passwords, vault key material, or full vault payload.
struct AutoFillSharedIndexStore: AutoFillIndexStoring {
    private let appGroupID: String
    private let fileName: String

    init(
        appGroupID: String = "group.app.safebox.ios.shared",
        fileName: String = "autofill-index.json"
    ) {
        self.appGroupID = appGroupID
        self.fileName = fileName
    }

    func loadCandidates() async throws -> [AutoFillCredentialCandidate] {
        let fileURL = try indexFileURL()
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return []
        }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode([AutoFillCredentialCandidate].self, from: data)
    }

    func replaceCandidates(_ candidates: [AutoFillCredentialCandidate]) throws {
        let fileURL = try indexFileURL()
        let data = try JSONEncoder().encode(candidates)
        try data.write(to: fileURL, options: [.atomic])
    }

    private func indexFileURL() throws -> URL {
        guard let baseURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            throw AutoFillSharedIndexStoreError.appGroupUnavailable
        }
        return baseURL.appendingPathComponent(fileName, isDirectory: false)
    }
}
