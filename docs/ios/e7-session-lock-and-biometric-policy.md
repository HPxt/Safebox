# Etapa 7 - Session Lock and Biometric Policy

## Objetivo

Definir e implementar o contrato de seguranca para sessao iOS separando:

- auth session (Supabase login/session);
- vault unlock session (cofre bloqueado/desbloqueado).

## E7.A State machine canonica

Estados:

- `signedOut`
- `signedInLocked`
- `unlocking`
- `unlocked`
- `relockRequired`
- `biometryInvalidated`
- `keyRotationDetected`
- `sessionExpired`

Eventos/transicoes:

- `loginSucceeded`: `signedOut -> signedInLocked`
- `unlockRequested`: `signedInLocked|relockRequired -> unlocking`
- `unlockSucceeded`: `unlocking -> unlocked`
- `unlockFailed`: `unlocking -> signedInLocked`
- `inactivityTimeout` / `appDidEnterBackground` / `vaultLockRequested`: `unlocked -> relockRequired`
- `keyRotationDetected`: `signedInLocked|relockRequired|unlocked -> keyRotationDetected`
- `biometryInvalidated`: `signedInLocked|relockRequired|unlocked -> biometryInvalidated`
- `authSessionExpired`: qualquer estado autenticado -> `sessionExpired`
- `relockAcknowledged`: `relockRequired|keyRotationDetected|biometryInvalidated -> signedInLocked`
- `logoutRequested`: qualquer estado autenticado -> `signedOut`

## E7.B Lock policy

Regras:

- timeout de inatividade com clock injetavel;
- lock ao background;
- lock ao logout;
- lock em key rotation;
- lock em expiracao da auth session;
- invalida estado sensivel em memoria ao relock.

## E7.C Biometria e reentrada

Implementado no host app:

- `KeychainBiometricVaultKeyStore` usa `LAContext` para autenticacao biometrica;
- chave derivada do cofre so e armazenada no Keychain apos acao explicita do usuario em "Ativar biometria";
- armazenamento usa `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` + `biometryCurrentSet` e pode ser revogado em "Desativar biometria";
- botao de biometria so aparece quando ha biometria disponivel e chave ja registrada no Keychain;
- reentrada biometrica valida a chave contra o `key_hash` atual antes de abrir o cofre;
- se a biometria mudar ou a chave ficar invalida, o app remove o item do Keychain e dispara `biometryInvalidated`;
- fallback para senha-mestra permanece sempre disponivel em `UnlockView`.

## E7.D UX de seguranca

- mensagens por `code/estado` (nao por parsing de texto);
- `PrivacyShieldView` cobre conteudo sensivel quando o app fica inativo/background;
- campos de senha usam `SecureField`, `textContentType(.password)`, sem autocorrect/autocapitalize;
- sem vazar detalhes internos.

## E7.E Contrato host <-> AutoFill extension

Implementado no repo:

- **Estado compartilhado (App Group):** `autofill-host-session.json` — `AutoFillSharedHostSessionState` (`schemaVersion`, `vaultUnlocked`, `grantExpiresAt` ISO8601). A extensão só lê o índice se `isExtensionAccessAllowed(at:)` for verdadeiro (fail-closed se arquivo ausente, expirado ou `vaultUnlocked == false`).
- **Índice metadado:** `autofill-index.json` — array de `AutoFillCredentialCandidate` (sem senhas). Host grava após unlock/reload; limpa em lock, background relock, rotação, logout.
- **Grant:** TTL curto (`AppCoordinator.autoFillExtensionGrantTTL`, padrão 5 min), renovado em `recordUserInteraction` e ao republicar o bridge após carregar o cofre.
- **Índice criptografado:** `AutoFillEncryptedIndexCodec` define HKDF(vaultKey) + AES-GCM para proteger metadados do índice; troca do storage runtime fica para o gate device com Keychain compartilhado.
- **Gate:** `AutoFillSessionGatingProvider` no target da extensão (`AutoFillProviderFactory`).
- **QuickType:** `CredentialIdentityDonationService` — `replaceAll` após bridge; `removeAll` em `revokeAutoFillExtensionAccess`.
- **Sem injeção silenciosa:** `provideCredentialWithoutUserInteraction` cancela sempre com `ASExtensionError.userInteractionRequired` até haver fluxo com biometria na UI da extensão.
- **Código:** `AutoFillSharedPersistence.swift`, `AutoFillSessionGating.swift` (SafeBoxCrypto); `AppCoordinator` (host); `CredentialProviderViewController` + `AutoFillProviderFactory` (extensão).

Pendente em device (gate E7.G): chave HKDF + Keychain `biometryCurrentSet` para decriptar índice e resolver senha; `LAContext` na UI da extensão.

## E7.F Testes

- state machine tests;
- timeout com clock injetavel;
- background/foreground;
- biometria invalidada;
- logout limpa estado sensivel/compartilhado;
- indice AutoFill criptografado: round-trip, chave errada e tamper detection;
- varredura de logs sensiveis.

## E7.G Gates

Gate Windows (condicional):

- contratos E7 implementados;
- `swift test --package-path ios/SafeBoxCore` passando quando houver toolchain Swift disponivel;
- varredura sem logs sensiveis criticos.

Gate Mac/device (encerramento oficial):

- biometria real;
- ciclo de app (background/foreground);
- integracao AutoFill em device.
- validacao de Keychain `biometryCurrentSet` apos adicionar/remover biometria no aparelho.

## Debito tecnico incluido na E7

- corrigir `PasswordGenerator.fisherYatesShuffle` para usar rejection sampling (sem `%`).
