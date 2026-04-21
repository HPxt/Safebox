# Etapa 5 - Vault Sync and Mobile KDF Policy

## Objetivo

Fechar o contrato de implementacao do iOS v1 para:

- setup inicial fora do caminho critico de envio;
- unlock, leitura e escrita de vault;
- deteccao de rotacao de senha-mestra;
- serializacao canonica e round-trip seguro (incluindo `null` vs `undefined`);
- leitura de pastas (folders) para UX minima;
- politica mobile de KDF + criacao de senha-mestra;
- gerador de senha segura com paridade funcional com o web.

## Status de implementacao core

Esta etapa agora possui uma camada core Swift testavel em `ios/SafeBoxCore`:

- `VaultUnlockService`: orquestra busca de KDF profile, validacao de senha-mestra e aviso ULTRA;
- `FallbackUserKDFProfileProvider`: define fallback `users` -> `user_metadata`;
- `VaultSyncService`: le e escreve vault com verificacao de `dataHash`, envelope v2, decrypt/encrypt e `expectedVersion`;
- `FallbackVaultRemoteStore`: define fallback de leitura `backend` -> `credentials.enc_blob` -> `vaults.encrypted_data`;
- `VaultPlaintextPayload`: preserva payload interno e remove `version` no caminho de escrita;
- `MobileKDFPolicy`, `MasterPasswordPolicy`, `PasswordGenerator` e `UnlockSessionGuard`: fecham as policies de produto/seguranca da fase.

Tambem foi criado um shell SwiftUI real em `ios/SafeBoxApp`, com `project.yml` para XcodeGen, telas nativas de login/unlock/lista/settings e coordinator usando os services da E5.

Limite consciente: o app ainda precisa ser gerado/assinado no Xcode e receber configuracao real de ambiente para Supabase/backend. AutoFill, cache offline, clipboard seguro e testes em device real ficam para a fase seguinte.

## 5.0 Primeiro setup de senha-mestra (fora do caminho critico v1)

Decisao v1 apos revisao externa:

- cadastro in-app foi removido do escopo do primeiro envio;
- o fluxo de primeiro setup de senha-mestra tambem sai do caminho critico;
- usuarios devem fazer setup inicial via web;
- iOS v1 assume que `kdf_salt`, `kdf_params` e `key_hash` ja existem no Supabase ao logar.

Quando cadastro voltar em v1.x, o fluxo esperado sera:

1. gerar salt de 32 bytes aleatorios e codificar em base64;
2. derivar chave usando nivel LOW por padrao no mobile;
3. calcular `key_hash = SHA256(rawKey).base64`;
4. gravar `kdf_salt`, `kdf_params`, `key_hash` em `users`;
5. fallback (mesmo padrao web): se update em `users` falhar por RLS, tentar `supabase.auth.updateUser({ data: { kdf_salt, kdf_params } })`.

Se iOS v1 nao suportar cadastro:

- documentar explicitamente como limitacao;
- permitir somente login de usuarios ja configurados.

## 5.1 Fluxo de unlock

Fluxo normativo:

1. usuario autentica via Supabase auth;
2. app busca `kdf_salt`, `kdf_params`, `key_hash` em `users` via Supabase query;
3. fallback: se `kdf_salt` nao estiver em `users`, verificar `user_metadata`;
4. usuario informa senha-mestra;
5. app deriva chave via `VaultCrypto.deriveKey()` usando `kdf_params` do banco (sem hardcode);
6. app calcula `SHA256(rawKey).base64` e compara com `key_hash`;
7. se bater: guarda chave apenas em memoria;
8. opcional: permitir reentrada com Face ID guardando chave protegida em Keychain com `.biometryCurrentSet`;
9. se nao bater: incrementar contador e aplicar delay progressivo.

## 5.1.1 Deteccao de rotacao de senha-mestra

Contexto:

- o web permite alterar senha-mestra e nivel de seguranca;
- quando isso ocorre, `kdf_salt`, `kdf_params`, `key_hash` mudam;
- o vault e re-criptografado com a nova chave.

Contrato iOS v1:

- antes de descriptografar, comparar `key_hash` atual do banco com hash da chave em memoria/Keychain;
- se nao bater, invalidar chave local e exigir novo unlock;
- mostrar mensagem explicativa: `Sua senha-mestra foi alterada em outro dispositivo`.

Decisao v1:

- iOS v1 nao precisa suportar fluxo completo de troca/re-encrypt local;
- apenas detectar mudanca e pedir re-unlock.

## 5.2 Leitura de vault

