# Auditoria E0-E5 (prometido vs entregue)

Data: 2026-04-21  
Escopo: verificacao retroativa das etapas iOS para evitar lacunas antes da continuacao.

## Resultado executivo

- E0: **Concluida**
- E1: **Concluida**
- E2: **Concluida**
- E3: **Concluida**
- E4: **Concluida**
- E5: **Core + SwiftUI shell concluidos** (fluxos de dominio/sync testados; app SwiftUI inicial criado; adapters precisam de configuracao real antes do TestFlight)

## Matriz por etapa

| Etapa | Status | Evidencias | Lacunas |
|---|---|---|---|
| E0 - Skills/Golden Path | Concluida | `scripts/validate-ios-skills.mjs`, `.cursor/skills/swift-crypto-parity/test-vectors.json` | Sem lacuna critica identificada |
| E1 - Vault protocol parity spec/tests | Concluida | `docs/vault-protocol-spec.md`, `frontend/src/services/__tests__/vault-protocol.test.ts` | Sem lacuna critica identificada |
| E2 - Backend contract/error mapping | Concluida | `docs/api/ios-backend-contract.md`, `backend/src/security/errors.test.ts` | Sem lacuna critica identificada |
| E3 - Project design/entitlements/privacy templates | Concluida | `docs/ios/e3-ios-project-design.md`, `docs/ios/e3-codex-preflight-checklist.md`, `docs/ios/templates/*` | Checklist E3 ainda esta em formato template (checkbox), mas artefatos existem |
| E4 - Bootstrap crypto core | Concluida | `ios/SafeBoxCore/Package.swift`, `ios/SafeBoxCore/Sources/SafeBoxCrypto/*`, `ios/SafeBoxCore/Tests/SafeBoxCryptoTests/*`, `docs/ios/e4-ios-bootstrap.md` | CI macOS ainda nao foi materializado no repo |
| E5 - Vault sync and mobile policy | Core + SwiftUI shell concluidos | `docs/ios/e5-vault-sync-and-mobile-kdf-policy.md`, `MobileKDFPolicy`, `MasterPasswordPolicy`, `PasswordGenerator`, `UnlockSessionGuard`, `VaultUnlockService`, `VaultSyncService`, `FallbackUserKDFProfileProvider`, `FallbackVaultRemoteStore`, `VaultE5FlowTests`, `ios/SafeBoxApp/project.yml`, `ios/SafeBoxApp/Sources/*` | Gerar `.xcodeproj`, configurar URLs/keys de ambiente, validar em Xcode/device real |

## Detalhamento do que foi fechado em E5 core

Itens agora entregues em implementacao Swift testavel:

1. Fluxo de unlock por `UserKDFProfile` com `kdf_salt`, `kdf_params`, `key_hash`, validacao de senha-mestra e aviso ULTRA.
2. Fallback de profile `users` -> `user_metadata` via `FallbackUserKDFProfileProvider`.
3. Deteccao de rotacao por comparacao de `key_hash` mais recente contra chave cacheada.
4. Pipeline de leitura de vault com verificacao de `dataHash`, parse de envelope v2, decrypt e leitura de `folders`.
5. Pipeline de escrita de vault com envelope canonico, `dataHash`, `expectedVersion` e propagacao de `versionConflict`.
6. Serializacao de payload interno removendo `version`, preservando `null` semantico e campos desconhecidos.
7. Fallback de leitura `backend` -> `credentials.enc_blob` -> `vaults.encrypted_data` via `FallbackVaultRemoteStore`.
8. Politica mobile KDF, politica de senha-mestra e gerador de senha segura.

## Pontos ainda pendentes fora do core/shell

Estes pontos dependem de Xcode/macOS, credenciais reais e device:

1. Gerar o projeto Xcode com XcodeGen e assinar com Team ID real.
2. Injetar `supabaseURL`, `supabaseAnonKey` e `backendURL` em `SafeBoxAppEnvironment.production(...)`.
3. Validar os adapters contra producao/staging em device real.
4. UX de retry/merge depois de `409`.
5. Persistencia/cache offline com protecao de arquivo iOS.
6. Clipboard iOS com `expirationDate` e `localOnly`.
7. Testes UI/integration em device real para os criterios de aceite da Etapa 5.

## Prioridade de fechamento

P0 para a proxima etapa de app:

- gerar e validar o target SwiftUI no Xcode
- ligar `SafeBoxAppEnvironment.production(...)` a configuracao segura
- criar AutoFill extension target

P1:

- cache offline criptografado
- clipboard seguro
- UX de conflito `409`

P2:

- CI macOS dedicado para `ios/SafeBoxCore` (separado da entrega funcional de E5)

## Politica de comunicacao para proximas etapas

Para evitar ambiguidade, cada entrega deve reportar:

- **Subetapa** (ex.: E5.A, E5.B)
- **Feito**
- **Nao feito**
- **Gate da subetapa**
