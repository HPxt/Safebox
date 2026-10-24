# Staging conectado: evidencia de execucao

Data: 2026-10-24. Projeto exclusivo `xxynxmktvonnldokhyem` (SafeBox Staging).
Nenhuma consulta SQL ou teste ofensivo foi direcionado a producao.

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

A conexao Vercel atual nao tem acesso ao time `pxt77s-projects` (403). Tentativas
de gerar o link de autorizacao por ID/slug retornaram 404 Team not found.
Nenhum projeto ou deploy de producao foi alterado. Publicacao do backend
staging HTTPS requer conexao autorizada para o time correto.

O backend tem default export Express e config Vercel dedicada em `backend/`.
Em Vercel o logger usa console, evitando filesystem somente leitura; em hosts
tradicionais o transporte de arquivos permanece. O deploy ainda nao foi testado.

Criar projeto Vercel separado, rootDirectory=backend, framework=express,
ambiente ligado somente ao novo Supabase. Configurar variaveis como sensitive,
nao copiar env de producao. Validar health/auth/CRUD no endpoint HTTPS antes de
substituir `staging-backend.invalid` no xcconfig. Nao desabilitar ATS.

Redis distribuido/rate limit real, MFA no issuer/backend/RLS, AutoFill funcional,
testes em iPhone fisico e assinatura TestFlight continuam pendentes. Um Advisor
sem avisos e suites aprovadas nao garantem ausencia de vulnerabilidades.