Fluxo normativo:

1. `GET /api/vault` com Bearer token;
2. fallback: consulta Supabase direta no mesmo padrao documentado para web;
3. parse de `encryptedData` e validacao de `version === "vault-snapshot-v2"`;
4. decrypt com chave em memoria;
5. parse JSON para array de `Credential`;
6. guardar `currentVaultVersion`.

## 5.3 Escrita de vault

Fluxo normativo:

1. montar array de credenciais sem campo `version`;
2. serializar payload interno conforme estrategia de serializacao desta etapa;
3. encrypt para envelope (`version`, `nonce`, `encrypted`);
4. gerar `dataHash = SHA-256 hex lower` do JSON canonico do envelope;
5. `PUT /api/vault` com `expectedVersion`;
6. em `409 CONFLICT`, recarregar vault e avisar usuario para retry/merge.

## 5.3.1 Estrategia de serializacao canonica (revisada)

### Envelope externo (hashado)

- usar `Encodable` com ordem fixa de chaves: `version`, `nonce`, `encrypted`;
- manter JSON compacto sem whitespace;
- compatibilidade alvo: mesmo efeito de `JSON.stringify` do web para o envelope.

### Payload interno (criptografado)

- quando iOS apenas le (sem editar), preservar JSON plaintext original apos decrypt (passthrough);
- quando iOS edita, reserializar com serializer canonico proprio documentado;
- manter ordem do array de itens e preservar campos desconhecidos.

Pontos criticos obrigatorios:

- nao depender de "ordem natural de dicionario" em Swift;
- preservar compatibilidade com tipos de item nao renderizados na UI;
- preservar `folderId` e campos desconhecidos;
- tratar semantica `undefined` vs `null` de forma explicita.

### `undefined` vs `null` (alto risco de drift)

- `undefined` no web significa campo ausente (omitido no JSON);
- `null` significa campo presente com valor nulo (deve ser preservado).

Campos sensiveis de drift (`string | null`) como `totpSecret`, `cardHolderName`, `cardNumber`, `cardBrand`, `cardExpMonth`, `cardExpYear`, `cardCvv` exigem preservacao explicita de `null`.

Implementacao Swift:

- evitar modelagem que colapse `null` em ausente;
- incluir testes de round-trip garantindo preservacao de `null`.

## 5.3.2 Folders no v1

- `folderId` vem no vault criptografado;
- nomes/metadados de pastas ficam em tabela `folders` (fora do vault criptografado).

Contrato v1:

- iOS v1 deve fazer leitura basica de pastas para exibir nomes;
- CRUD de pastas pode ficar para v2;
- `folderId` desconhecido nunca deve ser perdido em round-trip.

## 5.4 Politica KDF mobile

### Tabela normativa

| Key | Value |
|---|---|
| `supportedForUnlock` | `LOW`, `MEDIUM`, `HIGH`, `ULTRA` |
| `configurableOnMobile` | `LOW`, `MEDIUM`, `HIGH` |
| `defaultOnMobileSetup` | `LOW` |
| `recommendedMobileMax` | `HIGH` |

Regras:

- iOS v1 **MUST** suportar unlock de vault existente em `LOW`, `MEDIUM`, `HIGH`, `ULTRA`;
- iOS v1 **MUST NOT** permitir configurar `ULTRA` no mobile;
- iOS v1 **MUST** usar `LOW` como padrao de setup mobile;
- iOS v1 **SHOULD** expor `MEDIUM` e `HIGH` como avancado;
- iOS v1 **SHOULD** tratar `HIGH` como maximo recomendado para mobile.

### ULTRA legado (`kdf_params.level === ULTRA`)

1. mostrar aviso antes da derivacao;
2. CTA primario: `Continuar desbloqueando`;
3. CTA secundario: `Gerenciar no Web`;
4. se usuario continuar, tentar derivar normalmente;
5. se falhar por recurso, exibir erro amigavel com CTA `Gerenciar no Web`;
6. nunca fazer downgrade automatico.

Mensagem recomendada:

`Seu cofre usa o nivel ULTRA, que pode ser lento ou instavel em alguns iPhones. Recomendamos HIGH para dispositivos moveis.`

### Estados tecnicos estaveis (contrato para Swift/UI/tests)

- `unsupportedConfigurationForMobile`
- `highResourceKdfWarning`
- `kdfResourceFailure`
- `kdfInvalidParams`

## 5.5 iOS master password creation policy

Regras normativas:

