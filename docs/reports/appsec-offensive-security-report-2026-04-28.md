# SafeBox Offensive AppSec Security Report

Data: 2026-04-28  
Escopo executado nesta sessao: backend local com Express real, dependencias externas mockadas e Supabase staging autorizado.  
Escopo preparado para execucao manual: web e iOS via Burp Suite contra local ou staging autorizado.

## Resumo Executivo

Foi criada e executada uma bateria ofensiva controlada para validar que o frontend web e o app iOS nao sao camadas confiaveis. Os testes simulam adulteracoes tipicas feitas em Burp Suite: remover token, trocar token, tentar IDOR, injetar ownership no body, fazer mass assignment, enviar payload grande, falsificar MIME, provocar erro interno e forcar rate limit.

Resultado local:

```text
npm run test:appsec
PASS src/__tests__/appsec.offensive.test.ts
Tests: 48 passed, 48 total
```

Tambem foram executados:

```text
npm --prefix backend test -- --runInBand
PASS
Test Suites: 10 passed, 1 skipped, 11 total
Tests: 87 passed, 2 skipped, 89 total
```

```text
npm --prefix backend run test:db-security-integration
PASS src/__tests__/db-security.integration.test.ts
Test Suites: 1 passed, 1 total
Tests: 9 passed, 9 total
```

```text
npm --prefix backend test -- --runInBand src/security/errors.test.ts src/security/validation.test.ts
PASS
```

```text
npm --prefix backend run type-check
PASS
```

```text
npm --prefix frontend test -- --watchAll=false --runInBand src/services/backendApi.test.ts
PASS
Tests: 3 passed, 3 total
```

```text
npm audit --omit=dev --json
0 production vulnerabilities
```

## O Que Foi Testado

| Classe de vulnerabilidade | Status nesta bateria | Evidencia |
|---|---|---|
| Broken authentication: acesso sem token | Coberto | 30 rotas sensiveis retornam `401 UNAUTHORIZED` |
| Token invalido ou expirado | Coberto | `invalid-token` e `expired-token` retornam `403 FORBIDDEN` |
| IDOR / Broken Object Level Authorization | Coberto | `userA` nao atualiza categoria de `userB` |
| Tenant/user ownership tampering | Coberto | `userId`, `ownerId`, `tenantId` sao rejeitados/ignorados |
| Mass assignment | Coberto | `role`, `isAdmin`, `status`, `emailVerified` rejeitados |
| Campos extras em rotas criticas | Coberto | Zod `.strict()` em objetos top-level e aninhados |
| JSON malformado | Coberto | `400 BAD_REQUEST` sem stack/path |
| Payload grande | Coberto | `413 PAYLOAD_TOO_LARGE` sem vazamento |
| MIME falso / upload inexistente | Coberto parcialmente | endpoint JSON-only nao processa `image/png` como upload |
| Pagination abuse | Coberto | `limit=9999` retorna `400 VALIDATION_ERROR` |
| Falha de autorizacao por perfil | Coberto | token com aparencia de admin nao bypassa ownership |
| Admin fail-closed | Coberto | admin middleware retorna `403` enquanto RBAC nao esta configurado |
| Vazamento de erro | Coberto | sem stack trace, SQL, path local, token ou segredo |
| Rate limit em login | Coberto | `429 TOO_MANY_REQUESTS` apos limite |
| Rate limit em 2FA verify | Coberto e hardening aplicado | `429 TOO_MANY_REQUESTS` apos limite |
| RLS/Supabase real staging | Coberto em staging autorizado | Read/update/delete/insert cross-tenant bloqueados em tabelas multi-tenant |
| IDOR em relacionamento interno | Coberto e hardening aplicado | `folder_id` e `parent_id` cross-tenant rejeitados no banco |
| Mass assignment em `public.users` | Coberto e hardening aplicado | Cliente autenticado so consegue atualizar campos de perfil permitidos |
| Escrita direta em tabelas auxiliares | Coberto e hardening aplicado | `audit_logs`, `user_sessions`, `credential_backups`, `vault_backups`, `two_factor_attempts` rejeitam writes client-side |
| Regra de negocio de vault unico | Coberto e hardening aplicado | Duplicidade em `credentials.enc_blob` e `vaults.user_id` rejeitada |
| Payload/format direto no banco | Coberto e hardening aplicado | Hash invalido, titulo vazio, campo gigante e vault payload gigante rejeitados |

## Vulnerabilidades Encontradas e Tratadas

