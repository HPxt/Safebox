---
name: apple-compliance-ios
description: >-
  Consolida as exigencias da Apple para aprovacao do SafeBox iOS no primeiro
  envio: Privacy Manifest (PrivacyInfo.xcprivacy), Required Reason APIs,
  App Privacy Details ("Nutrition Label"), Export Compliance, ATS, AASA
  (webcredentials), Data Protection, Account Deletion in-app (guideline 5.1.1v),
  localizacao minima, Screenshots das Guidelines 2.3.3/2.3.7 e checklist
  anti-rejeicao. Use antes de qualquer PR que toca Info.plist, entitlements,
  xcprivacy, configuracao do App Store Connect ou review submission.
  Bloqueador: rejeicao aqui atrasa lancamento em semanas.
triggers:
  - "**/Info.plist"
  - "**/PrivacyInfo.xcprivacy"
  - "**/*.entitlements"
  - "**/ExportOptions.plist"
  - "**/*Localizable.strings"
  - "**/*.xcassets/**"
  - ".cursor/skills/apple-compliance-ios/**"
---

# apple-compliance-ios

## Objetivo

Maximizar a chance de aprovacao do SafeBox no primeiro envio e minimizar o tempo de revisao. Violacao de qualquer item aqui e risco direto de rejeicao ou delay.

## Fontes oficiais (consultar antes de mudar)

- App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Privacy Manifests: <https://developer.apple.com/documentation/bundleresources/privacy_manifest_files>
- Required Reason APIs: <https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api>
- App Privacy Details: <https://developer.apple.com/app-store/app-privacy-details/>
- Associated Domains: <https://developer.apple.com/documentation/xcode/supporting-associated-domains>
- Account Deletion (5.1.1v): <https://developer.apple.com/support/offering-account-deletion-in-your-app/>

**Quando houver duvida**: consultar documentacao oficial e registrar decisao em ADR no repo (`docs/adr/` a ser criado).

## 1. PrivacyInfo.xcprivacy (Privacy Manifest)

Obrigatorio desde fevereiro/2024 para apps e SDKs distribuidos. O manifest do SafeBox descreve **apenas o que o app coleta diretamente**; SDKs de terceiros sao responsaveis por seus proprios manifests.

### Localizacao

- Host app: `SafeBox/PrivacyInfo.xcprivacy`
- Extension: `AutoFillExtension/PrivacyInfo.xcprivacy`

### Template inicial do host (a ajustar com legal/compliance)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>

    <key>NSPrivacyTrackingDomains</key>
    <array/>

    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <!-- Email vinculado a user -->
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeEmailAddress</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
                <string>NSPrivacyCollectedDataTypePurposeAccountManagement</string>
            </array>
        </dict>
        <!-- User ID (Supabase user.id) -->
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeUserID</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
        <!-- Other User Content: vault encriptado enviado ao servidor -->
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeOtherUserContent</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
    </array>

    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <!-- UserDefaults: Required Reason Category CA92.1 -->
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
        <!-- File timestamp: C617.1 (access own app data) -->
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>C617.1</string>
            </array>
        </dict>
        <!-- System boot time: nao usar em v1 a menos que efetivamente chame CACurrentMediaTime -->
    </array>
