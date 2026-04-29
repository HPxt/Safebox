import Foundation
import XCTest
@testable import SafeBoxCrypto

final class VaultPlaintextPayloadTests: XCTestCase {
    func testUpsertExistingCredentialPreservesUnknownFieldsAndNulls() throws {
        let payload = try VaultPlaintextPayload(jsonString: """
        [
          {
            "id": "item-1",
            "userId": "user-1",
            "title": "Old",
            "username": "old-user",
            "encryptedPassword": "old-pass",
            "website": "https://old.example.com",
            "notes": null,
            "itemType": "credential",
            "tags": ["prod"],
            "customFutureField": {"nested": true},
            "totpSecret": null,
            "version": 99,
            "createdAt": "2026-01-01T00:00:00.000Z",
            "updatedAt": "2026-01-01T00:00:00.000Z"
          }
        ]
        """)

        let updated = try payload.upsertingCredential(
            VaultCredentialDraft(
                id: "item-1",
                title: "New",
                username: "new-user",
                password: "new-pass",
                website: "https://new.example.com/login",
                notes: "kept private"
            ),
            now: Date(timeIntervalSince1970: 1_767_312_000)
        )

        let item = try XCTUnwrap(decodedItems(updated).first)
        XCTAssertEqual(item["title"] as? String, "New")
        XCTAssertEqual(item["username"] as? String, "new-user")
        XCTAssertEqual(item["encryptedPassword"] as? String, "new-pass")
        XCTAssertEqual(item["website"] as? String, "https://new.example.com/login")
        XCTAssertEqual(item["notes"] as? String, "kept private")
        XCTAssertEqual(item["tags"] as? [String], ["prod"])
        XCTAssertNotNil(item["customFutureField"])
        XCTAssertTrue(item["totpSecret"] is NSNull)
        XCTAssertNil(item["version"])
        XCTAssertEqual(item["createdAt"] as? String, "2026-01-01T00:00:00.000Z")
        XCTAssertNotEqual(item["updatedAt"] as? String, "2026-01-01T00:00:00.000Z")
    }

    func testInsertCredentialCreatesWebCompatiblePlaintextItem() throws {
        let payload = try VaultPlaintextPayload(jsonString: "[]")

        let updated = try payload.upsertingCredential(
            VaultCredentialDraft(
                id: "new-id",
                userId: "user-1",
                title: "GitHub",
                username: "octo",
                email: "octo@example.com",
                password: "secret",
                website: " https://github.com ",
                notes: ""
            ),
            now: Date(timeIntervalSince1970: 1_767_225_600)
        )

        let item = try XCTUnwrap(decodedItems(updated).first)
        XCTAssertEqual(item["id"] as? String, "new-id")
        XCTAssertEqual(item["userId"] as? String, "user-1")
        XCTAssertEqual(item["title"] as? String, "GitHub")
        XCTAssertEqual(item["username"] as? String, "octo")
        XCTAssertEqual(item["email"] as? String, "octo@example.com")
        XCTAssertEqual(item["encryptedPassword"] as? String, "secret")
        XCTAssertEqual(item["website"] as? String, "https://github.com")
        XCTAssertEqual(item["itemType"] as? String, "credential")
        XCTAssertEqual(item["isFavorite"] as? Bool, false)
        XCTAssertEqual(item["isHidden"] as? Bool, false)
        XCTAssertTrue(item["totpSecret"] is NSNull)
        XCTAssertNil(item["version"])
    }

    func testDeleteCredentialRemovesOnlyMatchingItem() throws {
        let payload = try VaultPlaintextPayload(jsonString: """
        [
          {"id":"a","title":"A","encryptedPassword":"1"},
          {"id":"b","title":"B","encryptedPassword":"2"}
        ]
        """)

        let updated = try payload.deletingCredential(id: "a")
        let items = try decodedItems(updated)

        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?["id"] as? String, "b")
    }

    func testDataForWriteStillStripsVersionFields() throws {
        let payload = try VaultPlaintextPayload(jsonString: """
        [{"id":"a","title":"A","encryptedPassword":"1","version":7}]
        """)

        let data = try payload.dataForWrite()
        let item = try XCTUnwrap(decodedItems(try VaultPlaintextPayload(rawJSON: data)).first)

        XCTAssertNil(item["version"])
    }

    private func decodedItems(_ payload: VaultPlaintextPayload) throws -> [[String: Any]] {
        let json = try JSONSerialization.jsonObject(with: payload.rawJSON)
        return try XCTUnwrap(json as? [[String: Any]])
    }
}
