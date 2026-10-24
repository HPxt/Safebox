import XCTest
@testable import SafeBoxApp

final class SessionSecurityTests: XCTestCase {
    private let endpoint = URL(string: "https://test.supabase.co")!

    private func fixture(expiresIn: Int = 3600, token: String = "access") -> Data {
        Data("""
        {"access_token":"\(token)","refresh_token":"refresh-\(token)","expires_in":\(expiresIn),"user":{"id":"user-a","user_metadata":{}}}
        """.utf8)
    }

    private func setupSession() -> (SafeBoxSessionStore, SupabasePasswordAuthProvider) {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubProtocol.self]
        let http = URLSession(configuration: config)
        let store = SafeBoxSessionStore(supabaseURL: endpoint, anonKey: "public-test", urlSession: http)
        return (store, SupabasePasswordAuthProvider(supabaseURL: endpoint, anonKey: "public-test", sessionStore: store, urlSession: http))
    }

    func testMissingSessionFailsClosed() async {
        let (store, _) = setupSession()
        do { _ = try await store.validToken(); XCTFail("Missing token accepted") }
        catch { XCTAssertEqual(error as? SafeBoxAppError, .authSessionExpired) }
    }

    func testValidSessionDoesNotRefresh() async throws {
        let data = fixture()
        StubProtocol.handler = { request in
            XCTAssertEqual(request.url?.query, "grant_type=password")
            return (200, data)
        }
        let (store, auth) = setupSession()
        try await auth.signIn(email: "test@example.invalid", password: "synthetic")
        let token = try await store.validToken()
        XCTAssertEqual(token, "access")
    }

    func testConcurrentRefreshExchangesRotatingTokenOnlyOnce() async throws {
        let initial = fixture(expiresIn: 0)
        let rotated = fixture(token: "rotated")
        let count = LockedCounter()
        StubProtocol.handler = { request in
            if request.url?.query == "grant_type=password" { return (200, initial) }
            XCTAssertEqual(request.url?.query, "grant_type=refresh_token")
            count.increment()
            return (200, rotated)
        }
        let (store, auth) = setupSession()
        try await auth.signIn(email: "test@example.invalid", password: "synthetic")
        try await withThrowingTaskGroup(of: String.self) { group in
            for _ in 0..<20 { group.addTask { try await store.validToken() } }
            for try await token in group { XCTAssertEqual(token, "rotated") }
        }
        XCTAssertEqual(count.value, 1)
    }

    func testLogoutClearsSessionEvenWhenRevocationFails() async throws {
        let initial = fixture()
        StubProtocol.handler = { request in
            if request.url?.path == "/auth/v1/logout" {
                XCTAssertEqual(request.url?.query, "scope=local")
                XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer access")
                return (503, Data())
            }
            return (200, initial)
        }
        let (store, auth) = setupSession()
        try await auth.signIn(email: "test@example.invalid", password: "synthetic")
        do { try await auth.signOut(); XCTFail("Revocation failure hidden") } catch {}
        XCTAssertThrowsError(try store.token())
        XCTAssertThrowsError(try store.userID())
    }

    func testRefreshResponseCannotResurrectClearedSession() async throws {
        let initial = fixture(expiresIn: 0)
        let rotated = fixture(token: "rotated")
        let (store, auth) = setupSession()
        StubProtocol.handler = { request in
            if request.url?.query == "grant_type=password" { return (200, initial) }
            store.clear()
            return (200, rotated)
        }
        try await auth.signIn(email: "test@example.invalid", password: "synthetic")
        do { _ = try await store.validToken(); XCTFail("Session resurrected after logout") }
        catch { XCTAssertEqual(error as? SafeBoxAppError, .authSessionExpired) }
        XCTAssertThrowsError(try store.userID())
    }

    func testTransportDoesNotPersistCookiesOrResponses() {
        let config = SafeBoxHTTP.session.configuration
        XCTAssertNil(config.httpCookieStorage)
        XCTAssertNil(config.urlCache)
        XCTAssertFalse(config.httpShouldSetCookies)
        XCTAssertLessThanOrEqual(config.timeoutIntervalForResource, 60)
    }

    func testExpiredTokenCannotBeUsedWithoutRefresh() async throws {
        let initial = fixture(expiresIn: 0)
        StubProtocol.handler = { request in
            request.url?.query == "grant_type=password" ? (200, initial) : (401, Data())
        }
        let (store, auth) = setupSession()
        try await auth.signIn(email: "test@example.invalid", password: "synthetic")
        XCTAssertThrowsError(try store.token())
        do { _ = try await store.validToken(); XCTFail("Rejected refresh accepted") } catch {}
    }
}

private final class LockedCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    func increment() { lock.lock(); count += 1; lock.unlock() }
    var value: Int { lock.lock(); defer { lock.unlock() }; return count }
}

private final class StubProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Int, Data))!
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let (status, body) = Self.handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