</dict>
</plist>
```

### Regras

- Se SafeBox NAO coletar `DeviceID`/`UserDefaults` de tracking, manter `NSPrivacyTracking = false` (posicao atual do v1)
- Marcar vault como `NSPrivacyCollectedDataTypeOtherUserContent` e **nao** "Not Collected": vault ciphertext deixa o device
- Toda chamada a `CACurrentMediaTime`, `systemUptime`, `mach_absolute_time`, `fstat`, `stat`, `UserDefaults`, `Disk Space APIs` precisa justificativa na lista Required Reason
- Executar `Xcode > Product > Archive > Validate App` antes do upload: Apple alerta inconsistencias do manifest

### Riscos conhecidos

- **Esquecer de declarar `UserDefaults`**: app rejeitado em ITMS com `ITMS-91053`
- **Declarar tracking quando nao tracka**: overreport, mas pior e **nao declarar** tracking e fazer => rejeicao
- **SDK terceiro sem manifest**: desde maio/2024 Apple bloqueia upload se SDK listado como "commonly used" nao tiver manifest. v1: nao planejamos SDKs terceiros; se entrar (ex: analytics), validar antes

## 2. App Privacy Details (App Store Connect)

Preencher na ficha do App Store Connect quando submeter. Precisa ser consistente com `PrivacyInfo.xcprivacy`.

| Secao                                   | Resposta v1                                                                                |
|-----------------------------------------|--------------------------------------------------------------------------------------------|
| "Do you collect data from this app?"    | YES                                                                                        |
| Data Types collected                    | Email Address, User ID, Other User Content (vault ciphertext)                              |
| Data Linked to User?                    | YES para todos os 3                                                                        |
| Data Used to Track User?                | NO                                                                                         |
| Third-Party Partners?                   | Supabase (backend as a service) -- descrever purpose: App Functionality, Account Management |
| Retention and deletion                  | Dados sao apagados ao excluir conta (ver secao 6)                                           |

**Decisao juridica pendente**: confirmar com compliance se vault ciphertext pode ser classificado como "Not Collected" com base em "end-to-end encrypted, provider cannot decrypt". Apple permite em alguns casos; ate validacao, usar "Other User Content".

## 3. Export Compliance (criptografia)

Obrigatorio porque o SafeBox usa criptografia (AES-256-GCM + Argon2id + PBKDF2) alem dos algoritmos de HTTPS.

### Questionario App Store Connect

1. Does your app use encryption? **YES**
2. Does your app qualify for any of the exemptions provided in Category 5, Part 2 of the U.S. Export Administration Regulations? **YES**
   - Exemption: "The app uses, accesses, implements or incorporates encryption for authentication only" OR "The app uses, accesses, implements or incorporates encryption with key lengths not exceeding 56 bits symmetric, 512 bits asymmetric and/or 112 bits elliptic curve"
   - SafeBox usa AES-256 => NAO se enquadra em "56 bits"
   - SafeBox usa criptografia para proteger dados do usuario, nao so auth => verificar exemption "uses only ... specifically for the purpose of supporting authorized information flow between the app and server"
   - Most likely: SafeBox cai em exemption mass-market (Note 3 to Category 5, Part 2)
3. Does your app meet any of the following: Makes use of ONLY exempt encryption? **A confirmar com compliance**

### Info.plist

Depois que o questionario for preenchido e aprovado, Apple retorna um **codigo** a ser incluido em `Info.plist`:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<true/>   <!-- ou false, conforme resposta -->
<key>ITSEncryptionExportComplianceCode</key>
<string>XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX</string>
```

**NAO hardcodar `true` antes de ter o codigo**. Uploads que dizem `true` sem codigo falham no upload.

### Documentacao anual (BIS)

Obrigacao regulatoria anual (Export Administration Regulations, Note 3) **pode** se aplicar. Validar com legal/compliance antes de considerar "tudo ok". Nao e responsabilidade do time de eng sozinho decidir.

## 4. Associated Domains / AASA

### Entitlement

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>webcredentials:safebox.app</string>
</array>
```

`applinks:` fica de fora na v1 (sem signup in-app / deep links). Entra em v1.x quando signup voltar.

### apple-app-site-association (hospedado em `https://safebox.app/.well-known/apple-app-site-association`)

```json
{
  "webcredentials": {
    "apps": ["TEAM_ID.app.safebox.ios"]
  }
}
```

### Checklist de verificacao de producao do AASA

Antes do TestFlight, validar:

