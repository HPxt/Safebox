# Etapa 3 - iOS Project Design (anti-retrabalho Codex)

Status: Draft executavel  
Data: 2026-04-21  
Escopo: arquitetura de modulos, dependencias Swift e baseline de entitlements para v1

## 1) Objetivo da Etapa 3

Fechar todas as decisoes de projeto que costumam gerar correcao tardia:

- fronteiras de modulos (quem pode depender de quem)
- escolha de dependencias Swift com criterio objetivo
- entitlements/capabilities minimos para App + AutoFill Extension
- contratos de integracao com backend/supabase sem acoplamento indevido

Sem isso, a Etapa 4 (bootstrap Xcode + crypto) tende a quebrar em review por drift de arquitetura.

## 2) Escopo v1 da arquitetura

Dentro:

- Login (supabase session existente)
- Unlock por senha-mestra + biometria
- Vault read/write via backend `/api/vault` (com fallback supabase documentado)
- AutoFill extension com gate biometrico
- Account deletion in-app

Fora de escopo v1:

- signup in-app
- master password rotation in-app
- folder CRUD (somente leitura)
- certificate pinning
- iPad layouts dedicados

## 3) Arquitetura modular proposta

```
SafeBoxApp
  App/
    SafeBoxApp.swift
    AppCoordinator.swift
    AppStateStore.swift
  Core/
    Contracts/
      AuthSessionProviding.swift
      VaultRepository.swift
      KeyDerivationProviding.swift
      SecureStore.swift
      BiometricGate.swift
    Crypto/
      VaultCrypto.swift
      KDFModels.swift
      EnvelopeSerializer.swift
    Security/
      KeychainStore.swift
      SessionLockPolicy.swift
      ClipboardPolicy.swift
    Networking/
      BackendClient.swift
      BackendModels.swift
      SupabaseGateway.swift
    Persistence/
      EncryptedCacheStore.swift
      AppGroupStorage.swift
  Features/
    Auth/
      LoginView.swift
      UnlockView.swift
      AuthViewModel.swift
    Vault/
      VaultListView.swift
      VaultDetailView.swift
      VaultEditView.swift
      VaultViewModel.swift
    Settings/
      SettingsView.swift
      AccountDeletionView.swift
      SettingsViewModel.swift
  Shared/
    DomainMatching.swift
    CredentialIdentityDonation.swift

SafeBoxAutoFillExtension
  CredentialProviderViewController.swift
  AutoFillCoordinator.swift
  AutoFillCredentialProvider.swift
```

## 4) Regras de dependencia (bloqueio de acoplamento)

1. `Features/*` nao acessa `SupabaseGateway` direto; passa por `Core/Contracts`.
2. `AutoFillExtension` nao importa modulo de UI do app principal.
3. `Core/Crypto` nao conhece UIKit/SwiftUI.
4. `Networking` nao conhece Keychain diretamente; usa `SecureStore`.
5. `VaultViewModel` nao calcula hash/KDF; usa `KeyDerivationProviding`/`VaultRepository`.

## 5) Contratos minimos para iniciar Etapa 4

### 5.1 `KeyDerivationProviding`

- `deriveKey(password:saltBase64:kdfParams) -> Data`
- `calculateKeyHashBase64(rawKey: Data) -> String`

### 5.2 `VaultRepository`

- `fetchCurrentVault()`
- `createVault(encryptedData:dataHash:)`
- `updateVault(encryptedData:dataHash:expectedVersion:)`

### 5.3 `SecureStore`

- `saveAccessToken`, `readAccessToken`, `deleteAccessToken`
- `saveRefreshToken`, `readRefreshToken`, `deleteRefreshToken`
- `saveBiometricVaultKey`, `readBiometricVaultKey`, `deleteBiometricVaultKey`

## 6) Dependencias Swift - decisao e criterios

## 6.1 Dependencias aprovadas para v1

| Dependencia | Uso | Motivo de aprovacao |
|---|---|---|
| `supabase-swift` | auth/session + queries supabase | oficial, manutencao ativa |
| `swift-crypto` (se necessario) | hashing utilitario | opcional; preferir CryptoKit nativo |
| wrapper Argon2id auditado | Argon2id | CryptoKit nao possui Argon2id |

## 6.2 Dependencias explicitamente evitadas em v1

| Categoria | Razao |
|---|---|
| SDK analytics | aumenta superficie de privacidade/review |
| wrappers HTTP de terceiros | `URLSession` cobre necessidade |
| libs de JSON canonico opacas | risco de drift com protocolo ja fixado |
| libs de keychain sem controle de ACL | risco com `.biometryCurrentSet` |

## 6.3 Criterios de selecao (gate antes de adicionar pacote)

1. manutencao ativa (release <= 6 meses)
2. licenca permissiva compatível
3. suporte iOS 16+
4. sem uso de APIs privadas
5. compatibilidade com `PrivacyInfo.xcprivacy` (proprio ou documentado)
6. benchmark de memoria para fluxo ULTRA (Argon2id)

## 7) Baseline de entitlements (host + extension)

## 7.1 Host app

- `com.apple.security.application-groups`
  - `group.app.safebox.ios.shared`
- `keychain-access-groups`
  - `$(AppIdentifierPrefix)app.safebox.ios.shared`
- `com.apple.developer.associated-domains`
  - `webcredentials:safebox.app`
- `com.apple.developer.authentication-services.autofill-credential-provider`
  - `true`

## 7.2 AutoFill extension

- `com.apple.security.application-groups`
  - `group.app.safebox.ios.shared`
- `keychain-access-groups`
  - `$(AppIdentifierPrefix)app.safebox.ios.shared`

## 8) Riscos que o Codex tende a apontar (e como ja neutralizar)

1. Entitlements inconsistentes entre host e extension  
   Mitigacao: templates unicos em `docs/ios/templates`.

2. AutoFill sem donation em QuickType  
   Mitigacao: `CredentialIdentityDonation` em `Shared`.

3. Dependencia de browser semantics (`btoa`, ordenacao de JSON implicita)  
   Mitigacao: contrato de serializer explicito na Etapa 4.

4. 2FA/erro backend tratado por mensagem e nao por `code`  
   Mitigacao: usar catalogo de `code` documentado em `docs/api/ios-backend-contract.md`.

5. Chaves sensiveis fora de Keychain ACL correta  
   Mitigacao: `SecureStore` com matriz da skill `swift-keychain-secure`.

## 9) Gate de saida da Etapa 3

A Etapa 3 so fecha quando:

- arquitetura modular aprovada
- dependencias aprovadas documentadas (com rejeitadas)
- templates de entitlements criados para host+extension
- checklist preflight da etapa verde (arquivo separado)
- sem pendencia critica aberta para Etapa 4

