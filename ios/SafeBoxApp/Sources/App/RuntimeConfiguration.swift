import Foundation

struct RuntimeConfiguration {
    let supabaseURL: URL
    let publicKey: String
    let backendURL: URL

    init(values: [String: Any]) throws {
        guard values["SafeBoxEnvironment"] as? String == "staging" else {
            throw ConfigurationError.invalidEnvironment
        }
        func endpoint(_ key: String) throws -> URL {
            guard let raw = values[key] as? String,
                  let url = URL(string: raw), url.scheme == "https",
                  let host = url.host, !host.isEmpty,
                  url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
                  url.port == nil || url.port == 443,
                  !raw.contains("$("), !host.hasSuffix(".invalid"),
                  host != "localhost", !host.contains(":"),
                  host.range(of: #"^[0-9.]+$"#, options: .regularExpression) == nil else {
                throw ConfigurationError.invalidEndpoint
            }
            return url
        }
        let authURL = try endpoint("SafeBoxSupabaseURL")
        // This project was supplied earlier without staging confirmation.
        guard authURL.host != "mbpttcfsqauatmxbhniy.supabase.co",
              authURL.host?.hasSuffix(".supabase.co") == true,
              authURL.path.isEmpty || authURL.path == "/" else {
            throw ConfigurationError.invalidEnvironment
        }
        guard let key = values["SafeBoxPublishableKey"] as? String,
              key.hasPrefix("sb_publishable_"), key.count > 25,
              !key.contains("EXAMPLE"), !key.contains("$(") else {
            throw ConfigurationError.invalidPublicKey
        }
        supabaseURL = authURL
        publicKey = key
        backendURL = try endpoint("SafeBoxBackendURL")
        #if SAFEBOX_PERSONAL_STAGING
        guard supabaseURL.absoluteString == "https://xxynxmktvonnldokhyem.supabase.co",
              backendURL.absoluteString == "https://safebox-backend-staging.vercel.app",
              publicKey == "sb_publishable_4_j0-3MA5vPNhLbAIsuwzw_UA1SjRg3" else {
            throw ConfigurationError.invalidEnvironment
        }
        #endif
    }

    enum ConfigurationError: Error { case invalidEnvironment, invalidEndpoint, invalidPublicKey }
}
