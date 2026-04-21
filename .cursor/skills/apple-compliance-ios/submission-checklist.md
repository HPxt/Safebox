# App Store Submission Checklist (SafeBox iOS v1)

Lista acionavel para o RC do primeiro envio. Cada item precisa ser `[x]` na data da submissao. Rodar como ultimo passo antes de tocar "Submit for Review".

## 1. Binary / Xcode Archive

- [ ] Build configuration = `Release`
- [ ] Bitcode nao aplicavel (Apple removeu, confirmar que nao ha setting ativando)
- [ ] `SKIP_INSTALL = NO` nos targets main
- [ ] `PRODUCT_BUNDLE_IDENTIFIER` = `app.safebox.ios` (host) e `app.safebox.ios.AutoFill` (extension)
- [ ] Team ID selecionado consistentemente em host e extension
- [ ] Entitlements conferem (App Group, Keychain Access Group, associated-domains, autofill provider)
- [ ] `Info.plist` com `CFBundleVersion` incrementado monotonicamente
- [ ] `PrivacyInfo.xcprivacy` presente em host e extension
- [ ] `Validate App` no Organizer passa sem warnings ITMS
- [ ] Nenhum `print()` / `NSLog` ativo em Release com dados sensiveis (grep manual)
- [ ] `OSLog` privacy `.private` em qualquer log que possa conter username/email/vault

## 2. App Store Connect - Metadata

- [ ] Nome do app: `SafeBox`
- [ ] Subtitulo curto, sem canibalizar concorrentes
- [ ] Descricao em pt-BR e en-US
- [ ] Keywords sem "Bitwarden", "1Password", "LastPass", "Dashlane"
- [ ] URL de Politica de Privacidade: `https://safebox.app/privacy`
- [ ] URL de Suporte: `https://safebox.app/support`
- [ ] URL de Marketing (opcional): `https://safebox.app`
- [ ] Categoria primaria: Utilities ou Productivity
- [ ] Classificacao etaria: 4+
- [ ] Screenshots 6.7" e 5.5" (requisito minimo)
- [ ] App Preview (opcional) se houver
- [ ] Icone do app 1024x1024 sem alpha, sem transparencia, sem arredondamento

## 3. App Privacy Details

- [ ] "Do you collect data?": YES
- [ ] Email Address: Linked, not used for tracking, purpose App Functionality + Account Management
- [ ] User ID: Linked, not used for tracking, purpose App Functionality
- [ ] Other User Content (vault ciphertext): Linked, not used for tracking, purpose App Functionality
- [ ] No "Tracking" declarado
- [ ] "Third-party partners": Supabase
- [ ] Consistencia validada com `PrivacyInfo.xcprivacy`

## 4. Export Compliance

- [ ] Questionario Export Compliance respondido
- [ ] `ITSEncryptionExportComplianceCode` obtido e inserido em `Info.plist`
- [ ] `ITSAppUsesNonExemptEncryption` com valor correto (true/false conforme resposta)
- [ ] Consulta com legal/compliance sobre annual report BIS realizada e documentada em `docs/adr/`

## 5. Associated Domains (AASA)

- [ ] `https://safebox.app/.well-known/apple-app-site-association` retorna HTTP 200
- [ ] Content-Type `application/json`
- [ ] Nenhum redirect (3xx)
- [ ] JSON valido, sem BOM, sem whitespace estranho
- [ ] `TEAM_ID.app.safebox.ios` correto no arquivo
- [ ] `swcutil verify -d safebox.app` executa sem erros
- [ ] Tamanho < 128 KB
- [ ] Testado em device fisico: AutoFill detecta credenciais do SafeBox em Safari

## 6. Revisor - Material de apoio

- [ ] Usuario demo criado no ambiente de producao com:
    - email: `reviewer+app-store@safebox.app`
    - senha-mestra documentada em Notes for Reviewer
    - vault pre-populado com 2-3 credenciais de exemplo
- [ ] Notes for Reviewer explicam:
    - Como criar conta (se aplicavel; v1 so login, entao explicar que conta pre-criada e credenciais estao abaixo)
    - Como habilitar AutoFill em Settings > Passwords
    - Como testar Face ID (toggle em Security & Privacy)
    - Como apagar conta (passos 1, 2, 3)
- [ ] Screencast curto (opcional) do fluxo end-to-end anexado em Demo Video

## 7. Fluxos Funcionais (manual test em device real)

- [ ] Login com usuario valido
- [ ] Login com usuario invalido -> mensagem amigavel
- [ ] Face ID cadastrado -> unlock rapido na proxima sessao
- [ ] Face ID trocado no Settings -> app detecta e pede senha-mestra
- [ ] Face ID removido -> app desabilita feature, pede senha sempre
- [ ] Passcode do device removido -> chave biometrica e removida pelo sistema
- [ ] AutoFill habilitado -> SafeBox aparece na QuickType
- [ ] AutoFill: Face ID obrigatorio antes de injetar
- [ ] AutoFill: funciona offline com cache (ler)
- [ ] CRUD de credencial (add, edit, delete) funciona
- [ ] Copiar senha: limpa clipboard apos 30s (validar com outra app)
- [ ] Account deletion: fluxo completo, usuario nao consegue logar de novo
- [ ] Reinstall apos delete: Welcome screen, nenhum dado residual
- [ ] Localizacao: alternar iPhone pra en-US -> strings em ingles

## 8. Apos submissao

- [ ] Submeter com fase piloto em TestFlight com 20-30 beta testers por >= 7 dias antes de Production Release
- [ ] Monitorar crash reports via Xcode Organizer durante review
- [ ] Ter canal de comunicacao rapido com compliance/legal caso review pergunte