- iOS v1 **MUST** usar o mesmo padrao interno de score de forca do web;
- iOS v1 **MUST** ter scorer Swift testavel para nao depender de score arbitrario vindo apenas da UI;
- iOS v1 **MUST** aceitar quando `score >= 7`;
- iOS v1 **MUST** bloquear quando `score < 7`;
- iOS v1 **SHOULD** recomendar `score >= 8`, sem bloquear score 7;
- iOS v1 **MUST** aplicar `minLength = 12` separado do score;
- iOS v1 **MUST NOT** exigir regras arbitrarias de composicao se score+comprimento passarem;
- iOS v1 **MUST** exigir confirmacao identica da senha-mestra;
- iOS v1 **MUST** oferecer toggle de mostrar/ocultar senha e aviso de nao recuperacao no setup/alteracao de senha-mestra;
- campos de senha **MUST** ser seguros, sem autocorrect/autocapitalization.

Mensagem orientativa obrigatoria para `score < 7`:

`Use uma frase longa e unica, facil de lembrar e dificil de adivinhar.`

Implementacao core:

- `WebCompatibleMasterPasswordScorer` porta o algoritmo base do web para Swift;
- `MasterPasswordPolicy` pode receber score externo apenas para testes/casos controlados, mas o fluxo de produto deve usar o scorer interno;
- senha errada no unlock deve gerar erro especifico (`invalidMasterPassword`), nao `keyRotationDetected`.

## 5.6 Gerador de senha segura (paridade web)

Requisitos obrigatorios:

- fonte de entropia em runtime Apple: `SecRandomCopyBytes`;
- o pacote core pode ter fallback cross-platform apenas para manter testes/CI fora de Apple platforms;
- indices aleatorios devem usar rejection sampling, nunca modulo simples (`random % upperBound`);
- paridade de opcoes com web:
  - comprimento `8..128`,
  - incluir maiusculas/minusculas/numeros/simbolos,
  - opcao de evitar ambiguos,
  - exigir pelo menos um caractere de cada categoria selecionada;
- nao logar senha gerada;
- ao copiar para clipboard, respeitar timeout do usuario e preferir `localOnly`.

Fora do escopo v1:

- gerador de passphrase (diceware);
- analise de forca tipo zxcvbn no app.

## Criterios de aceite testaveis

Cobertura minima obrigatoria:

- unit: `ULTRA` nao aparece em opcoes configuraveis;
- unit: unlock aceita `ULTRA`;
- UI: aviso + CTA `Gerenciar no Web` para `ULTRA`;
- unit/integration: nao existe caminho de downgrade automatico;
- unit: bloqueio para `score < 7`;
- unit: aceitacao para `score >= 7` com `minLength >= 12`;
- UI: mensagem orientativa exibida para `score < 7` com tom nao alarmista;
- UI: recomendacao de `score 8+` visivel, bloqueio apenas `< 7`;
- unit/integration: preservacao de `null` em round-trip;
- integration: conflito `409` em escrita dispara refresh/retry.

## Gate final para encerrar E5 oficialmente

Este gate depende de macOS/Xcode e fica agendado para quando alugarmos um Mac na nuvem:

1. rodar `swift test` em `ios/SafeBoxCore` no macOS;
2. rodar `xcodegen generate` em `ios/SafeBoxApp`;
3. abrir `SafeBox.xcodeproj` no Xcode;
4. configurar signing com Team ID real;
5. configurar ambiente real/staging em `SafeBoxAppEnvironment.production(...)`;
6. executar build do app shell no simulator;
7. executar smoke test manual: login -> unlock -> load vault -> lock -> sign out;
8. usar uma conta real ja confirmada, com vault pequeno e KDF `LOW`, para validar primeiro o caminho feliz sem ruido de performance;
9. repetir smoke test com vault `HIGH` antes de TestFlight;
10. testar `ULTRA` apenas como compatibilidade legado, com aviso e CTA `Gerenciar no Web`.

Resultado esperado:

- app compila no Xcode;
- telas SwiftUI carregam sem crash;
- login chama adapter configurado;
- unlock usa `VaultUnlockService`;
- load vault usa `VaultSyncService`;
- lock e sign out limpam estado sensivel;
- nenhum erro de entitlement/Privacy Manifest bloqueia build local.

QA manual em device real (baseline a medir nesta fase):

- Record measured unlock derivation time and peak memory for LOW/MEDIUM/HIGH on at least one Face ID device and one lower-memory/Touch ID device.
- Do not define hard pass/fail thresholds until after the first device baseline.
- If HIGH is visibly slow or unstable on lower-memory devices, revisit default/options before TestFlight.
