import Foundation

public struct KDFParams: Codable, Sendable, Equatable {
    public let algorithm: String
    public let level: String
    public let memorySize: Int
    public let iterations: Int
    public let parallelism: Int
    public let hashLength: Int

    private enum CodingKeys: String, CodingKey {
        case algorithm, level, memorySize, iterations, parallelism, hashLength
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let algorithm = try container.decode(String.self, forKey: .algorithm)
        let memorySize = try container.decode(Int.self, forKey: .memorySize)
        let iterations = try container.decode(Int.self, forKey: .iterations)
        let parallelism = try container.decode(Int.self, forKey: .parallelism)
        let hashLength = try container.decode(Int.self, forKey: .hashLength)
        let level: String
        if container.contains(.level) {
            level = try container.decode(String.self, forKey: .level)
        } else if algorithm == "argon2id", memorySize == 65536, iterations == 3,
                  parallelism == 4, hashLength == 32 {
            // Legacy web profiles omit this label; preserve their exact KDF cost.
            level = "LOW"
        } else {
            throw DecodingError.dataCorruptedError(forKey: .level, in: container,
                debugDescription: "Unlabelled KDF parameters do not match the legacy web profile")
        }
        self.init(algorithm: algorithm, level: level, memorySize: memorySize,
                  iterations: iterations, parallelism: parallelism, hashLength: hashLength)
    }

    public init(
        algorithm: String,
        level: String,
        memorySize: Int,
        iterations: Int,
        parallelism: Int,
        hashLength: Int
    ) {
        self.algorithm = algorithm
        self.level = level
        self.memorySize = memorySize
        self.iterations = iterations
        self.parallelism = parallelism
        self.hashLength = hashLength
    }
}

public struct VaultSnapshotV2Envelope: Codable, Sendable, Equatable {
    public let version: String
    public let nonce: String
    public let encrypted: String

    public init(version: String = "vault-snapshot-v2", nonce: String, encrypted: String) {
        self.version = version
        self.nonce = nonce
        self.encrypted = encrypted
    }
}

public enum VaultCryptoError: Error, Equatable {
    case invalidBase64
    case invalidSaltLength
    case invalidNonceLength
    case invalidKeyLength
    case invalidCiphertext
    case invalidEnvelopeVersion
    case unsupportedKDFAlgorithm
    case argon2Failure(String)
    case kdfPolicyFailure(MobileKDFPolicyState)
    case masterPasswordPolicyFailure(MasterPasswordPolicyViolation)
    case invalidMasterPassword
    case keyRotationDetected
    case randomGenerationFailed
}
