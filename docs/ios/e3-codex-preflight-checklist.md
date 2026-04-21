# Etapa 3 - Preflight Checklist (anti-apontamento Codex)

Marcar tudo como `OK` antes de iniciar Etapa 4.

## A) Arquitetura

- [ ] Fronteiras de modulo documentadas (Features -> Contracts -> Core)
- [ ] `Crypto` isolado de UI/network
- [ ] `AutoFillExtension` sem dependencia de telas do app host
- [ ] Contratos minimos (`VaultRepository`, `SecureStore`, `KeyDerivationProviding`) definidos

## B) Dependencias

- [ ] `supabase-swift` aprovado para auth/session
- [ ] estrategia Argon2id definida e documentada (com risco de memoria)
- [ ] nenhuma dependencia de analytics no v1
- [ ] nenhuma lib que esconda Keychain ACLs
- [ ] criterio de selecao de pacote registrado (manutencao/licenca/iOS target/privacy manifest)

## C) Entitlements e capacidades

- [ ] host e extension compartilham o mesmo App Group
- [ ] host e extension compartilham o mesmo Keychain Access Group
- [ ] `webcredentials:safebox.app` definido no host
- [ ] capability de AutoFill Credential Provider presente no host
- [ ] extension configurada com `NSExtensionPointIdentifier` correto

## D) Contratos backend/supabase

- [ ] iOS vai tratar erro por `code` (nao por mensagem)
- [ ] rota 404 tambem tem `code: NOT_FOUND`
- [ ] contrato de `/api/vault` e `/api/auth/2fa/*` mapeado para estados de UI
- [ ] fallback supabase (kdf_salt/kdf_params/key_hash) conhecido e documentado

## E) Seguranca e compliance ja antecipadas

- [ ] matriz Keychain (`ThisDeviceOnly`, `biometryCurrentSet`) referenciada
- [ ] regra de donation/remove para `ASCredentialIdentityStore` definida
- [ ] baseline de `PrivacyInfo.xcprivacy` conhecida para app + extension
- [ ] sem uso planejado de APIs privadas / bypass ATS

## F) Saida da etapa

- [ ] documento de design E3 revisado
- [ ] templates de entitlements prontos para copiar no Xcode
- [ ] riscos residuais listados para Etapa 4

