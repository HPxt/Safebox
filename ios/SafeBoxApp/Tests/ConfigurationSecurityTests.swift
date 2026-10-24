import XCTest
@testable import SafeBoxApp

final class ConfigurationSecurityTests: XCTestCase {
    private var valid: [String: Any] { [
        "SafeBoxEnvironment": "staging",
        "SafeBoxSupabaseURL": "https://test.supabase.co",
        "SafeBoxPublishableKey": "sb_publishable_synthetic_public_test_value",
        "SafeBoxBackendURL": "https://api.staging.example.com"
    ] }

    func testExplicitStagingConfigurationAccepted() throws { _ = try RuntimeConfiguration(values: valid) }
    func testMissingConfigurationRejected() { XCTAssertThrowsError(try RuntimeConfiguration(values: [:])) }
    func testUnsafeEndpointsRejected() {
        for endpoint in ["http://api.example.com", "https://user:pass@api.example.com", "https://api.example.com?secret=x", "https://api.example.com/#fragment", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://placeholder.invalid"] {
            var values = valid
            values["SafeBoxBackendURL"] = endpoint
            XCTAssertThrowsError(try RuntimeConfiguration(values: values), endpoint)
        }
    }
    func testPrivilegedAndLegacyKeysRejected() {
        for key in ["sb_secret_forbidden", "eyJhbGciOiJIUzI1NiJ9.legacy", "$(SAFEBOX_PUBLISHABLE_KEY)"] {
            var values = valid
            values["SafeBoxPublishableKey"] = key
            XCTAssertThrowsError(try RuntimeConfiguration(values: values))
        }
    }
    func testPreviouslySuppliedProjectRejectedForStaging() {
        var values = valid
        values["SafeBoxSupabaseURL"] = "https://mbpttcfsqauatmxbhniy.supabase.co"
        XCTAssertThrowsError(try RuntimeConfiguration(values: values))
    }
}
