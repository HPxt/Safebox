---
name: swift-keychain-secure
description: >-
  Define como armazenar, recuperar e invalidar segredos no Keychain do iOS para
  o SafeBox (access tokens, refresh tokens e a chave AES-GCM transiente
  derivada da senha-mestra). Use sempre que Swift tocar em SecItemAdd,
  SecItemCopyMatching, LAContext, kSecAccessControl, biometryCurrentSet,
  ou qualquer fluxo de unlock/logout/recuperacao biometrica. Skill de alto
  risco: erro aqui = segredo no backup do iCloud, chave persistida entre
  logout/login, ou app que permite unlock apos troca de Face ID.
triggers:
  - "**/Keychain*.swift"
  - "**/KeychainService*.swift"
  - "**/SecureStorage*.swift"
  - "**/BiometricGate*.swift"
  - "**/SessionManager*.swift"
  - ".cursor/skills/swift-keychain-secure/**"
---

# swift-keychain-secure

## Por que essa skill existe

O SafeBox armazena no Keychain do iOS:

1. **access_token** do Supabase (JWT, curta duracao, ~1h)
2. **refresh_token** do Supabase (longa duracao, ~dias)
3. **Chave AES-GCM transiente** derivada da senha-mestra (opcional -- so quando usuario opta por Face ID para desbloquear sem redigitar senha)

Errar qualquer um desses itens resulta em:

- chave caindo em backup de iCloud/iTunes (vazamento)
- segredo sobrevivendo a uninstall/reinstall (policy violation)
- app permite unlock apos troca de Face ID (comprometimento grave)
- app nao consegue renovar sessao e usuario ve logout aleatorio
- erro `errSecItemNotFound` mascarando estado de dispositivo invalidado

A Apple tambem cruza isso com o App Review: uso incorreto de `kSecAccessControl`/`LAContext` e fonte recorrente de rejeicao 2.5.1 e 5.1.2.

## Matriz de acessibilidade (obrigatorio consultar antes de gravar)

| Item                        | Accessibility                                         | Access Control            | biometryCurrentSet | iCloud Sync (`kSecAttrSynchronizable`) | ThisDeviceOnly |
|-----------------------------|-------------------------------------------------------|---------------------------|--------------------|----------------------------------------|----------------|
| access_token (Supabase JWT) | `WhenUnlockedThisDeviceOnly`                          | -                         | -                  | `false`                                | sim            |
| refresh_token (Supabase)    | `AfterFirstUnlockThisDeviceOnly`                      | -                         | -                  | `false`                                | sim            |
| AES key derivada (Face ID)  | `WhenPasscodeSetThisDeviceOnly`                       | `biometryCurrentSet`      | SIM (obrigatorio)  | `false`                                | sim            |
| Nonce/session salt auxiliar | `WhenUnlockedThisDeviceOnly`                          | -                         | -                  | `false`                                | sim            |
| User email (autofill hint)  | `AfterFirstUnlock`                                    | -                         | -                  | `false`                                | sim (`ThisDeviceOnly` agregado manualmente) |
| App Group shared key (ext.) | `AfterFirstUnlockThisDeviceOnly`                      | -                         | -                  | `false`                                | sim            |

### Regras de ouro

1. **Sempre** usar sufixo `ThisDeviceOnly`. Nunca sincronizar nada via iCloud Keychain.
2. **AES key** que libera o vault: ALWAYS com `biometryCurrentSet`. Nao usar `biometryAny`, nao usar `userPresence`, nao usar `devicePasscode`.
3. Chave AES so deve ser gravada se o usuario optou explicitamente por "Desbloqueio rapido com Face ID". Por default, senha-mestra e redigitada a cada sessao.
4. **access_token**: aceitar estar bloqueado com device locked (`WhenUnlocked`) -- nunca precisa ser lido em background.
5. **refresh_token**: deve ser legivel apos primeiro unlock do device (`AfterFirstUnlock`) porque a tarefa de refresh pode rodar em background.
6. Chaves de AutoFill extension devem ser isoladas no App Group (ver `swift-autofill-extension`) e usar `AfterFirstUnlockThisDeviceOnly` para funcionar no keyboard extension.

