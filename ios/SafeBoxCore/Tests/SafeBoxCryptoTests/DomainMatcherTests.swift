import XCTest
@testable import SafeBoxCrypto

final class DomainMatcherTests: XCTestCase {
    private let matcher = DomainMatcher()

    func testExactDomainMatches() {
        XCTAssertTrue(matcher.matches(credentialWebsite: "example.com", requestedHostOrURL: "example.com"))
    }

    func testURLMatchesRawHost() {
        XCTAssertTrue(matcher.matches(credentialWebsite: "https://example.com/login", requestedHostOrURL: "example.com"))
    }

    func testWwwMatchesBaseDomain() {
        XCTAssertTrue(matcher.matches(credentialWebsite: "www.example.com", requestedHostOrURL: "example.com"))
    }

    func testSubdomainMatchesBaseDomain() {
        XCTAssertTrue(matcher.matches(credentialWebsite: "login.example.com", requestedHostOrURL: "example.com"))
        XCTAssertTrue(matcher.matches(credentialWebsite: "example.com", requestedHostOrURL: "m.example.com"))
    }

    func testFalsePositivesAreRejected() {
        XCTAssertFalse(matcher.matches(credentialWebsite: "example.com", requestedHostOrURL: "badexample.com"))
        XCTAssertFalse(matcher.matches(credentialWebsite: "example.com", requestedHostOrURL: "example.com.evil.com"))
    }

    func testNilOrEmptyInputReturnsFalse() {
        XCTAssertFalse(matcher.matches(credentialWebsite: nil, requestedHostOrURL: "example.com"))
        XCTAssertFalse(matcher.matches(credentialWebsite: "", requestedHostOrURL: "example.com"))
        XCTAssertFalse(matcher.matches(credentialWebsite: "example.com", requestedHostOrURL: ""))
    }

    func testInvalidURLReturnsFalse() {
        XCTAssertFalse(matcher.matches(credentialWebsite: "http://", requestedHostOrURL: "example.com"))
    }

    func testPortPathQueryAreIgnored() {
        XCTAssertTrue(matcher.matches(
            credentialWebsite: "https://example.com:8443/path?a=1#fragment",
            requestedHostOrURL: "example.com"
        ))
    }

    func testIpMatchesOnlyExactValue() {
        XCTAssertTrue(matcher.matches(credentialWebsite: "192.168.0.10", requestedHostOrURL: "192.168.0.10"))
        XCTAssertFalse(matcher.matches(credentialWebsite: "192.168.0.10", requestedHostOrURL: "192.168.0.11"))
    }
}
