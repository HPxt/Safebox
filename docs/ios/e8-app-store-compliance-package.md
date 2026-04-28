# E8 - App Store Compliance Package

## Objetivo

Preparar o pacote de conformidade para submissao sem depender de memoria humana no ultimo dia.

## Controles implementados no repo

- `Info.plist` do host com `NSFaceIDUsageDescription`, ATS strict e `ITSAppUsesNonExemptEncryption`.
- Privacy Manifest do host com tracking false e coleta limitada a email/user id.
- Privacy Manifest da extensao AutoFill sem coleta propria declarada.
- Entitlements do host com `webcredentials:safebox.app`, `applinks:safebox.app`, App Group e Keychain Sharing.
- Entitlements da extensao com AutoFill Credential Provider, App Group e Keychain Sharing.
- `.gitguardian.yaml` ignora apenas vetores criptograficos gerados, preservando scan no restante do repo.
- `npm run ios:static-gate` valida os itens acima.

## App Store Connect

- Nome: `SafeBox`.
- Categoria primaria: Utilities.
- Device family v1: iPhone.
- Privacy Policy URL: obrigatoria e deve responder 200.
- Support URL: obrigatoria e deve responder 200.
- Export compliance: responder que usa criptografia e declarar isencao para protecao de dados pessoais do usuario.
- Demo account: email confirmado, 2FA desativado, vault pre-populado e master password documentada nas notas.

## Gate Mac/Xcode Cloud

- `xcodegen generate`.
- Build Release host + AutoFill extension.
- Archive para App Store Connect.
- Validar que PrivacyInfo aparece no archive do app e da extensao.
- Validar entitlements assinados com Team ID real.

## Criterio de aceite

- `npm run ios:static-gate` passa.
- App Review notes estao prontas em ingles.
- AASA em `https://safebox.app/.well-known/apple-app-site-association` valida sem redirect.
- Nenhum texto de metadata promete feature fora do v1.
