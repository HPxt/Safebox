import Foundation
#if canImport(Security)
import Security
#endif

public struct PasswordGeneratorOptions: Sendable, Equatable {
    public let length: Int
    public let includeUppercase: Bool
    public let includeLowercase: Bool
    public let includeNumbers: Bool
    public let includeSymbols: Bool
    public let avoidAmbiguous: Bool
    public let requireEachSelectedType: Bool

    public init(
        length: Int,
        includeUppercase: Bool = true,
        includeLowercase: Bool = true,
        includeNumbers: Bool = true,
        includeSymbols: Bool = true,
        avoidAmbiguous: Bool = false,
        requireEachSelectedType: Bool = true
    ) {
        self.length = length
        self.includeUppercase = includeUppercase
        self.includeLowercase = includeLowercase
        self.includeNumbers = includeNumbers
        self.includeSymbols = includeSymbols
        self.avoidAmbiguous = avoidAmbiguous
        self.requireEachSelectedType = requireEachSelectedType
    }
}

public struct PasswordGenerator: Sendable {
    private let randomSource: RandomByteProviding

    public init(randomSource: RandomByteProviding = SystemRandomByteSource()) {
        self.randomSource = randomSource
    }

    public func generate(options: PasswordGeneratorOptions) throws -> String {
        guard (8...128).contains(options.length) else {
            throw VaultCryptoError.masterPasswordPolicyFailure(.lengthTooShort)
        }

        let charSets = buildCharacterSets(options: options)
        guard !charSets.isEmpty else {
            throw VaultCryptoError.kdfPolicyFailure(.kdfInvalidParams)
        }

        let allChars = Array(charSets.joined())
        var output: [Character] = []
        output.reserveCapacity(options.length)

        if options.requireEachSelectedType {
            for set in charSets {
                output.append(try randomCharacter(from: set))
            }
        }

        while output.count < options.length {
            output.append(try randomCharacter(from: allChars))
        }

        try fisherYatesShuffle(&output)
        return String(output)
    }

    private func buildCharacterSets(options: PasswordGeneratorOptions) -> [[Character]] {
        let uppercase = options.avoidAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        let lowercase = options.avoidAmbiguous ? "abcdefghijkmnopqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz"
        let numbers = options.avoidAmbiguous ? "23456789" : "0123456789"
        let symbols = "!@#$%^&*()-_=+[]{};:,.<>/?~"

        var sets: [[Character]] = []
        if options.includeUppercase { sets.append(Array(uppercase)) }
        if options.includeLowercase { sets.append(Array(lowercase)) }
        if options.includeNumbers { sets.append(Array(numbers)) }
        if options.includeSymbols { sets.append(Array(symbols)) }
        return sets
    }

    private func randomCharacter(from chars: [Character]) throws -> Character {
        guard !chars.isEmpty else {
            throw VaultCryptoError.kdfPolicyFailure(.kdfInvalidParams)
        }
        let idx = try randomIndex(upperBound: chars.count)
        return chars[idx]
    }

    private func randomIndex(upperBound: Int) throws -> Int {
        precondition(upperBound > 0, "upperBound must be positive")
        let range = UInt64(UInt32.max) + 1
        let bound = UInt64(upperBound)
        let limit = range - (range % bound)

        while true {
            let rnd = UInt64(try randomSource.randomUInt32())
            if rnd < limit {
                return Int(rnd % bound)
            }
        }
    }

    private func fisherYatesShuffle(_ chars: inout [Character]) throws {
        guard chars.count > 1 else { return }
        for i in stride(from: chars.count - 1, to: 0, by: -1) {
            let j = try randomIndex(upperBound: i + 1)
            if i != j {
                chars.swapAt(i, j)
            }
        }
    }
}

public protocol RandomByteProviding: Sendable {
    func randomUInt32() throws -> UInt32
}

public struct SystemRandomByteSource: RandomByteProviding {
    public init() {}

    public func randomUInt32() throws -> UInt32 {
        #if canImport(Security)
        var value: UInt32 = 0
        let status = SecRandomCopyBytes(kSecRandomDefault, MemoryLayout<UInt32>.size, &value)
        guard status == errSecSuccess else {
            throw VaultCryptoError.randomGenerationFailed
        }
        return value
        #else
        return UInt32.random(in: UInt32.min...UInt32.max)
        #endif
    }
}
