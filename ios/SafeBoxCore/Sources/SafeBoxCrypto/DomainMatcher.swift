import Foundation

public struct DomainMatcher: Sendable {
    public init() {}

    public func matches(credentialWebsite: String?, requestedHostOrURL: String) -> Bool {
        guard let credentialWebsite,
              let credentialHost = normalizeToHost(credentialWebsite),
              let requestedHost = normalizeToHost(requestedHostOrURL) else {
            return false
        }

        // v1 intentionally avoids full PSL logic; we use exact/subdomain match only.
        if isIPAddress(credentialHost) || isIPAddress(requestedHost) {
            return credentialHost == requestedHost
        }

        if credentialHost == requestedHost {
            return true
        }

        // Password managers commonly match within the same registered-domain family.
        // v1 avoids PSL parsing, so keep this conservative: only dot-boundary subdomains.
        return requestedHost.hasSuffix(".\(credentialHost)") ||
            credentialHost.hasSuffix(".\(requestedHost)")
    }

    private func normalizeToHost(_ input: String) -> String? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return nil
        }

        let candidate: String
        if trimmed.contains("://") {
            candidate = trimmed
        } else {
            candidate = "https://\(trimmed)"
        }

        guard let components = URLComponents(string: candidate),
              let hostRaw = components.host else {
            return nil
        }

        var host = hostRaw.lowercased()
        if host.hasSuffix(".") {
            host.removeLast()
        }
        if host.hasPrefix("www.") {
            host.removeFirst(4)
        }

        guard !host.isEmpty else {
            return nil
        }
        return host
    }

    private func isIPAddress(_ host: String) -> Bool {
        let ipv4Pattern = #"^(\d{1,3}\.){3}\d{1,3}$"#
        let ipv6Pattern = #"^[0-9a-f:]+$"#
        if host.range(of: ipv4Pattern, options: .regularExpression) != nil {
            return true
        }
        return host.contains(":") && host.range(of: ipv6Pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
}
