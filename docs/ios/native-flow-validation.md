# Validacao conectada do fluxo Swift

Data: 2026-10-24. Execucao real em Windows, Swift 6.3.1, contra o Supabase
`xxynxmktvonnldokhyem` e https://safebox-backend-staging.vercel.app .
Nenhum teste ou alteracao em producao. Nao e teste de interface iOS.

## Metodo e isolamento

`ios/Package.swift` compila os proprios arquivos de transporte, composicao e
configuracao usados pelo host iOS, dependentes do mesmo SafeBoxCore. Nao e uma
reimplementacao JavaScript do adapter nem um mock de rede. FoundationNetworking
so e importado nas plataformas que precisam dele; iOS mantem Foundation.

O runner cria duas contas ficticias com senhas aleatorias e email confirmado.
Prepara o perfil KDF pelo endpoint autenticado de usuario, no formato usado
pela web (sem level), usando o vetor publico de interoperabilidade do repo.
A senha-mestra do vetor e usada apenas localmente para Argon2; nao e enviada
ao backend nem ao Supabase. O servidor recebe salt, parametros e hash.

Service-role e usada apenas no processo Node para criar/remover as contas;
nao e entregue ao processo Swift nem ao app. A fixture temporaria fica em
`.staging-work` ignorado, sem credenciais em argumentos ou logs. A ultima
execucao confirmou remocao de 2/2 contas e do arquivo temporario.

## Falha encontrada e corrigida

A primeira execucao confirmou login nativo, mas falhou ao decodificar
`users.kdf_params`: `Key 'level' not found`. A web e o contrato do backend
aceitam perfis sem esse rotulo, enquanto Swift o exigia.

O decoder agora reconhece SOMENTE o perfil legado exato sem rotulo:
Argon2id, memoria 65536 KiB, iteracoes 3, paralelismo 4, chave 32 bytes.
Atribuir LOW neste caso nao muda nenhum parametro nem regrava o banco.
Perfis desconhecidos sem level e level explicitamente null continuam
rejeitados. Labels explicitos continuam preservados. Quatro testes de
regressao cobrem a compatibilidade e a rejeicao, sem reduzir custo de KDF.

## Evidencias

| Etapa | Resultado observado |
|---|---|
| Senha de login incorreta | Rejeitada; nenhum token local disponivel |
| Login Supabase pelo adapter Swift | Sessao real estabelecida |
| Perfil KDF via REST e senha-mestra errada | Perfil legado lido; senha errada rejeitada localmente |
| Senha-mestra correta | Argon2 real, chave local de 32 bytes |
| Criar/ler snapshot via HTTPS | AES-GCM nativo, versao 1, descriptografia local correta |
| Fallback de leitura REST | Mesmo snapshot decifrado pelo adapter direto |
| Conta B via API e REST | Nenhum cofre da conta A retornado |
| Update e versao antiga | Versao 2; retry antigo mapeado para versionConflict/409 |
| Expiracao local simulada | Relogio injetado avanca; adapter faz refresh REAL no Supabase; leitura funciona |
| Logout | Requisicao real; estado/token locais limpos e leitura pelo adapter bloqueada |
| Novo login + unlock | Snapshot versao 2 reaberto sem perda dos dados sinteticos |
| Swift para WebCrypto | Node WebCrypto decifrou o ciphertext nativo e conferiu o conteudo |
| WebCrypto para Swift | Node gravou versao 3 cifrada; composicao real SafeBoxAppEnvironment leu e decifrou |

Execucao final: dois casos conectados aprovados, em invocacoes separadas
(8.15s e 2.09s), alem da verificacao WebCrypto intermediaria. O segundo caso
e ignorado na primeira invocacao, pois exige a escrita WebCrypto posterior;
foi executado e aprovado explicitamente na segunda invocacao.

Regressao Windows: core executou 78 testes, 1 ignorado opt-in, 0 falhas;
12 testes de sessao/configuracao do host passaram. Estes 12 usam stubs de
HTTP para cenarios de corrida/erros e NAO sao os casos reais conectados acima.
Gate estatico iOS passou. Confirmacao Apple do commit `7a793d09`:
[iOS Security and Build, run 40108858230](https://github.com/HPxt/Safebox/actions/runs/40108858230)
terminou com success. Core: 78 testes, 1 ignorado, 0 falhas. Pacote de adapters:
12 testes unitarios passaram, 2 conectados ignorados deliberadamente (CI sem
credenciais). Builds unsigned Debug e Release do app/extensao passaram.
Simulador iOS: 12 testes do host passaram, `TEST SUCCEEDED`; xcresult publicado
como artifact. Quality Gate e workflow de preview Vercel tambem passaram.
Estes testes de simulador nao acessam staging e nao sao testes de UI/Face ID.

## Reproduzir

Com Swift instalado e o env local de staging ja configurado:

```powershell
node scripts/staging/test-native.mjs
swift test --package-path ios/SafeBoxCore
swift test --package-path ios --configuration release
node scripts/ios-static-gate.mjs
```

Sem SAFEBOX_STAGING_FIXTURE os dois casos conectados sao ignorados, e o
comando Swift sozinho NAO cria usuarios. Use o runner para teste conectado e
limpeza. Se o processo inteiro/computador for encerrado a forca, a limpeza
finally pode nao executar: conferir e remover apenas as contas sinteticas
native-a/native-b daquele teste no Auth de staging antes de repetir.

## Limites e proximo gate

- Windows nao executa SwiftUI, Face ID, Keychain Apple nem o simulador iOS.
  Isto valida o codigo compartilhado real, nao esses comportamentos Apple.
- Nao foi necessario esperar o JWT expirar no emissor: o teste avancou apenas
  o relogio local do session store. O intercambio de refresh foi real, mas
  nao e prova de resistencia a replay ou de revogacao imediata de access JWT.
- Node WebCrypto nao e o navegador/Safari nem a UI web completa.
- Logout pode deixar access tokens previamente emitidos validos ate expirar;
  o teste nao afirma bloqueio imediato do bearer em outra maquina.
- O iPhone do usuario acessa so a versao web; nenhuma build nativa esta instalada.
  Para testar o app nele e preciso uma build assinada. CI/simulador nao substitui
  assinatura, capabilities, teste fisico nem App Store Connect.
- Antes de TestFlight: resolver MFA issuer/backend/RLS e AutoFill, configurar
  assinatura Apple e executar login/unlock/CRUD/refresh/logout, background,
  Face ID e rede intermitente no aparelho com dados ficticios de staging.
- Redis distribuido segue pendente. Nenhuma garantia de ausencia de falhas.
