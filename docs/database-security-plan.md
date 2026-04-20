# Plano de segurança do banco (SafeBox)

Este documento consolida a estratégia de endurecimento do Postgres/Supabase: reduzir `service_role`, tornar o RLS a barreira real e isolar backups e auditoria.

## Três níveis de acesso

| Nível | Uso | Cliente |
|--------|-----|---------|
| **User-scoped** | CRUD de dados do tenant (padrão) | `createSupabaseUserClient(accessToken)` — anon key + JWT do utilizador |
| **Privileged (service_role)** | Auditoria privilegiada, jobs de manutenção, legado sem JWT Supabase | `getPrivilegedSupabase()` e helpers em [`backend/src/config/privilegedDb.ts`](../backend/src/config/privilegedDb.ts) |
| **Migration / admin** | Migrações SQL, DDL, correções pontuais | SQL Editor Supabase / `supabase db` — fora do runtime da API |

## O que foi alterado no backend (código)

- **Cliente privilegiado centralizado**: [`backend/src/config/privilegedDb.ts`](../backend/src/config/privilegedDb.ts) — RPC de auditoria, RPC de último login, operações de `user_sessions` no caminho legado, jobs de manutenção.
- **`database.ts`**: `supabase` / `supabaseAdmin` passam a ser o mesmo singleton privilegiado (marcados como deprecated em favor de `getPrivilegedSupabase()` ou cliente user-scoped).
- **`auth.service.ts`**: quando existe `session.access_token` do Supabase (login/registo), inserts em `user_sessions` e limite de sessões usam **cliente com JWT**; caso contrário, usam helpers privilegiados. `logoutAllSessions` aceita token opcional da rota.
- **`logger.ts`**: persistência em `audit_logs` com `ENABLE_AUDIT_LOGS=true` usa **`log_audit_event` via RPC privilegiada** (alinhado a `logPrivilegedAuditEvent`), com `userId` obrigatório para escrita em BD.
- **`VaultService` legada**: deixou de exportar singleton; continua classe deprecated usando apenas cliente privilegiado se alguém instanciar — a API pública usa `VaultSnapshotService` com RLS.

## Migrações SQL (aplicar no Supabase)

Scripts em [`docs/sql/migrations/README.md`](sql/migrations/README.md), **nesta ordem**, após inventário em [`docs/sql/db-security-inventory.sql`](sql/db-security-inventory.sql):

1. **`001_grants_minimal.sql`** — `REVOKE` de privilégios perigosos em **todas** as tabelas `public`; em seguida **`GRANT` explícito por tabela** (sem `GRANT … ON ALL TABLES` para CRUD). `audit_logs`: só **`SELECT`** para `authenticated` (sem INSERT direto).
2. **`002_rls_core_users.sql`** — `users` UPDATE com `WITH CHECK`.
3. **`003_rls_audit_backups_sessions.sql`** — `ENABLE ROW LEVEL SECURITY` + **`FORCE ROW LEVEL SECURITY`** (via `DO` + `to_regclass`); policies. **`audit_logs`**: apenas **`SELECT`** do próprio utilizador — **nenhuma** policy de INSERT para `authenticated` (escrita só via backend com `service_role` / RPC `log_audit_event`).
4. **`004_two_factor_attempts.sql`** — tabela + RLS + `FORCE` + grants.
5. **`005_functions_hardening.sql`** — bloco **`DO $$ … $$`**: percorre `pg_proc` por nome, aplica `ALTER FUNCTION … SET search_path` e `REVOKE` onde aplicável (sem depender de `ALTER FUNCTION IF EXISTS`).
6. **`006_views_security_invoker.sql`** — `security_invoker` em views (Postgres 15+).

**Pós-migração (obrigatório):** executar [`docs/sql/post-checks.sql`](sql/post-checks.sql) e guardar resultados no relatório da fase 1 / release checklist.

**Validação**: staging primeiro; inventário antes **e** `post-checks` depois.

## Princípios operacionais

- **RLS obrigatório** para dados por utilizador; política preferida: `auth.uid() = user_id`.
- **Backups** (`vault_backups`, `credential_backups`) com o mesmo rigor de isolamento que o cofre.
- **Auditoria**: mínimo de campos; sem tokens, seeds 2FA ou payloads brutos — usar redaction no backend ([`backend/src/security/redaction.ts`](../backend/src/security/redaction.ts)). No Postgres, **`authenticated` não insere** linhas em `audit_logs` diretamente; o backend usa **`log_audit_event`** com chave **service_role** (bypass RLS).
- **SECURITY DEFINER**: validar contexto, `search_path` fixo, sem IDs arbitrários sem checagem; preferir `REVOKE EXECUTE` a `authenticated` para funções administrativas.

## Relatórios por fase

- Fase 1 (inventário): preencher com resultados de `db-security-inventory.sql` → [`docs/reports/db-security-phase-01.md`](reports/db-security-phase-01.md) (template).
- Fase 2 (código / service_role): [`docs/reports/db-security-phase-02.md`](reports/db-security-phase-02.md).

## Riscos residuais

- **Auth legada (JWT próprio)**: verificação de sessão e refresh continuam a usar leitura/escrita privilegiada em `user_sessions` quando não há access token Supabase no pedido.
- **`005_functions_hardening.sql`**: só altera funções cujo `proname` está na lista **no schema `public`**. Funções noutros schemas (ex.: triggers em `auth`) não são tocadas — alinhar com o inventário se existirem cópias em `public`.
- **`update_user_last_login` / `log_audit_event`**: após `REVOKE` para `authenticated`, apenas o cliente **service_role** do backend deve chamá-los (comportamento desejado).
- **`001` por tabela**: se existirem tabelas `public` adicionais usadas pelo cliente com JWT, é preciso acrescentá-las explicitamente ao bloco `DO` (evita reabrir com `ALL TABLES`).

## Testes

- `cd backend && npm run type-check && npm test`
- **Integração multi-tenant (staging):** `RUN_DB_SECURITY_INTEGRATION=1` + `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_REFRESH_TOKEN_USER_A`, `SUPABASE_REFRESH_TOKEN_USER_B` → `npm run test:db-security-integration` (ver [`backend/src/__tests__/db-security.integration.test.ts`](../backend/src/__tests__/db-security.integration.test.ts)).
