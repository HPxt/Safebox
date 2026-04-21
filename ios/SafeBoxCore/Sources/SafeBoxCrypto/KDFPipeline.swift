import Crypto
import Foundation

public struct KDFPipeline: Sendable {
    private let argon2Provider: Argon2Providing
    private static let pbkdf2Iterations = 100_000
    private static let pbkdf2OutputLength = 32
    private static let pbkdf2SaltPrefixLength = 16

    public init(argon2Provider: Argon2Providing) {
        self.argon2Provider = argon2Provider
    }

    public func deriveVaultKey(password: String, saltBase64: String, params: KDFParams) throws -> Data {
        guard params.algorithm.lowercased() == "argon2id" else {
            throw VaultCryptoError.unsupportedKDFAlgorithm
        }

        guard let salt = Data(base64Encoded: saltBase64) else {
            throw VaultCryptoError.invalidBase64
        }
        guard salt.count >= Self.pbkdf2SaltPrefixLength else {
            throw VaultCryptoError.invalidSaltLength
        }

        let pbkdf2Salt = salt.prefix(Self.pbkdf2SaltPrefixLength)
        let pbkdf2 = pbkdf2SHA256(
            password: Data(password.utf8),
            salt: Data(pbkdf2Salt),
            iterations: Self.pbkdf2Iterations,
            keyLength: Self.pbkdf2OutputLength
        )
        let combinedPassword = Data((pbkdf2.base64EncodedString() + password).utf8)
        let argon2Key = try argon2Provider.deriveKey(password: combinedPassword, salt: salt, params: params)

        guard argon2Key.count == params.hashLength else {
            throw VaultCryptoError.argon2Failure("Unexpected Argon2 output length")
        }

        return argon2Key
    }

    public func keyHashBase64(rawKey: Data) -> String {
        Data(SHA256.hash(data: rawKey)).base64EncodedString()
    }

    private func pbkdf2SHA256(password: Data, salt: Data, iterations: Int, keyLength: Int) -> Data {
        precondition(iterations > 0, "PBKDF2 iterations must be positive")
        let hLen = 32
        let blocks = Int(ceil(Double(keyLength) / Double(hLen)))
        var output = Data(capacity: blocks * hLen)

        for blockIndex in 1...blocks {
            var saltWithBlock = Data(salt)
            saltWithBlock.append(contentsOf: [
                UInt8((blockIndex >> 24) & 0xff),
                UInt8((blockIndex >> 16) & 0xff),
                UInt8((blockIndex >> 8) & 0xff),
                UInt8(blockIndex & 0xff),
            ])

            let key = SymmetricKey(data: password)
            var u = Data(HMAC<SHA256>.authenticationCode(for: saltWithBlock, using: key))
            var t = u

            if iterations > 1 {
                for _ in 2...iterations {
                    u = Data(HMAC<SHA256>.authenticationCode(for: u, using: key))
                    for i in t.indices {
                        t[i] ^= u[i]
                    }
                }
            }

            output.append(t)
        }

        return output.prefix(keyLength)
    }
}
