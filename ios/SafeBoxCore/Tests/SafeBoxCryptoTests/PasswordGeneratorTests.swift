import XCTest
@testable import SafeBoxCrypto

final class PasswordGeneratorTests: XCTestCase {
    func testGeneratesWithEachSelectedClass() throws {
        let generator = PasswordGenerator(randomSource: DeterministicRandomSource())
        let options = PasswordGeneratorOptions(
            length: 20,
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: true,
            avoidAmbiguous: false,
            requireEachSelectedType: true
        )

        let value = try generator.generate(options: options)

        XCTAssertEqual(value.count, 20)
        XCTAssertTrue(value.range(of: "[A-Z]", options: .regularExpression) != nil)
        XCTAssertTrue(value.range(of: "[a-z]", options: .regularExpression) != nil)
        XCTAssertTrue(value.range(of: "[0-9]", options: .regularExpression) != nil)
        XCTAssertTrue(value.range(of: "[!@#$%^&*()\\-_=+\\[\\]{};:,.<>/?~]", options: .regularExpression) != nil)
    }

    func testAvoidAmbiguousRemovesCommonConfusingChars() throws {
        let generator = PasswordGenerator(randomSource: DeterministicRandomSource())
        let options = PasswordGeneratorOptions(
            length: 64,
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: false,
            avoidAmbiguous: true,
            requireEachSelectedType: false
        )

        let value = try generator.generate(options: options)
        for char in ["0", "O", "1", "I", "l"] {
            XCTAssertFalse(value.contains(char))
        }
    }

    func testRejectionSamplingHandlesOutOfRangeRandomValues() throws {
        let generator = PasswordGenerator(randomSource: DeterministicRandomSource(sequence: [UInt32.max, 0, 1, 2, 3, 4, 5, 6, 7, 8]))
        let options = PasswordGeneratorOptions(
            length: 8,
            includeUppercase: false,
            includeLowercase: true,
            includeNumbers: false,
            includeSymbols: false,
            avoidAmbiguous: false,
            requireEachSelectedType: false
        )

        let value = try generator.generate(options: options)
        XCTAssertEqual(value.count, 8)
        XCTAssertTrue(value.allSatisfy { $0 >= "a" && $0 <= "z" })
    }
}

private final class DeterministicRandomSource: RandomByteProviding, @unchecked Sendable {
    private let sequence: [UInt32]
    private var index: Int = 0

    init(sequence: [UInt32] = [1, 7, 42, 99, 256, 3, 15, 88, 123]) {
        self.sequence = sequence
    }

    func randomUInt32() throws -> UInt32 {
        let value = sequence[index % sequence.count]
        index += 1
        return value
    }
}
