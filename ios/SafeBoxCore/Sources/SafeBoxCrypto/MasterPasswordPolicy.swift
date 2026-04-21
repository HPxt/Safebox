import Foundation

public enum MasterPasswordPolicyViolation: String, Sendable, Equatable {
    case scoreTooLow
    case lengthTooShort
    case confirmationMismatch
}

public struct MasterPasswordPolicyEvaluation: Sendable, Equatable {
    public let accepted: Bool
    public let recommendsStrongerPassword: Bool
    public let violations: [MasterPasswordPolicyViolation]
    public let guidanceText: String?
    public let score: Int

    public init(
        accepted: Bool,
        recommendsStrongerPassword: Bool,
        violations: [MasterPasswordPolicyViolation],
        guidanceText: String?,
        score: Int
    ) {
        self.accepted = accepted
        self.recommendsStrongerPassword = recommendsStrongerPassword
        self.violations = violations
        self.guidanceText = guidanceText
        self.score = score
    }
}

public protocol MasterPasswordScoringProviding: Sendable {
    func score(password: String) -> Int
}

public struct WebCompatibleMasterPasswordScorer: MasterPasswordScoringProviding {
    private let blockedPasswords: Set<String> = [
        "123456", "123456789", "qwerty", "password", "abc123", "111111", "123123",
        "1234567890", "1234567", "password123", "12345678", "12345", "1234", "123",
        "admin", "letmein", "welcome", "monkey", "dragon", "master", "hello",
        "freedom", "whatever", "qazwsx", "trustno1", "adobe123", "azerty", "photoshop",
        "senha", "senha123", "123senha", "mudar123", "brasil", "admin123",
        "102030", "010203", "123321", "654321", "987654321",
        "qwertyuiop", "asdfghjkl", "zxcvbnm", "1qaz2wsx", "1q2w3e4r", "1q2w3e",
        "2024", "2023", "2022", "2021", "2020", "1990", "1991", "1992",
        "1993", "1994", "1995", "1996", "1997", "1998", "1999",
    ]

    public init() {}

    public func score(password: String) -> Int {
        if blockedPasswords.contains(password.lowercased()) {
            return 0
        }
        if isDangerousPattern(password) || password.count < 12 {
            return 0
        }

        var score = 0
        if password.count >= 20 {
            score += 4
        } else if password.count >= 16 {
            score += 3
        } else if password.count >= 14 {
            score += 2
        } else if password.count >= 12 {
            score += 1
        }

        if password.range(of: "[a-z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "[A-Z]", options: .regularExpression) != nil { score += 1 }
        if password.range(of: "\\d", options: .regularExpression) != nil { score += 1 }

        let specialCount = password.filter { !$0.isLetter && !$0.isNumber }.count
        if specialCount >= 3 {
            score += 2
        } else if specialCount >= 2 {
            score += 1
        }

        let uniqueCount = Set(password).count
        let varietyRatio = Double(uniqueCount) / Double(password.count)
        if varietyRatio >= 0.8 {
            score += 2
        } else if varietyRatio >= 0.6 {
            score += 1
        }

        let hasLower = password.range(of: "[a-z]", options: .regularExpression) != nil
        let hasUpper = password.range(of: "[A-Z]", options: .regularExpression) != nil
        let hasNumber = password.range(of: "\\d", options: .regularExpression) != nil
        let hasSpecial = specialCount > 0
        if [hasLower, hasUpper, hasNumber, hasSpecial].filter({ $0 }).count == 4 {
            score += 1
        }

        return min(10, max(0, score))
    }

    private func isDangerousPattern(_ password: String) -> Bool {
        let patterns = [
            "^\\d+$",
            "^[a-z]+$",
            "^[A-Z]+$",
            "^(.)\\1{4,}$",
            "^(012|123|234|345|456|567|678|789|890)+",
            "^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+",
            "^(qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)+",
            "(\\w)\\1{2,}",
            "^.{1,7}$",
        ]
        return patterns.contains { pattern in
            password.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
        }
    }
}

public struct MasterPasswordPolicy: Sendable {
    public let minimumScore = 7
    public let recommendedScore = 8
    public let minimumLength = 12
    public let lowScoreGuidanceText = "Use uma frase longa e unica, facil de lembrar e dificil de adivinhar."
    private let scorer: MasterPasswordScoringProviding

    public init(scorer: MasterPasswordScoringProviding = WebCompatibleMasterPasswordScorer()) {
        self.scorer = scorer
    }

    public func evaluate(password: String, confirmation: String) -> MasterPasswordPolicyEvaluation {
        evaluate(password: password, confirmation: confirmation, score: scorer.score(password: password))
    }

    public func evaluate(password: String, confirmation: String, score: Int) -> MasterPasswordPolicyEvaluation {
        var violations: [MasterPasswordPolicyViolation] = []

        if password.count < minimumLength {
            violations.append(.lengthTooShort)
        }
        if score < minimumScore {
            violations.append(.scoreTooLow)
        }
        if password != confirmation {
            violations.append(.confirmationMismatch)
        }

        return MasterPasswordPolicyEvaluation(
            accepted: violations.isEmpty,
            recommendsStrongerPassword: score >= minimumScore && score < recommendedScore,
            violations: violations,
            guidanceText: score < minimumScore ? lowScoreGuidanceText : nil,
            score: score
        )
    }

    public func validateOrThrow(password: String, confirmation: String, score: Int? = nil) throws {
        let resolvedScore = score ?? scorer.score(password: password)
        let result = evaluate(password: password, confirmation: confirmation, score: resolvedScore)
        if let firstViolation = result.violations.first {
            throw VaultCryptoError.masterPasswordPolicyFailure(firstViolation)
        }
    }
}
