# Keychain Accessibility Matrix (iOS SafeBox)

Resumo tabular rapido. Para regras completas e exemplos de codigo, ver `SKILL.md`.

## 1. Constantes de acessibilidade (recap)

| Constante                                                | Disponivel quando                                           | Persiste apos uninstall | Sobrevive a reset de passcode |
|----------------------------------------------------------|-------------------------------------------------------------|-------------------------|-------------------------------|
| `kSecAttrAccessibleWhenUnlocked`                         | Device desbloqueado                                         | sim                     | sim                           |
| `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`           | Device desbloqueado, so neste device                        | sim                     | sim                           |
| `kSecAttrAccessibleAfterFirstUnlock`                     | Apos primeiro unlock apos boot                              | sim                     | sim                           |
| `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`       | Apos primeiro unlock, so neste device                       | sim                     | sim                           |
| `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`        | Apenas com passcode setado; removido se passcode for removido | sim (enquanto tiver passcode) | NAO (removido no reset)   |

Ver Apple Docs: <https://developer.apple.com/documentation/security/keychain_services/keychain_items/restricting_keychain_item_accessibility>

## 2. Flags de SecAccessControl (recap)

| Flag                        | Significado                                                                               |
|-----------------------------|-------------------------------------------------------------------------------------------|
| `.biometryAny`              | Qualquer biometria enrolada. Item NAO invalida se usuario adicionar outra biometria.      |
| `.biometryCurrentSet`       | Biometria no momento do save. Invalida se usuario alterar enrollment (adicionar/remover). |
| `.userPresence`             | Biometria OU passcode. Permite fallback para passcode.                                    |
| `.devicePasscode`           | Somente passcode (sem biometria).                                                         |
| `.or`                       | Combinador: qualquer um dos flags.                                                         |
| `.and`                      | Combinador: todos os flags.                                                                |
| `.privateKeyUsage`          | Uso com Secure Enclave keys.                                                               |
| `.applicationPassword`      | Exige senha fornecida pelo app (raro).                                                     |

**SafeBox usa somente `.biometryCurrentSet` para a AES key.** Sem `.or`. Sem `.userPresence`.

## 3. Decisao por item (aplicacao)

```
┌─────────────────────────────┬──────────────────────────────────────────┬──────────────────────────────────┐
│ Item                        │ Accessibility                            │ Access Control                   │
├─────────────────────────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ supabase_access_token       │ WhenUnlockedThisDeviceOnly               │ -                                │
│ supabase_refresh_token      │ AfterFirstUnlockThisDeviceOnly           │ -                                │
│ vault_aes_key_biometric     │ WhenPasscodeSetThisDeviceOnly            │ .biometryCurrentSet              │
│ vault_last_user_email       │ AfterFirstUnlockThisDeviceOnly           │ -                                │
│ autofill_shared_index_key   │ AfterFirstUnlockThisDeviceOnly (App Grp) │ -                                │
│ session_inactivity_stamp    │ WhenUnlockedThisDeviceOnly               │ -                                │
└─────────────────────────────┴──────────────────────────────────────────┴──────────────────────────────────┘
```

## 4. Motivos (para revisores de PR)

- **refresh_token usa `AfterFirstUnlock`**: precisa ser legivel durante o refresh silencioso em background (BGAppRefreshTask ou renovacao disparada por retry da rede). Com `WhenUnlocked`, o refresh falharia com `errSecInteractionNotAllowed` se o device estivesse com lock tela.
- **access_token usa `WhenUnlocked`**: so e lido quando usuario esta ativamente interagindo. Usar o padrao mais restritivo possivel.
- **AES key usa `WhenPasscodeSet`**: a acessibilidade mais restritiva que ainda permite biometria. Se o usuario remover o passcode do device, o item e automaticamente apagado pelo sistema -- comportamento desejado para item que libera o vault.
- **`.biometryCurrentSet`**: invalidacao automatica quando Face ID / Touch ID enrollment muda. Garante que terceiro que adiciona biometria NAO consegue abrir o vault sem redigitar a senha-mestra.
- **Todos `ThisDeviceOnly`**: garante que backup do iCloud nao leva a chave/token pra outro device.

## 5. Teste manual obrigatorio da matriz

Antes do TestFlight, validar em device fisico:

1. Salvar chave biometrica, abrir vault com Face ID => OK
2. Ir em Settings > Face ID & Passcode > Reset Face ID, re-enrollar, reabrir app => `errSecItemNotFound`, fluxo pede senha-mestra novamente => OK
3. Remover passcode do device => chave biometrica deve ser apagada automaticamente => OK
4. Fazer logout explicito => Keychain limpo para o service do SafeBox => validar com debugger ou listagem via `SecItemCopyMatching` + `kSecMatchLimit: kSecMatchLimitAll` => OK
5. Reinstalar app (delete + reinstall) => items com `ThisDeviceOnly` + sync=false podem permanecer (comportamento iOS historico); decisao: chamar wipe na primeira execucao pos-instalacao se detectarmos que nao ha user logado no Supabase => OK
6. Ativar airplane mode apos login, destrancar vault com Face ID => OK (AES key nao depende de rede)
7. Deixar device com tela trancada e aguardar BG refresh do token => nao dar `errSecInteractionNotAllowed` => OK

Documentar resultados em `tests/manual/keychain-matrix-validation.md` (sera criado na Etapa 5).
