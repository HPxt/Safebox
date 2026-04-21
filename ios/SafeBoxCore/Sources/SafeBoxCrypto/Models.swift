import Foundation

public struct KDFParams: Codable, Sendable, Equatable {
    public let algorithm: String
    public let level: String
    public let memorySize: Int
    public let iterations: Int
    public let parallelism: Int
    public let hashLength: Int

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
    case invalidCiphertext
    case invalidEnvelopeVersion
    case unsupportedKDFAlgorithm
    case argon2Failure(String)
}