1. HTTP 200 em `https://safebox.app/.well-known/apple-app-site-association` (sem `.json`)
2. **Sem redirect** (HTTP 3xx). Apple nao segue redirect.
3. Content-Type: `application/json` (nao `text/json`, nao `text/plain`)
4. Response body e JSON valido
5. Sem espacos em branco com caracteres especiais, sem BOM
6. TeamID no formato `ABCDE12345` (10 chars, sem `.team`)
7. Bundle ID exato: `TEAM_ID.app.safebox.ios`
8. Tamanho < 128 KB
9. Testar com `swcutil verify -d safebox.app` em Mac dev
10. Usar Apple CDN test: aguardar ate 48h para propagacao apos primeiro deploy; em subsequentes, reset via `sudo swcutil reset` no Mac dev

### Riscos

- Certificate erroneo no servidor: AASA falha silenciosamente
- Redirect de www.safebox.app para safebox.app: nao funcionar; usar URL canonica direta
- Cache agressivo: Apple CDN ignora `Cache-Control`; mudanca pode levar 24-48h para propagar

## 5. App Transport Security (ATS)

### Configuracao alvo

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

- **Zero** exceptions. SafeBox so conversa com `https://api.safebox.app` e `https://*.supabase.co`, ambos com TLS 1.2+ e HTTPS valido.
- Certificate pinning: **fora do v1** (adicionar quando tivermos processo de rotacao bem estabelecido para evitar auto-DoS)
- Se algum momento precisar falar com endpoint sem TLS valido (nao deveria): documentar e justificar antes

## 6. Account Deletion in-app (Guideline 5.1.1(v))

### Requisitos Apple

- Usuario deve conseguir iniciar delecao **dentro do app**, nao so no site
- Delecao deve ser de fato, nao "desativacao"
- Caminho deve estar a no maximo 2-3 toques da tela principal apos login
- Nao pode redirecionar para web-view/email para completar (exceto caso excepcional com confirmacao extra)

### Fluxo v1

```
Settings (principal)
  -> Security & Privacy
    -> Delete Account
      -> Re-autenticacao (senha-mestra OU Face ID)
        -> Confirmacao dupla (texto "DELETE")
          -> DELETE /api/auth/account (backend)
            -> Wipe local completo
              -> Return to Welcome screen
```

### Criterios de aceitacao completos (cross-check com skill swift-keychain-secure)

- [ ] DELETE backend retorna 200
- [ ] Vault row apagado no Supabase
- [ ] User row apagado no Supabase (auth.users + public.users)
- [ ] Backups (se houver) apagados conforme periodo declarado nos terms
- [ ] Session Keychain wipeada
- [ ] AES biometric key apagada do Keychain
- [ ] App Group autofill files apagados
- [ ] `ASCredentialIdentityStore.removeAllCredentialIdentities` executado
- [ ] UserDefaults do app limpos (exceto flag `hasLaunchedBefore` opcional)
- [ ] Clipboard limpo se havia dado sensivel
- [ ] UI volta para Welcome screen sem "logout" parecendo ambiguo
- [ ] Push notifications (se houver v1.x) sao desregistrados no server

## 7. Screenshots e Metadata (Guideline 2.3.x)

- Screenshots no App Store Connect devem **refletir o app real**, nao mockups; Apple verifica
- Evitar capturas que mostrem senhas reais (mesmo de fake user); usar placeholders `●●●●●●●●` ou strings obvias como `demo-password`
- Descrever o uso de Face ID explicitamente em `NSFaceIDUsageDescription`
- Localizar metadata e screenshots em pt-BR e en-US na ficha do App Store
- Keywords: nao usar nome de concorrentes (Bitwarden, 1Password, LastPass) -- fonte de rejeicao 2.3.10

## 8. Localizacao minima

v1 obrigatorio: pt-BR + en-US. Todas as strings em `Localizable.strings` (nao hardcoded).

Strings criticas que precisam existir nas duas linguas:

- `NSFaceIDUsageDescription` (Info.plist localizado via `InfoPlist.strings`)
- `NSLocalNetworkUsageDescription` (se usar -- evitar)
- Mensagens de erro do fluxo de autenticacao e unlock
- Titulos e botoes da Account Deletion
- Prompts do extension AutoFill

