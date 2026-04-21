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
| `Argon2Swift` (candidato primario) | Argon2id | binding C comum, controle de memory/iterations/parallelism/hashLength |
| `libsodium` via wrapper iOS (fallback) | Argon2id | fallback se candidato primario falhar em paridade/manutencao/licenca |

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

## 6.4 Decisao executavel Argon2id (obrigatoria antes da Etapa 4)

### Candidato primario

- `Argon2Swift`

### Candidato fallback

- wrapper iOS de `libsodium` com suporte explicito a `argon2id`

### Criterios de rejeicao (fail-fast)

1. nao compila em iOS 16+ em target real
2. licenca incompatível com distribuicao comercial
3. sem manutencao recente (ultimo release > 12 meses)
4. nao permite configurar exatamente `memorySize`, `iterations`, `parallelism`, `hashLength`
5. falha em qualquer vetor do `.cursor/skills/swift-crypto-parity/test-vectors.json`

### Gate de teste obrigatorio para escolha final

- reproduzir todos os vetores KDF (LOW/MEDIUM/HIGH/ULTRA) e bater:
  - `pbkdf2Hex`
  - `pbkdf2Base64`
  - `combinedPassword`
  - `derivedKeyHex`
  - `keyHashBase64`
- se qualquer campo divergir, pacote reprovado para Etapa 4

## 7) Baseline de entitlements (host + extension)

## 7.0 Tabela canonica de identificadores (fixar antes do Xcode bootstrap)

| Item | Valor canonico |
|---|---|
| Team ID | `TEAMID` (placeholder ate binding no Apple Developer) |
| Host bundle id | `app.safebox.ios` |
| Extension bundle id | `app.safebox.ios.autofill` |
| App Group | `group.app.safebox.ios.shared` |
| Keychain Access Group | `$(AppIdentifierPrefix)app.safebox.ios.shared` |
| AASA appIDs | `TEAMID.app.safebox.ios`, `TEAMID.app.safebox.ios.autofill` |

Regra: qualquer divergencia desta tabela quebra provisioning/Keychain/AutoFill/AASA.

## 7.1 Host app

- `com.apple.security.application-groups`
  - `group.app.safebox.ios.shared`
- `keychain-access-groups`
  - `$(AppIdentifierPrefix)app.safebox.ios.shared`
- `com.apple.developer.associated-domains`
  - `webcredentials:safebox.app`

Observacao importante: a capability de Credential Provider extension e assinada no target da extensao. No host, manter apenas os entitlements realmente necessarios (Associated Domains/App Groups/Keychain).

## 7.2 AutoFill extension

- `com.apple.security.application-groups`
  - `group.app.safebox.ios.shared`
- `keychain-access-groups`
  - `$(AppIdentifierPrefix)app.safebox.ios.shared`
- `com.apple.developer.authentication-services.autofill-credential-provider`
  - `true`

## 7.3 Baseline de compliance para iniciar Etapa 4

Arquivos obrigatorios ja prontos nesta etapa:

- `docs/ios/templates/PrivacyInfo.host.template.xcprivacy`
- `docs/ios/templates/PrivacyInfo.autofill.template.xcprivacy`
- `docs/ios/templates/SafeBox-Info.plist.template.md`
- `docs/ios/templates/aasa.baseline.v1.json`
- `docs/ios/templates/app-review-demo-account-checklist.md`

Sem esses baselines, a Etapa 4 tende a nascer com configuracao incompleta e gera retrabalho na Etapa 8/10.

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

