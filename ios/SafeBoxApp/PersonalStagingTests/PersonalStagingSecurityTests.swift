import XCTest
@testable import SafeBoxPersonalStaging

final class PersonalStagingSecurityTests: XCTestCase {
    private var values: [String: Any] { [
        "SafeBoxEnvironment": "staging",
        "SafeBoxSupabaseURL": "https://xxynxmktvonnldokhyem.supabase.co",
        "SafeBoxPublishableKey": "sb_publishable_4_j0-3MA5vPNhLbAIsuwzw_UA1SjRg3",
        "SafeBoxBackendURL": "https://safebox-backend-staging.vercel.app",
    ] }

    func testDedicatedStagingIsAccepted() throws {
        _ = try RuntimeConfiguration(values: values)
        XCTAssertEqual(Bundle.main.infoDictionary?["SafeBoxPersonalStaging"] as? Bool, true)
    }

    func testOtherBackendsAreRejected() {
        for url in ["https://safebox-teal.vercel.app", "https://other.example.com", "http://safebox-backend-staging.vercel.app"] {
            var configuration = values
            configuration["SafeBoxBackendURL"] = url
            XCTAssertThrowsError(try RuntimeConfiguration(values: configuration))
        }
    }

    func testOtherAuthProjectsAndKeysAreRejected() {
        var configuration = values
        configuration["SafeBoxSupabaseURL"] = "https://other.supabase.co"
        XCTAssertThrowsError(try RuntimeConfiguration(values: configuration))
        configuration = values
        configuration["SafeBoxPublishableKey"] = "sb_publishable_synthetic_other_project_key"
        XCTAssertThrowsError(try RuntimeConfiguration(values: configuration))
    }

    func testEphemeralTransportAndMissingSessionStillFailClosed() async {
        XCTAssertNil(SafeBoxHTTP.session.configuration.httpCookieStorage)
        XCTAssertNil(SafeBoxHTTP.session.configuration.urlCache)
        let store = SafeBoxSessionStore(supabaseURL: URL(string: values["SafeBoxSupabaseURL"] as! String)!,
                                        anonKey: values["SafeBoxPublishableKey"] as! String)
        do { _ = try await store.validToken(); XCTFail("Missing token accepted") }
        catch { XCTAssertTrue(error as? SafeBoxAppError == .authSessionExpired) }
    }
}
