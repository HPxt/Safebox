# E9 - Hardening and Safe Observability

## Objetivo

Reduzir superficie de vazamento e garantir que erros/logs sejam uteis sem expor segredo.

## Controles implementados no repo

- `HTTPResponseValidator` nao propaga corpo bruto de erro HTTP para a UI.
- Erros iOS usam status e `code` sanitizado por allow-list curta.
- Varredura iOS por `print(`, `NSLog`, `os_log`, `logger.`, `DebugAgentLog` e collector local deve retornar zero.
- `provideCredentialWithoutUserInteraction` na extensao AutoFill falha com `userInteractionRequired`.
- `AutoFillEncryptedIndexCodec` define HKDF + AES-GCM para proteger metadados do indice antes da troca runtime no device.
- Biometria e opt-in explicito; a chave do cofre nao e salva automaticamente apos unlock.

## Proibido em Release

- Logar senha-mestra, chave derivada, plaintext, access token, refresh token, ciphertext completo ou segredo 2FA.
- Exibir corpo bruto de erro HTTP.
- Persistir credenciais descriptografadas em disco.
- Injetar AutoFill sem UI/biometria explicita.
- Usar `NSAllowsArbitraryLoads = true`.

## Gate Windows

- `npm run ios:static-gate`.
- `rg -n "print\\(|NSLog|os_log|logger\\.|DebugAgentLog|127\\.0\\.0\\.1:7308" ios/SafeBoxApp ios/SafeBoxCore -S` deve retornar sem matches.
- `npm audit --omit=dev` deve retornar 0 vulnerabilidades produtivas.

## Gate Mac/Xcode Cloud

- Validar Keychain `biometryCurrentSet` apos adicionar/remover biometria no aparelho.
- Validar app switcher privacy shield.
- Validar que AutoFill nao retorna senha sem interface protegida.
- Validar que logs do device nao contem segredos.

## Criterio de aceite

- Todas as falhas sensiveis retornam mensagem amigavel.
- Nenhuma evidencia de token/senha/chave aparece em log, UI de erro ou arquivo App Group.
- Vulnerabilidades produtivas seguem zeradas.
