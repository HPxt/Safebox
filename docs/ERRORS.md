# SafeBox Error Log

Este arquivo e o primeiro lugar a consultar antes de corrigir qualquer bug no SafeBox.
Quando um erro for resolvido, registre aqui a causa, a correcao e as validacoes usadas.

## 2026-10-24 - Swift nao desbloqueia perfil KDF legado sem level

Teste real conectado autenticou no Supabase staging, mas falhou ao ler
`users.kdf_params`: `Key 'level' not found`. O contrato da web/backend nao
exige esse rotulo. O decoder Swift agora reconhece apenas o tuple exato
Argon2id/65536 KiB/3 iteracoes/4 lanes/32 bytes sem label como LOW.
Nenhum parametro criptografico e alterado; perfis desconhecidos continuam
rejeitados. Cobertura: quatro testes de compatibilidade, 78 testes do core
(1 ignorado), 12 de sessao/config e fluxo conectado Swift/WebCrypto aprovado.
Ver `docs/ios/native-flow-validation.md`. Nenhuma alteracao em producao.

## 2026-10-24 - Backend Vercel READY com FUNCTION_INVOCATION_FAILED

Primeiro deploy no projeto exclusivo de staging compilou, mas `/health`
retornou 500. Logs mostraram `Cannot find module '@/config/environment'`:
TypeScript preserva aliases em CommonJS; compilacao nao garante resolucao no
Node de producao. Imports estaticos dos modulos de runtime foram convertidos
mecanicamente para caminhos relativos, sem mudar regras de seguranca.

Validacao: type-check, build:api, lint, 93 testes locais, republicacao Node 22 e
seis testes via HTTPS real passaram. `/health` retornou 200 com banco saudavel.
Evidencias e ID do deploy em `docs/ios/staging-connected-validation.md`.
Nenhuma alteracao no banco/app de producao; so o projeto backend de staging.

## Regra operacional

1. Quando o usuario enviar um erro novo, a primeira acao e ler/pesquisar este arquivo antes de propor ou aplicar correcao.
2. Antes de investigar um bug, procurar neste arquivo por:
   - mensagem exata do erro;
   - tela/fluxo afetado;
   - arquivos citados em correcoes anteriores;
   - decisoes de seguranca relacionadas.
3. Depois de corrigir um bug, adicionar uma entrada nova com:
   - data;
   - sintoma;
   - causa raiz;
   - arquivos alterados;
   - validacoes executadas;
   - riscos ou pendencias restantes.
4. Nao reabrir fallback inseguro sem registrar explicitamente o motivo e o limite da excecao.

## 2026-10-24 - Validacao conectada do staging

API integrada encontrava `Unexpected token export` ao importar uuid (ESM) pelo
Jest CommonJS. AuthService ja importava crypto; a geracao UUID v4 de sessao
passou a usar `crypto.randomUUID()` nativo, sem alterar formato/entropia e sem
mockar autenticacao ou banco. O staging recebeu as migrations 001-015; a 015
fixa search_path dos helpers de URL e revoga acesso a rls_auto_enable().
Credenciais de staging ficam somente em arquivos locais ignorados. Validacoes
e riscos restantes constam no relatorio conectado de staging.

## 2026-10-24 - Build iOS: covariant Self no inicializador

Instalacao no simulador: a extensao tambem precisava de `CFBundleDisplayName`
nao vazio. Debug/Release compilavam, mas o instalador recusava o bundle.
Adicionado `SafeBox AutoFill` ao Info.plist da extensao. O gate inclui teste
no simulador precisamente para detectar erros de empacotamento deste tipo.

Outros erros encontrados no gate Apple: `generic parameter T could not be
inferred` em CredentialIdentityDonationService e overload invalido de
`Section("Senha") { ... } footer:` em VaultItemFormView. Correcoes: continuation
explicitamente `CheckedContinuation<Void, Error>` e header/footer explicitos
no Section. Sem alteracao de verificacao biometrica nem de criptografia.

Sintoma: CI macOS rejeitou `Self.vaultInactivityTimeout` no inicializador de
propriedade armazenada de AppCoordinator. Causa: referencia ao Self covariante
na inicializacao de propriedade de classe. Correcao: nome concreto
`AppCoordinator.vaultInactivityTimeout`, preservando o timeout de bloqueio.
Validacao: gate estatico local e nova execucao do workflow iOS; consultar o PR
para resultado Apple. Parse de sintaxe sozinho nao detecta este erro de tipos.

## 2026-07-04 - `Erro ao salvar credencial: Resposta invalida do backend`

**Sintoma:** ao editar uma credencial no dashboard, o frontend mostrava `Erro ao salvar credencial: Resposta invalida do backend`.

**Causa raiz:** `credentialsService.updateCredential()` grava o snapshot do cofre via `backendRequest('/vault')`. Em deploy estatico ou ambiente sem `REACT_APP_BACKEND_URL`, `/api/vault` pode nao apontar para o backend Express e retornar HTML/404 em vez do envelope JSON esperado. A leitura ja tinha fallback direto para Supabase, mas a escrita nao tinha fallback equivalente.

**Correcao:** `frontend/src/services/credentialsService.ts` agora:

- guarda `id`, `version` e `storageMode` do vault carregado;
- tenta salvar pelo backend primeiro;
- se o backend estiver indisponivel ou responder conteudo invalido, salva diretamente no Supabase com cliente autenticado;
- preserva controle otimista de versao usando `eq('version', currentVaultVersion)`;
- converte ausencia de linha atualizada em conflito de versao amigavel.

**Arquivos alterados:**

- `frontend/src/services/credentialsService.ts`
- `docs/ERRORS.md`
- `docs/HANDOFF-BASE.md`

**Validacoes:**

```text
npm test -- --watchAll=false --runInBand src/services/backendApi.test.ts
npm run build
```

**Observacao de seguranca:** o fallback usa apenas a sessao Supabase do usuario e RLS. Nao usa `service_role`, nao grava dados de outro usuario e nao remove o caminho preferencial via backend.