## Contrato Swift obrigatorio

### Salvar segredo basico

```swift
struct KeychainError: Error { let status: OSStatus }

enum KeychainItem {
    static let service = "app.safebox.ios"
}

func saveSecret(
    account: String,
    data: Data,
    accessibility: CFString
) throws {
    // Apaga qualquer item anterior para evitar duplicata silenciosa
    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: KeychainItem.service,
        kSecAttrAccount as String: account,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: KeychainItem.service,
        kSecAttrAccount as String: account,
        kSecValueData as String: data,
        kSecAttrAccessible as String: accessibility,
        kSecAttrSynchronizable as String: false,
    ]
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    guard status == errSecSuccess else { throw KeychainError(status: status) }
}
```

### Salvar chave AES-GCM protegida por biometria (critico)

```swift
func saveBiometryProtectedKey(rawKey: Data, account: String) throws {
    var error: Unmanaged<CFError>?
    // biometryCurrentSet: ao trocar Face ID/Touch ID enrollment, a ACL e invalidada.
    // Juntar com devicePasscode NAO: isso permitiria fallback por passcode, que deixa o
    // usuario abrir o vault sem biometria (indesejado no SafeBox).
    guard let acl = SecAccessControlCreateWithFlags(
        kCFAllocatorDefault,
        kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        .biometryCurrentSet,
        &error
    ) else {
        throw (error!.takeRetainedValue() as Error)
    }

    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: KeychainItem.service,
        kSecAttrAccount as String: account,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: KeychainItem.service,
        kSecAttrAccount as String: account,
        kSecValueData as String: rawKey,
        kSecAttrAccessControl as String: acl,
        kSecAttrSynchronizable as String: false,
    ]
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    guard status == errSecSuccess else { throw KeychainError(status: status) }
}
```

### Ler chave biometrica com prompt Face ID

```swift
func readBiometryProtectedKey(account: String, reason: String) throws -> Data {
    var result: AnyObject?
    let context = LAContext()
    context.localizedReason = reason
    context.interactionNotAllowed = false
    // IMPORTANTE: nao reutilizar LAContext entre sessoes. context fresco a cada read.

    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: KeychainItem.service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
        kSecUseAuthenticationContext as String: context,
    ]

    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else {
        throw KeychainError(status: status)
    }
    return data
}
```

### Remover todos os itens (logout/account deletion)

```swift
func wipeAllKeychainItems() {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: KeychainItem.service,
    ]
    SecItemDelete(query as CFDictionary)
}
```

**Obrigatorio** chamar em:
- logout manual do usuario
- account deletion (ver `apple-compliance-ios` checklist de delecao)
- detecao de rotacao de senha-mestra no servidor (key_hash mudou)

## Tratamento de erros que todo caller deve conhecer

| OSStatus                         | Quando acontece                                                                    | Acao esperada                                                                                   |
|----------------------------------|------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| `errSecItemNotFound` (-25300)    | Item nao existe ou foi invalidado por biometryCurrentSet (enrollment mudou)        | Tratar como "biometria invalidada" ou "logout previo". Limpar estado local, forcar re-login.     |
| `errSecInteractionNotAllowed` (-25308) | Tentativa de ler item `WhenUnlocked` com device trancado                     | Abortar operacao, aguardar unlock, ou usar item com accessibility `AfterFirstUnlock`.           |
| `errSecAuthFailed` (-25293)      | Usuario falhou Face ID / cancelou prompt                                           | Mensagem amigavel; apos 3 tentativas consecutivas, forcar re-login com senha-mestra.             |
| `errSecUserCanceled` (-128)      | Usuario cancelou prompt biometrico                                                 | Voltar ao tela de unlock sem apagar item (nao e falha permanente).                              |
| `errSecNotAvailable` (-25291)    | Keychain nao disponivel (ambiente esquisito, simulador)                            | Log de diagnostico; desabilitar feature Face ID temporariamente.                                 |
| `errSecDuplicateItem` (-25299)   | Esqueceu de fazer SecItemDelete antes do SecItemAdd                                | Bug do caller; corrigir codigo (ver padrao delete-then-add acima).                              |
| `-25293` com `LAError.biometryNotEnrolled` | Usuario removeu Face ID do dispositivo                                   | Mesma acao de `biometryCurrentSet` invalidation: limpar chave protegida, forcar senha-mestra.   |

