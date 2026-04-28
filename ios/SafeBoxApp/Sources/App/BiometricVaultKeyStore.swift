import Foundation
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif
#if canImport(Security)
import Security
#endif

enum BiometricVaultKeyStoreError: Error, Equatable {
    case unavailable
    case authenticationFailed
    case biometryInvalidated
    case keychainFailure(Int32)
}

protocol BiometricVaultKeyStoring: Sendable {
    func canAttemptBiometricUnlock() -> Bool
    func hasStoredVaultKey() -> Bool
    func saveVaultKey(_ key: Data) throws
    func loadVaultKey(localizedReason: String) async throws -> Data
    func deleteVaultKey() throws
}

struct KeychainBiometricVaultKeyStore: BiometricVaultKeyStoring {
    private let service = "app.safebox.ios.vault-key"
    private let account = "current-vault-key"

    func canAttemptBiometricUnlock() -> Bool {
        #if canImport(LocalAuthentication)
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        #else
        return false
        #endif
    }

    func hasStoredVaultKey() -> Bool {
        #if canImport(Security)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess
        #else
        return false
        #endif
    }

    func saveVaultKey(_ key: Data) throws {
        #if canImport(Security)
        try deleteVaultKey()

        var accessError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            &accessError
        ) else {
            throw BiometricVaultKeyStoreError.unavailable
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessControl as String: access,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
            kSecValueData as String: key,
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw BiometricVaultKeyStoreError.keychainFailure(status)
        }
        #else
        _ = key
        throw BiometricVaultKeyStoreError.unavailable
        #endif
    }

    func loadVaultKey(localizedReason: String) async throws -> Data {
        #if canImport(Security) && canImport(LocalAuthentication)
        let context = LAContext()
        do {
            try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: localizedReason
            )
        } catch {
            throw BiometricVaultKeyStoreError.authenticationFailed
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: kCFBooleanTrue as Any,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        switch status {
        case errSecSuccess:
            guard let data = item as? Data else {
                throw BiometricVaultKeyStoreError.keychainFailure(status)
            }
            return data
        case errSecItemNotFound:
            throw BiometricVaultKeyStoreError.biometryInvalidated
        case errSecAuthFailed, errSecUserCanceled:
            throw BiometricVaultKeyStoreError.authenticationFailed
        default:
            throw BiometricVaultKeyStoreError.keychainFailure(status)
        }
        #else
        _ = localizedReason
        throw BiometricVaultKeyStoreError.unavailable
        #endif
    }

    func deleteVaultKey() throws {
        #if canImport(Security)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw BiometricVaultKeyStoreError.keychainFailure(status)
        }
        #endif
    }
}