| ID | Achado | Risco | Tratamento | Evidencia |
|---|---|---|---|---|
| APPSEC-2026-04-28-01 | Respostas internas podiam incluir `details.debug` quando o backend rodava com `NODE_ENV=development`. Em staging mal configurado isso poderia expor mensagem interna. | Medio | Removida exposicao de debug em respostas client-side para erros nao expostos. Logs internos continuam no logger do servidor. | `non-exposed AppError never includes debug details in client responses` |
| APPSEC-2026-04-28-02 | O middleware aceitava qualquer esquema com token na segunda posicao do header `Authorization`, em vez de exigir `Bearer` bem formado. | Baixo/Medio | Parsing centralizado agora aceita somente `Bearer <token>` sem tokens extras. | `rejects non-Bearer authorization schemes without calling Supabase`; `rejects malformed Bearer headers with extra tokens` |
| APPSEC-2026-04-28-03 | O helper web `backendRequest` permitia que callers internos sobrescrevessem o `Authorization` calculado pela sessao Supabase. | Baixo/Medio | `Authorization` e `Content-Type` da sessao sao aplicados por ultimo e nao podem ser sobrescritos por `init.headers`. | `does not allow callers to override the Supabase Authorization header` |
| APPSEC-2026-04-28-04 | `/api/auth/2fa/verify` dependia de rate limit global, fraco para brute force de TOTP. | Medio | Adicionado rate limit dedicado para verificacao 2FA. | `rate limits repeated 2FA verification attempts` |
| APPSEC-2026-04-28-05 | Supabase staging aceitava referencias internas cross-tenant: `credentials.folder_id` e `folders.parent_id` podiam apontar para pasta de outro usuario quando o atacante controlava o body. | Alto | Aplicada `008_business_rule_hardening.sql` com triggers `ensure_credential_folder_owner` e `ensure_folder_parent_owner`. | Antes: teste `rejects user and tenant tampering inside relationships` falhou. Depois: PASS. |
| APPSEC-2026-04-28-06 | Supabase staging aceitava escrita direta client-side em tabelas auxiliares usadas pelo backend, permitindo inflar logs/sessoes/backups/tentativas 2FA. | Medio/Alto | Aplicada `009_rls_business_rule_extra_hardening.sql` revogando `INSERT/UPDATE/DELETE` de `authenticated` em `audit_logs`, `user_sessions`, backups e `two_factor_attempts`. | Antes: teste `rejects direct writes to audit, backup, session and 2FA auxiliary tables` falhou. Depois: PASS. |
| APPSEC-2026-04-28-07 | Supabase staging permitia multiplos vault snapshots ativos por usuario em `credentials` e multiplos registros em `vaults`. | Alto | Aplicadas constraints/indices unicos em `008` e `009`. | Antes: teste `enforces business rules for one active vault snapshot per user` falhou. Depois: PASS. |
| APPSEC-2026-04-28-08 | Supabase staging aceitava payload/formato invalido direto via anon key: hash invalido, titulo vazio, campos gigantes e vault payload excessivo. | Medio/Alto | Aplicadas constraints de tamanho/formato em `008` e `009`. | Antes: teste `enforces payload size and data format constraints against direct API writes` falhou. Depois: PASS. |

## Risco Residual Documentado

| ID | Residual | Motivo | Proximo tratamento recomendado |
|---|---|---|---|
| APPSEC-RESIDUAL-IOS-01 | `HTTPResponseValidator` no iOS ainda deve ser revisado para nunca propagar corpo bruto de erro HTTP vindo do backend/Supabase para UI ou telemetria. | O arquivo iOS correspondente ja estava modificado no worktree antes desta rodada; nao foi incluido no commit AppSec para nao misturar trabalho nao relacionado. | Sanitizar erros iOS para expor somente status/codigo seguro e adicionar teste Swift de resposta 4xx/5xx com corpo contendo segredo fake. |
| APPSEC-RESIDUAL-STAGING-01 | Cobertura RLS real ainda pode ser aprofundada em funcoes/RPC e views. | A suite staging cobre tabelas multi-tenant principais, mass assignment, payload, tabelas auxiliares e triggers de relacionamento, mas ainda nao cobre todas as RPCs e views. | Ampliar para RPCs privilegiadas, views com `security_invoker`, storage buckets e Edge Functions, se existirem. |
| APPSEC-RESIDUAL-SECRET-01 | A service role key foi compartilhada no chat durante a sessao. | Mesmo nao sendo commitada e estando apenas em `.env.appsec.local` ignorado pelo Git, segredo compartilhado em canal de trabalho deve ser tratado como exposto. | Rotacionar a secret key/service role no Supabase depois da rodada de testes e atualizar `.env.appsec.local`/ambientes seguros. |

## O Que Mudou no Codigo