### Fluxo de recuperacao apos invalidacao

```swift
func recoverFromInvalidBiometry() async {
    // 1. Apagar chave biometrica protegida (se ainda existir)
    try? deleteItem(account: "vault_aes_key_biometric")
    // 2. Manter refresh_token se valido (permite re-login sem re-autenticar o Supabase)
    // 3. Apagar access_token (provavelmente expirado de qualquer jeito)
    try? deleteItem(account: "supabase_access_token")
    // 4. Exibir UI: "Face ID foi alterado neste dispositivo. Digite sua senha-mestra para continuar."
    await appState.transitionTo(.masterPasswordUnlockRequired)
}
```

## Don'ts

- NAO armazenar senha-mestra no Keychain. Nunca. Nem temporariamente.
- NAO salvar a chave AES sem `biometryCurrentSet`. Isso permitiria que um novo Face ID (de outra pessoa) abrisse o vault.
- NAO usar `kSecAttrAccessibleAlways` ou variantes sem `ThisDeviceOnly`. Proibido.
- NAO reusar o mesmo `LAContext` entre autenticacoes. Contexto fresco a cada Face ID.
- NAO esquecer `SecItemDelete` antes de `SecItemAdd`: Keychain aceita duplicatas com account iguais em alguns casos e depois `SecItemCopyMatching` retorna arbitrariamente uma delas.
- NAO silenciar `errSecItemNotFound` como "tudo bem": e sinal de invalidacao biometrica ou item nunca criado. Diferenciar os casos.
- NAO colocar tokens Supabase em `UserDefaults`, `@AppStorage` ou arquivos. Apenas Keychain.
- NAO sincronizar com iCloud (`kSecAttrSynchronizable = true`). Proibido para todo item sensivel do SafeBox.
- NAO gravar a chave AES em App Group compartilhado a menos que o AutoFill extension REALMENTE precise dela (ele precisa, mas com accessibility de extensao). Ver skill `swift-autofill-extension`.

## Checklist de revisao para qualquer PR que toca no Keychain

- [ ] Todo item tem `ThisDeviceOnly`
- [ ] Todo item tem `kSecAttrSynchronizable = false`
- [ ] Chave AES-GCM usa `biometryCurrentSet` (nao `biometryAny`, nao inclui `.or` com `devicePasscode`)
- [ ] `SecAccessControlCreateWithFlags` tem tratamento de erro (nao forcar unwrap silencioso)
- [ ] Antes de `SecItemAdd`, ha um `SecItemDelete` correspondente
- [ ] Logout/account deletion chama funcao de wipe que apaga TODOS os items de `service: "app.safebox.ios"`
- [ ] Tratamento explicito para `errSecItemNotFound`, `errSecInteractionNotAllowed`, `errSecAuthFailed`, `errSecUserCanceled`
- [ ] Nenhum dado sensivel vai para `UserDefaults` ou arquivos nao-`NSFileProtectionComplete`
- [ ] Se o item e acessivel pela extensao AutoFill, a accessibility e compativel com acesso em background (`AfterFirstUnlockThisDeviceOnly`)
- [ ] Logging nunca imprime `OSStatus` com valor do item nem o proprio `Data`

## Referencias cruzadas

- `swift-autofill-extension` -- compartilhamento via App Group
- `apple-compliance-ios` -- checklist geral de seguranca e privacidade
- `swift-crypto-parity` -- origem dos 32 bytes da chave AES que entra aqui
