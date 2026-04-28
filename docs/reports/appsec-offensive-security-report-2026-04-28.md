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
Tests: 51 passed, 51 total
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
Tests: 11 passed, 11 total
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
| Campos estendidos de credentials | Coberto e hardening aplicado | `totp_secret`, `uris` e campos de cartao agora possuem limite no banco |
| RPC/funcoes internas | Coberto e hardening aplicado | Funcoes de trigger nao ficam expostas via RPC para `anon`/`authenticated` |
| Supabase Storage | Inventariado | 0 buckets no staging; sem superficie Storage ativa |
| Supabase Edge Functions | Inventariado | `supabase functions list` retornou `[]` |
| Views publicas | Inventariado | 0 views em `public` no staging |
| XSS sinks no frontend | Coberto por check estatico | Sem `dangerouslySetInnerHTML`, `.innerHTML =`, `eval`, `new Function` ou `document.write` em `frontend/src` |
| CSP/headers web | Hardening aplicado | `vercel.json` e `frontend/vercel.json` agora definem CSP/HSTS/frame/nosniff/referrer/permissions |
| URL beacon/tracking em campos de URL | Coberto e hardening aplicado | `website`, `uris` e `avatarUrl` rejeitam URL com imagem/script, query, fragment, credenciais, localhost ou IP privado |

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
| APPSEC-2026-04-28-09 | Funcoes internas/trigger `SECURITY DEFINER` ainda tinham `EXECUTE` para `PUBLIC`, `anon` e `authenticated`, embora nao precisem ser chamadas pelo cliente. | Medio | Aplicada `010_revoke_trigger_function_execute.sql`; catalogo passou a retornar 0 grants para essas roles. | `rejects direct RPC calls to internal trigger functions`; query de grants retornou `[]`. |
| APPSEC-2026-04-28-10 | Campos estendidos de `credentials` (`totp_secret`, `uris`, campos de cartao) nao estavam cobertos pela constraint de tamanho da migration 008. | Medio | Aplicada `011_credentials_extended_field_bounds.sql`. | `enforces bounds on extended credential, folder, category and settings fields`. |
| APPSEC-2026-04-28-11 | Deploy estatico Vercel nao tinha headers de seguranca declarados no `vercel.json` do frontend/root. | Medio | Adicionados CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`. | `npm run test:appsec:static` PASS; `sets defensive API security headers` PASS para backend. |
| APPSEC-2026-04-28-12 | Verificacao passiva da producao atual mostrou `/api/vault` retornando HTML da SPA com `200` apos redirect para `app.zksafe.pro`. | Medio | Ajustado fallback SPA da Vercel para nao reescrever `/api/*` para `index.html`. | `curl -L https://safebox.vercel.app/api/vault` mostrou HTML; `npm run test:appsec:static` agora valida exclusao de `/api/*`. |
| APPSEC-2026-04-28-13 | Campos de URL podiam aceitar valores capazes de atuar como tracking pixel/web beacon se algum fluxo futuro renderizasse imagem remota, favicon remoto ou recurso externo a partir do dado salvo. | Medio | Adicionada politica de URL limpa no frontend/backend: somente `https`, sem query/fragment, sem usuario/senha, sem localhost/IP privado e sem extensoes de imagem/script/recurso ativo. CSP tambem deixou de permitir `img-src https:` arbitrario. | `urlSafety.test.ts` frontend/backend PASS; `rejects beacon-style avatar URLs`; staging rejeita `website=https://attacker.example/pixel.png`, `uris` com query e `uris=https://127.0.0.1/admin`. |

## Risco Residual Documentado

| ID | Residual | Motivo | Proximo tratamento recomendado |
|---|---|---|---|
| APPSEC-RESIDUAL-IOS-01 | `HTTPResponseValidator` no iOS ainda deve ser revisado para nunca propagar corpo bruto de erro HTTP vindo do backend/Supabase para UI ou telemetria. | O arquivo iOS correspondente ja estava modificado no worktree antes desta rodada; nao foi incluido no commit AppSec para nao misturar trabalho nao relacionado. | Sanitizar erros iOS para expor somente status/codigo seguro e adicionar teste Swift de resposta 4xx/5xx com corpo contendo segredo fake. |
| APPSEC-RESIDUAL-STAGING-01 | Cobertura RLS real ainda pode ser aprofundada em funcoes/RPC e views. | A suite staging cobre tabelas multi-tenant principais, mass assignment, payload, tabelas auxiliares e triggers de relacionamento, mas ainda nao cobre todas as RPCs e views. | Ampliar para RPCs privilegiadas, views com `security_invoker`, storage buckets e Edge Functions, se existirem. |
| APPSEC-RESIDUAL-SECRET-01 | A service role key foi compartilhada no chat durante a sessao. | A chave nao esta no `origin/main` nem no working tree rastreado, mas `git log --all -S <secret>` encontrou um branch local antigo de backup. | Apagar manualmente o branch local `backup-pre-rewrite-20260419-1155`; a tentativa automatizada foi bloqueada pelo aprovador da sessao. Rotacao continua sendo higiene recomendada para segredo compartilhado em chat. |
| APPSEC-RESIDUAL-PROD-01 | Producao atual ainda precisa ser revalidada apos deploy do commit novo. | HEAD/GET passivo mostrou que o deploy ativo antes deste push ainda nao tinha CSP/nosniff/frame headers e reescrevia `/api/vault` para HTML. | Depois que Vercel publicar o commit, repetir HEAD `/`, GET `/robots.txt`, GET `/api/vault` sem token. |
| APPSEC-RESIDUAL-RATE-REDIS-01 | Rate limit foi testado local/mockado, mas nao com Redis real. | O ambiente local/staging desta sessao nao tem `REDIS_URL` configurado; backend `.env` usa rate limit em memoria. | Configurar Redis em staging/producao e repetir login/2FA/vault rate-limit em ambiente real. |

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
- `docs/sql/migrations/010_revoke_trigger_function_execute.sql`: revoga chamada direta de funcoes internas/trigger.
- `docs/sql/migrations/011_credentials_extended_field_bounds.sql`: adiciona limites para campos estendidos de `credentials`.
- `vercel.json` e `frontend/vercel.json`: headers de seguranca para deploy estatico.
- `scripts/appsec-static-checks.js`: check estatico de XSS sinks e headers Vercel.
- `vercel.json` e `frontend/vercel.json`: fallback SPA exclui `/api/*` para evitar resposta HTML `200` em rotas API inexistentes.
- `frontend/src/utils/urlSafety.ts`: normaliza e valida URL limpa antes de salvar/renderizar links.
- `backend/src/security/urlSafety.ts`: aplica a mesma politica em rotas backend sensiveis, como perfil/avatar.
- `docs/sql/migrations/012_clean_public_url_constraints.sql`: adiciona constraints SQL para `credentials.website`, `credentials.uris` e `users.avatar_url`.
- `docs/sql/migrations/013_grant_clean_url_constraint_functions.sql`: permite que `authenticated` execute apenas os validadores puros usados por CHECK constraints.
- `docs/sql/migrations/014_fix_private_ip_clean_url_regex.sql`: corrige bloqueio de IP privado/local completo, como `127.0.0.1`.

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
Tests: 11 passed, 11 total
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

Edge/Storage/views:
- Edge Functions: []
- Storage buckets: 0
- public views: 0

RPC/funcoes:
- grants PUBLIC/anon/authenticated em funcoes publicas: 0 linhas apos 010

Constraints de campos:
- credentials_extended_field_size_check presente
- credentials_website_clean_url_check presente
- credentials_uris_clean_url_check presente
- users_avatar_url_clean_url_check presente
- credentials_field_size_check presente
- credentials_enc_blob_size_check presente
- credentials_data_hash_format_check presente
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
| Campos estendidos de credentials | Banco rejeita abuso em TOTP/URI/cartao | PASS apos `011` |
| URL beacon/tracking em campos de URL | Banco/app rejeitam URL suja antes de persistir/renderizar | PASS apos `012`/`013`/`014` |
| RPC/funcoes internas | Cliente nao consegue chamar triggers/RPC internas | PASS apos `010` |
| Edge Functions | Nenhuma function exposta | `supabase functions list` retornou `[]` |
| Storage buckets | Nenhum bucket exposto | `storage.buckets` retornou 0 linhas |
| CSP/headers web | Deploy config declara headers defensivos | `npm run test:appsec:static` PASS |
| Backup/restore/export | Ownership vem do token e body adulterado falha | `scopes backup, restore and export flows to the authenticated user` |
| API fallback no deploy estatico | `/api/*` nao deve voltar HTML da SPA | config Vercel alterada para excluir `/api/*`; revalidar apos deploy |

## Execucoes Complementares

```text
npm run test:appsec
PASS
Tests: 51 passed, 51 total
```

```text
npm run test:appsec:static
PASS
```

```text
npm --prefix frontend test -- --watchAll=false --runInBand src/services/backendApi.test.ts src/services/importExportUtils.test.ts src/components/TwoFactorVerification.test.tsx
PASS
Tests: 9 passed, 9 total
```

```text
npm --prefix backend test -- --runInBand
PASS
Tests: 89 passed, 11 skipped, 100 total
```

```text
npm --prefix backend run type-check
PASS
```

```text
npm --prefix backend run build
PASS
```

```text
npm --prefix frontend run build
PASS
```

```text
npm audit --omit=dev --json
0 production vulnerabilities
```

```text
npm --prefix backend audit --omit=dev --json
0 production vulnerabilities
```

```text
npm --prefix frontend audit --omit=dev --json
0 production vulnerabilities
```

## Verificacao Passiva De Producao

Executada em 2026-04-28, sem login, sem fuzzing e sem carga:

```text
curl -I -L https://safebox.vercel.app
```

Resultado: `safebox.vercel.app` redireciona `307` para `https://app.zksafe.pro/`. O destino respondeu `200` com HSTS, mas sem CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` visiveis no deploy ativo naquele momento.

```text
curl -L https://safebox.vercel.app/robots.txt
```

Resultado:

```text
User-agent: *
Disallow:
```

```text
curl -i -L https://safebox.vercel.app/api/vault
```

Resultado: `200 text/html` com HTML da SPA no deploy ativo antes deste push. Tratamento aplicado nesta rodada: excluir `/api/*` do fallback SPA no `vercel.json` para o proximo deploy nao mascarar API ausente como HTML `200`.

## O Que Podemos Afirmar Com Base Nesta Execucao

O backend demonstrou protecao contra as classes testadas na camada HTTP/API local. Em especial, as rotas sensiveis nao aceitaram confiar em valores vindos do frontend para autenticacao, ownership, tenant, perfil ou permissoes.

Esta execucao nao prova seguranca absoluta contra todas as variantes possiveis. Ela prova que os cenarios ofensivos documentados aqui estao cobertos por testes automatizados e que passaram em ambiente local controlado.

## Limites e Proximos Passos

1. Rodar o roteiro Burp em `docs/reports/appsec-offensive-test-plan-2026-04-28.md` contra staging, com usuarios reais de teste.
2. Repetir verificacao passiva online de producao quando houver aprovacao de rede.
3. Quando existir rota de upload backend, adicionar testes reais de arquivo invalido, MIME falso, tamanho excessivo e filename malicioso.
4. Ampliar testes iOS de rede para garantir que erros `401`, `403`, `409`, `413` e `429` geram UX segura e nao logs sensiveis.
5. Configurar Redis real em staging/producao e repetir rate-limit distribuido.