Exemplo `InfoPlist.strings` (pt-BR):

```
"NSFaceIDUsageDescription" = "Use Face ID para desbloquear seu cofre rapidamente.";
```

## 9. Info.plist obrigatorios (host app, v1)

```xml
<key>CFBundleDisplayName</key>
<string>SafeBox</string>

<key>CFBundleShortVersionString</key>
<string>1.0.0</string>

<key>CFBundleVersion</key>
<string>1</string>

<key>LSRequiresIPhoneOS</key>
<true/>

<key>UIRequiredDeviceCapabilities</key>
<array>
    <string>armv7</string>
</array>

<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>

<key>UIBackgroundModes</key>
<array>
    <!-- nao adicionar exceto se realmente necessario; adiciona review scrutiny -->
</array>

<key>NSFaceIDUsageDescription</key>
<string>Use Face ID para desbloquear seu cofre rapidamente.</string>

<key>UIFileSharingEnabled</key>
<false/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<false/>
```

## 10. Desabilitar backup para arquivos sensiveis

Todo arquivo em `Documents/` que contenha cache de vault ou tokens: excluir de iCloud backup com `NSURLIsExcludedFromBackupKey`:

```swift
var url = documentsURL.appendingPathComponent("vault-cache.enc")
var values = URLResourceValues()
values.isExcludedFromBackup = true
try url.setResourceValues(values)
```

Alternativa: guardar em `Library/Caches/` (iOS nao faz backup automaticamente) OU `Library/Application Support/` com `NSURLIsExcludedFromBackupKey`. Evitar `Documents/` para artefatos nao-user-facing.

## 11. Checklist anti-rejeicao consolidado

Antes de qualquer submissao para review:

### Binary / Xcode

- [ ] `PrivacyInfo.xcprivacy` presente e consistente com o que o app faz
- [ ] Required Reason APIs declaradas (`UserDefaults`, `FileTimestamp`, etc)
- [ ] `Validate App` no Xcode Archive passa sem warnings ITMS
- [ ] Builds com Release config, sem flags debug, sem symbols de debug inclusos
- [ ] Nao ha `print()` em producao que logue segredos
- [ ] Icons em todos os tamanhos (incluindo App Store 1024x1024 sem alpha)

### App Store Connect

- [ ] App Privacy Details preenchido e consistente com xcprivacy
- [ ] Export Compliance respondido e `ITSEncryptionExportComplianceCode` obtido
- [ ] Screenshots nao mostram dados reais nem senhas legiveis
- [ ] Descricao menciona claramente "gerenciador de senhas", "cofre criptografado"
- [ ] Keywords nao canibalizam concorrentes
- [ ] Test user credentials fornecidos para revisor (email dedicado, NAO usar o email pessoal)
- [ ] Notes for Reviewer explicam fluxos nao-obvios (Face ID, AutoFill setup)

### Backend / Infra

- [ ] AASA disponivel, HTTP 200, Content-Type correto, sem redirect
- [ ] API suporta endpoint de delecao real
- [ ] Politica de privacidade publicada em `https://safebox.app/privacy`
- [ ] Termos de uso publicados em `https://safebox.app/terms`
- [ ] Links de privacidade e termos dentro do app funcionando

### Funcional (manual test)

- [ ] App funciona em device real iOS 17+ (minimo alvo v1)
- [ ] Account deletion apaga tudo (ver checklist secao 6)
- [ ] Face ID prompt aparece com mensagem localizada corretamente
- [ ] AutoFill funciona em Safari + app de teste (ex: Sign-in form)
- [ ] Logout -> QuickType bar limpa
- [ ] Reinstall -> app nao reaparece com sessao aberta

## 12. Referencias cruzadas

- `swift-keychain-secure` -- wipe completo do Keychain em delecao
- `swift-autofill-extension` -- remove-all de identidades
- `swiftui-security-ui` -- anti-screenshot na UI sensivel
- `swift-crypto-parity` -- declaracao de uso de criptografia (Export Compliance)
