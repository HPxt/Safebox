import XCTest
@testable import SafeBoxCrypto

final class MasterPasswordPolicyTests: XCTestCase {
    func testRejectsScoreLowerThanSevenAndShowsGuidance() {
        let policy = MasterPasswordPolicy()
        let result = policy.evaluate(
            password: "minha frase longa muito boa",
            confirmation: "minha frase longa muito boa",
            score: 6
        )

        XCTAssertFalse(result.accepted)
        XCTAssertTrue(result.violations.contains(.scoreTooLow))
        XCTAssertEqual(result.guidanceText, policy.lowScoreGuidanceText)
    }

    func testAcceptsScoreSevenWithLengthTwelveOrMore() {
        let policy = MasterPasswordPolicy()
        let result = policy.evaluate(
            password: "senha-frase-12",
            confirmation: "senha-frase-12",
            score: 7
        )

        XCTAssertTrue(result.accepted)
        XCTAssertTrue(result.violations.isEmpty)
        XCTAssertTrue(result.recommendsStrongerPassword)
        XCTAssertEqual(result.score, 7)
    }

    func testRejectsShortPasswordEvenWithStrongScore() {
        let policy = MasterPasswordPolicy()
        let result = policy.evaluate(
            password: "A1!x",
            confirmation: "A1!x",
            score: 10
        )

        XCTAssertFalse(result.accepted)
        XCTAssertTrue(result.violations.contains(.lengthTooShort))
    }

    func testRequiresMatchingMasterPasswordConfirmation() {
        let policy = MasterPasswordPolicy()
        let result = policy.evaluate(password: "senha-frase-forte-2026!!!", confirmation: "outra-senha", score: 8)

        XCTAssertFalse(result.accepted)
        XCTAssertTrue(result.violations.contains(.confirmationMismatch))
    }

    func testDefaultScorerMatchesWebStyleBlockingAndScoring() {
        let policy = MasterPasswordPolicy()

        let common = policy.evaluate(password: "password", confirmation: "password")
        XCTAssertFalse(common.accepted)
        XCTAssertEqual(common.score, 0)
        XCTAssertTrue(common.violations.contains(.scoreTooLow))

        let strong = policy.evaluate(
            password: "Correct-Horse-Battery-Staple-2026!!!",
            confirmation: "Correct-Horse-Battery-Staple-2026!!!"
        )
        XCTAssertTrue(strong.accepted)
        XCTAssertGreaterThanOrEqual(strong.score, 8)
    }

    func testDefaultScorerRejectsDangerousPatternsWithoutInjectedScore() {
        let policy = MasterPasswordPolicy()

        for password in ["123456789012", "aaaaaaaaaaaa", "qwertyuiop"] {
            let result = policy.evaluate(password: password, confirmation: password)
            XCTAssertFalse(result.accepted, "Expected \(password) to be rejected")
            XCTAssertEqual(result.score, 0)
            XCTAssertTrue(result.violations.contains(.scoreTooLow))
        }
    }

    func testDefaultScorerAcceptsScoreSevenOrHigherWithoutUIProvidedScore() {
        let policy = MasterPasswordPolicy()
        let password = "correct horse battery staple 2026!"

        let result = policy.evaluate(password: password, confirmation: password)

        XCTAssertTrue(result.accepted)
        XCTAssertGreaterThanOrEqual(result.score, 7)
    }
}
