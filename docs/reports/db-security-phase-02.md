# Relatório — Fase 2: Redução e isolamento de `service_role` (backend)

## 1. Problema

O backend usava `supabase` / `supabaseAdmin` com **service_role** de forma dispersa (`auth.service`, `logger`, `audit`, `maintenance`, `VaultService` legada), contornando o RLS e diluindo a auditoria de uso privilegiado.

## 2. Ameaça

Compromisso da API ou bug num endpoint poderia expor ou alterar dados de outro tenant sem barreira no Postgres; auditoria inconsistente (insert direto vs RPC).

## 3. Mudança necessária

- Centralizar operações privilegiadas num módulo único e auditável.
- Usar cliente **user-scoped** sempre que existir JWT Supabase (login/registo, rotas com `authenticateSupabaseAccessToken`).
- Unificar persistência de `audit_logs` via RPC `log_audit_event` (caminho já usado por `logPrivilegedAuditEvent`).

## 4. Alteração aplicada

- Novo [`backend/src/config/privilegedDb.ts`](../../backend/src/config/privilegedDb.ts): `getPrivilegedSupabase`, `privilegedRpcLogAuditEvent`, `privilegedRpcUpdateUserLastLogin`, `privilegedMaintenanceRpc`, helpers de `user_sessions` para o fluxo legado.
- [`backend/src/config/database.ts`](../../backend/src/config/database.ts): `supabase` / `supabaseAdmin` delegam ao singleton privilegiado (deprecated em comentário).
- [`backend/src/security/audit.ts`](../../backend/src/security/audit.ts): usa `privilegedRpcLogAuditEvent`.
- [`backend/src/utils/logger.ts`](../../backend/src/utils/logger.ts): com `ENABLE_AUDIT_LOGS=true`, chama `privilegedRpcLogAuditEvent` (exige `userId` definido).
- [`backend/src/services/auth.service.ts`](../../backend/src/services/auth.service.ts): sessões com JWT Supabase via `createSupabaseUserClient`; restantes via `privilegedDb`; `logoutAllSessions(userId, accessToken?)`; `getDataClient` sem token → `getPrivilegedSupabase()`.
- [`backend/src/routes/auth.routes.ts`](../../backend/src/routes/auth.routes.ts): `logoutAllSessions` recebe `req.authToken`.
- [`backend/src/jobs/maintenance.ts`](../../backend/src/jobs/maintenance.ts): `privilegedMaintenanceRpc`.
- [`backend/src/security/authorization.ts`](../../backend/src/security/authorization.ts): `requireOwnedResource` usa `getPrivilegedSupabase()`.
- [`backend/src/services/vault.service.ts`](../../backend/src/services/vault.service.ts): classe deprecated; removido export `vaultService`; uso interno de `getPrivilegedSupabase()`.
- [`backend/src/types/database.ts`](../../backend/src/types/database.ts): tabela `two_factor_attempts` para tipagem do insert em `auth.routes`.
- Testes: [`backend/src/security/audit.test.ts`](../../backend/src/security/audit.test.ts) mock de `@/config/privilegedDb`.

## 5. Teste executado

- `npm run type-check` (tsconfig.security.json)
- `npm test`
- `npm run lint`

## 6. Risco residual

- Fluxos **JWT legado** sem access token Supabase continuam a depender de leitura/escrita privilegiada em `user_sessions`.
- Até aplicar as migrações SQL em [`docs/sql/migrations/`](../sql/migrations/README.md), o Postgres pode ainda expor `GRANT ALL` / policies fracas herdadas de scripts antigos.

---

## Revisão (feedback Codex) — SQL ajustado em 2026

| Tópico | Ação |
|--------|------|
| `001` demasiado amplo | `001_grants_minimal.sql` passou a **grants por tabela** + `audit_logs` só **SELECT** para `authenticated`; removido `GRANT CRUD ON ALL TABLES`; `ALTER DEFAULT PRIVILEGES` só para **sequências**. |
| `003` sem ENABLE RLS | `003` passa a **`ENABLE` + `FORCE` RLS** em `DO` + `to_regclass`; `audit_logs` **sem** policy de INSERT para `authenticated`. |
| `005` frágil | `005_functions_hardening.sql` reescrito com **`DO $$` + `pg_proc` + `oid::regprocedure`**, `EXCEPTION` por função. |
| Validação pós-migration | Novo [`docs/sql/post-checks.sql`](../sql/post-checks.sql). |
| Testes staging | Suite opcional [`backend/src/__tests__/db-security.integration.test.ts`](../../backend/src/__tests__/db-security.integration.test.ts) + `npm run test:db-security-integration`. |
