# Staging conectado: evidencia de execucao

Data: 2026-10-24. Projeto exclusivo `xxynxmktvonnldokhyem` (SafeBox Staging).
Nenhuma consulta SQL ou teste ofensivo foi direcionado a producao.

Fluxo Swift real de login/unlock/sync/refresh/logout e roundtrip WebCrypto
executado depois desta etapa: ver `native-flow-validation.md`, incluindo
incompatibilidade KDF encontrada/corrigida e limites da execucao Windows.

## Provisionamento executado

- Confirmado projeto vazio pelo CLI autenticado, antes de qualquer DDL.
- Vinculo isolado em `.staging-work`; vinculo original de producao preservado.
- Bootstrap atomico: `database-fixed.sql`, colunas crypto/tipos, compatibilidade,
  migrations 001-014, revogacao final de anon/PUBLIC e validacao de constraints.
- Migration 015 aplicada apos Advisor encontrar search_path mutavel em tres
  helpers e permissao authenticated para rls_auto_enable().
- 11 tabelas publicas, todas com RLS habilitado e forcado.
- Zero constraints pendentes de validacao; zero usuarios de teste restantes.
- Security Advisor apos correcao: `No issues found` (na consulta executada).
- A primeira consulta tambem sinalizou leaked-password protection no Auth.
  Essa configuracao nao foi alterada aqui e deve ser revalidada no painel;
  o retorno posterior sem avisos nao comprova que ela tenha sido habilitada.

O bootstrap recusa banco com tabelas publicas ou usuarios. Nao usar reset ou
executar de novo para reaplicar migrations em ambiente ja populado.

## Testes reais, nao mocks de banco/autenticacao

| Suite | Evidencia |
|---|---|
| Banco/REST Supabase | 11 testes passaram: leitura/update/delete/insert entre usuarios, referencias cross-tenant, mass assignment, escrita auxiliar, unicidade de vault, payloads, campos estendidos e RPCs internas |
| Express local + Supabase real | 6 testes passaram: health com banco real, token ausente/invalido, criar/ler snapshot com isolamento, campos extras/hash invalido, update versionado/409, backup/restore entre usuarios |

Regressao local: 93 testes do backend passaram; as 17 verificacoes conectadas
sao ignoradas por padrao e foram executadas separadamente nos comandos acima.
Type-check, lint, build da API e gate estatico iOS passaram.

Foram criados usuarios sinteticos temporarios via Auth Admin e removidos ao
terminar. Nenhum usuario real, senha real, cofre real ou payload destrutivo.
A suite HTTP usa ciphertext opaco sintetico; nao e um teste end-to-end de
descriptografia do app iOS, MFA, passkeys ou resistencia a AiTM.

## Configuracao local

- `ios/SafeBoxApp/Config/Local.xcconfig`: URL/chave publica de staging.
- `backend/.env.staging.local`: chaves do projeto staging e segredos gerados
  localmente. Ignorado pelo Git; nunca imprimir ou anexar.
- Emails, jobs e limpeza automatica desabilitados. Redis nao configurado; o
  runner impede herdar REDIS_URL/DATABASE_URL do backend de producao.
- Servidor local: `node scripts/staging/run.mjs serve` (127.0.0.1:3101).
- Testes: `node scripts/staging/run.mjs test-db` e `test-api`.
- Provisionamento inicial: `node scripts/staging/bootstrap.mjs --apply`;
  so para este projeto, vazio. Configuracao via CLI: `configure.mjs` (uma vez).

## Pendencias externas e gates de release

Backend HTTPS publicado e validado em 2026-10-24:

- URL: https://safebox-backend-staging.vercel.app
- Projeto: `safebox-backend-staging`, ID `prj_6CPyc13CuBaCG7S28jWTubBksCem`.
- Time: `pxt77s-projects`; autenticacao oficial do CLI concluida pelo usuario.
- Deploy validado: `dpl_7wokRZJRuqYcjXFgCGZJuA6WvNn8`, estado READY.
- Commit do backend: `1610f5f7`, Node 22, Express, funcao em sfo1.
- Snapshot apenas de `HEAD:backend`, com package-lock proprio. Nenhum env local
  enviado; `.vercelignore` exclui envs/logs/dependencias locais.
- Variaveis somente do staging, cadastradas como secrets via stdin, sem
  valores em argumentos, historico, chat ou logs. Jobs/email permanecem desligados.
- O target Vercel `production` significa o alias estavel DESTE projeto de
  staging. Nao significa o app/banco de producao. Nenhum dos dois foi alterado.
- A URL estavel responde diretamente, sem precisar de bypass de protecao no app.
  Nenhum token da Vercel foi incorporado ao iOS.

O primeiro deploy ficou READY mas falhou em runtime (`Cannot find module
'@/config/environment'`). Imports do backend foram convertidos mecanicamente
para relativos; nenhuma regra de autenticacao/RLS/criptografia foi relaxada.
O segundo deploy passou no health e na suite real HTTPS, sem mocks:

| Verificacao HTTPS | Resultado observado |
|---|---|
| GET /health | 200, healthy, database=true |
| Headers | HSTS max-age=31536000, nosniff, X-Frame-Options DENY |
| Token ausente / invalido | 401 / 403 |
| Criar e ler snapshot opaco sintetico | 201 / 200, versao 1 |
| Outro usuario lendo cofre | 200 com data=null, sem dados alheios |
| Campo userId extra / hash adulterado | 400 / 400 |
| Update esperado / retry com versao antiga | 200 versao 2 / 409 |
| Backup / restore por outro usuario | 201 / 404 |

Comando: `node scripts/staging/run.mjs test-api-https`.
Seis testes passaram em 12.1s, com criacao e remocao de duas contas sinteticas.
Regressao apos a correcao: 93 testes locais passaram (17 conectados ignorados
por padrao), type-check, build:api e lint passaram.

`ios/SafeBoxApp/Config/Local.xcconfig` foi atualizado localmente (ignorado no
Git) com `SAFEBOX_BACKEND_URL = https:/$()/safebox-backend-staging.vercel.app`.
ATS continua habilitado. Em outro Mac, preencher essa mesma configuracao local;
nao levar service_role ao app. Esta entrega valida API HTTPS, nao uma execucao
do fluxo nativo em iPhone: login/refresh/logout/crypto UI ainda exigem teste Apple.

Publicacao reproduzivel: `scripts/staging/deploy.mjs prepare|refresh|env|deploy`.
Os modos env/deploy recebem como terceiro argumento o entrypoint `dist/vc.js`
do CLI oficial instalado (versao usada: 65.2.0). O script confere projeto,
time e Supabase exatos, e exige backend commitado antes de preparar snapshot.
Nao conectar automaticamente o projeto de staging ao main de producao.

Redis segue `not_configured`: rate limit em memoria nao e distribuido e nao
deve ser apresentado como protecao contra carga entre instancias serverless.
Redis distribuido/rate limit real, MFA no issuer/backend/RLS, AutoFill funcional,
testes em iPhone fisico e assinatura TestFlight continuam pendentes. Um Advisor
sem avisos e suites aprovadas nao garantem ausencia de vulnerabilidades.
