# Keychain Error Cheatsheet (iOS SafeBox)

Referencia rapida para interpretar falhas do Keychain e reagir com o fluxo certo. Para implementacao completa, ver `SKILL.md` secao "Tratamento de erros".

## OSStatus frequentes

| OSStatus (num)                  | Nome do constante               | Causa real                                                                                     | Reacao no SafeBox                                                                 |
|---------------------------------|---------------------------------|------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| `-25300`                        | `errSecItemNotFound`            | (1) item nunca criado, (2) invalidado por `biometryCurrentSet`, (3) passcode do device removido | se item e `vault_aes_key_biometric`: chamar `recoverFromInvalidBiometry()`. Se e token: forcar login |
| `-25308`                        | `errSecInteractionNotAllowed`   | Device com tela trancada e item requer `WhenUnlocked`                                           | Abortar silenciosamente ou tentar de novo quando app ficar foreground              |
| `-25299`                        | `errSecDuplicateItem`           | `SecItemAdd` sem `SecItemDelete` anterior (bug do caller)                                       | Corrigir codigo; sempre delete-then-add                                            |
| `-25291`                        | `errSecNotAvailable`            | Keychain indisponivel (raro; simulador ou ambiente corrompido)                                  | Log diagnostico; desabilitar Face ID temporariamente; nao derrubar app             |
| `-25293`                        | `errSecAuthFailed`              | Usuario falhou biometria, ou contexto expirado                                                  | Apos 3 falhas consecutivas, requerer senha-mestra                                  |
| `-128`                          | `errSecUserCanceled`            | Usuario cancelou prompt biometrico                                                              | Voltar tela unlock, preservar estado, NAO limpar item                              |
| `-25295`                        | `errSecInvalidItemRef`          | Handle invalido (raro)                                                                          | Logar, refazer fluxo                                                               |

## LAError frequentes (quando usando LAContext)

| LAError                          | Significado                                                         | Reacao                                                                    |
|----------------------------------|---------------------------------------------------------------------|---------------------------------------------------------------------------|
| `.biometryNotAvailable`          | Hardware nao suporta biometria (iPod touch, etc)                    | Desabilitar feature Face ID no app; usuario so desbloqueia com senha      |
| `.biometryNotEnrolled`           | Usuario nao configurou Face ID / Touch ID no device                 | UI explicativa: "Configure Face ID para desbloqueio rapido". Nao bloquear |
| `.biometryLockout`               | Muitas falhas -> biometria bloqueada, precisa passcode              | Explicar e pedir senha-mestra                                             |
| `.passcodeNotSet`                | Device sem passcode configurado                                     | Chave AES nao pode ser gravada; forcar senha-mestra sempre                |
| `.userCancel`                    | Usuario cancelou prompt                                             | Voltar tela unlock                                                        |
| `.userFallback`                  | Usuario tocou "Enter Password"                                      | Transicionar para tela de senha-mestra                                    |
| `.systemCancel`                  | iOS cancelou (ex: app foi pro background durante prompt)            | Retry quando voltar foreground                                            |
| `.appCancel`                     | App chamou `invalidate()` no contexto                               | Comportamento esperado; nao e erro                                        |
| `.invalidContext`                | LAContext ja invalidado (reuso incorreto)                           | Criar novo LAContext a cada operacao                                      |

## Fluxograma de decisao (erro -> proxima tela)

```
SecItemCopyMatching / SecItemAdd retornou erro
           |
           v
  +------------------------------------------+
  | status == errSecItemNotFound?            |
  +------------------------------------------+
      |                   |
     SIM                 NAO
      |                   |
      v                   v
  item biometrico?     status == errSecInteractionNotAllowed?
      |                   |
     SIM                 SIM -> abortar, retry apos unlock do device
      |
      v
  recoverFromInvalidBiometry()
  => limpar chave biometrica
  => preservar refresh_token se valido
  => navegar para tela senha-mestra
```

## Mapeamento usuario-visivel (sem vazar detalhe tecnico)

| Situacao tecnica                              | Mensagem usuario (pt-BR)                                                      |
|-----------------------------------------------|-------------------------------------------------------------------------------|
| `errSecItemNotFound` em chave biometrica      | "Suas configuracoes de biometria mudaram. Digite sua senha-mestra."           |
| `LAError.biometryLockout`                     | "Biometria bloqueada. Digite sua senha-mestra para continuar."                |
| `LAError.biometryNotEnrolled`                 | "Face ID nao configurado neste dispositivo. Use sua senha-mestra."            |
| Tres falhas consecutivas de biometria         | "Muitas tentativas. Digite sua senha-mestra."                                 |
| `errSecAuthFailed`                            | "Nao foi possivel verificar sua identidade. Tente novamente ou use a senha."  |
| `errSecNotAvailable`                          | "Desbloqueio por biometria indisponivel no momento. Use sua senha-mestra."    |
| Erro generico                                 | "Algo deu errado. Digite sua senha-mestra para continuar."                    |

Nunca expor codigo OSStatus/LAError na UI. Logs internos (OSLog) podem registrar, sem contexto que permita distinguir usuarios.

## Observabilidade (Etapa 6+)

- Loggar apenas contagens agregadas de cada tipo de erro por sessao, nao individualmente
- Nunca loggar: account string, valor raw do item, Data do secret
- OSLog `category: "keychain"`, privacy `.private` em qualquer trecho potencialmente sensivel
