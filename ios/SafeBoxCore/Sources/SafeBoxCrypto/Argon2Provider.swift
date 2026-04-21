import CArgon2
import Foundation

public protocol Argon2Providing: Sendable {
    func deriveKey(
        password: Data,
        salt: Data,
        params: KDFParams
    ) throws -> Data
}

public struct LibArgon2Provider: Argon2Providing {
    public init() {}

    public func deriveKey(password: Data, salt: Data, params: KDFParams) throws -> Data {
        guard params.iterations > 0,
              params.memorySize > 0,
              params.parallelism > 0,
              params.hashLength > 0 else {
            throw VaultCryptoError.argon2Failure("Argon2 params must be positive")
        }
        guard params.iterations <= Int(UInt32.max),
              params.memorySize <= Int(UInt32.max),
              params.parallelism <= Int(UInt32.max) else {
            throw VaultCryptoError.argon2Failure("Argon2 params exceed uint32 limits")
        }

        let outputLength = params.hashLength
        var output = Data(count: outputLength)
        let result: Int32 = output.withUnsafeMutableBytes { outputBuffer in
            password.withUnsafeBytes { passwordBuffer in
                salt.withUnsafeBytes { saltBuffer in
                    argon2id_hash_raw(
                        UInt32(params.iterations),
                        UInt32(params.memorySize),
                        UInt32(params.parallelism),
                        passwordBuffer.baseAddress,
                        password.count,
                        saltBuffer.baseAddress,
                        salt.count,
                        outputBuffer.baseAddress,
                        outputLength
                    )
                }
            }
        }

        guard result == ARGON2_OK.rawValue else {
            let message = argon2_error_message(result).map(String.init(cString:)) ?? "Unknown Argon2 error"
            throw VaultCryptoError.argon2Failure(message)
        }

        return output
    }
}