- `backend/src/__tests__/appsec.offensive.test.ts`: nova bateria ofensiva automatizada.
- `backend/src/routes/settings.routes.ts`: objetos aninhados de settings agora rejeitam campos extras.
- `backend/src/security/errors.ts`: erros 4xx do parser HTTP sao normalizados sem vazar detalhes internos.
- `backend/src/security/errors.ts`: erros internos nao expostos nao retornam mais `details.debug` para clientes.
- `backend/src/middleware/auth.middleware.ts`: header `Authorization` precisa ser `Bearer` estrito.
- `backend/src/middleware/rateLimiting.middleware.ts`: novo rate limit dedicado para 2FA verify.
- `backend/src/routes/auth.routes.ts`: `/api/auth/2fa/verify` usa o rate limit dedicado.
- `backend/src/middleware/security.middleware.ts`: timer de limpeza usa `unref()` para nao prender Jest.
- `frontend/src/services/backendApi.ts`: chamadas web nao podem sobrescrever o token da sessao Supabase.
- `package.json` e `backend/package.json`: novo comando `test:appsec`.
- `backend/src/__tests__/db-security.integration.test.ts`: suite staging ampliada para 9 testes reais de IDOR, mass assignment, regras de negocio e payload no Supabase.
- `docs/sql/migrations/008_business_rule_hardening.sql`: aplicada no staging via `supabase db query --linked --file`.
- `docs/sql/migrations/009_rls_business_rule_extra_hardening.sql`: nova migration complementar aplicada no staging.

## Evidencia Staging Antes/Depois

Antes de aplicar o hardening SQL, a bateria staging real teve 5 passes e 4 falhas:

```text
FAIL src/__tests__/db-security.integration.test.ts
Tests: 4 failed, 5 passed, 9 total
Falhas:
- rejects user and tenant tampering inside relationships
- rejects direct writes to audit, backup, session and 2FA auxiliary tables
- enforces business rules for one active vault snapshot per user
- enforces payload size and data format constraints against direct API writes
```

Foram aplicadas as migrations no Supabase staging linkado:

```text
npx supabase db query --linked --file docs/sql/migrations/008_business_rule_hardening.sql
npx supabase db query --linked --file docs/sql/migrations/009_rls_business_rule_extra_hardening.sql
```

Depois do hardening:

```text
npm --prefix backend run test:db-security-integration
PASS src/__tests__/db-security.integration.test.ts
Tests: 9 passed, 9 total
```

Checks read-only no catalogo do Supabase tambem confirmaram:

```text
indices presentes:
- credentials_single_active_vault_per_user_idx
- vaults_single_active_per_user_idx

authenticated grants em tabelas auxiliares:
- audit_logs: SELECT
- credential_backups: SELECT
- two_factor_attempts: SELECT
- user_sessions: SELECT
- vault_backups: SELECT

authenticated UPDATE em users:
- avatar_url
- full_name
```

## Tabela Final De Evidencia

| Risco testado | Resultado esperado | Evidencia |
|---|---|---|
| Acesso cross-tenant userA lendo dados userB | Retorna lista vazia ou erro seguro | PASS: 9 tabelas multi-tenant sem vazamento |
| Update/delete cross-tenant | Nao altera linhas de userB | PASS: `credentials`, `settings`, `categories`, `folders`, `sessions`, `vaults` |
| Insert com `user_id` de outro usuario | Rejeitado por RLS/permissao | PASS: tentativas em tabelas tenant-owned rejeitadas |
| IDOR por `folder_id`/`parent_id` | Rejeitado por trigger/constraint no banco | PASS apos `008` |
| Mass assignment em `users` | Apenas `full_name`/`avatar_url` editaveis pelo cliente | PASS apos `008` |
| Escrita direta em tabelas auxiliares | Cliente autenticado nao insere/edita/deleta | PASS apos `009` |
| Duplicidade de vault ativo | Banco rejeita segundo vault ativo | PASS apos `008`/`009` |
| Payload grande/formato invalido | Banco rejeita antes de persistir | PASS apos `008`/`009` |

## O Que Podemos Afirmar Com Base Nesta Execucao

O backend demonstrou protecao contra as classes testadas na camada HTTP/API local. Em especial, as rotas sensiveis nao aceitaram confiar em valores vindos do frontend para autenticacao, ownership, tenant, perfil ou permissoes.

Esta execucao nao prova seguranca absoluta contra todas as variantes possiveis. Ela prova que os cenarios ofensivos documentados aqui estao cobertos por testes automatizados e que passaram em ambiente local controlado.

## Limites e Proximos Passos

1. Rodar o roteiro Burp em `docs/reports/appsec-offensive-test-plan-2026-04-28.md` contra staging, com usuarios reais de teste.
2. Ampliar `test:db-security-integration` para RPCs, views, storage buckets e Edge Functions.
3. Quando existir rota de upload backend, adicionar testes reais de arquivo invalido, MIME falso, tamanho excessivo e filename malicioso.
4. Ampliar testes iOS de rede para garantir que erros `401`, `403`, `409`, `413` e `429` geram UX segura e nao logs sensiveis.
