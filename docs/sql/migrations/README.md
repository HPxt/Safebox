# Migrações SQL de segurança (SafeBox)

Aplicar **na ordem numérica** no SQL Editor do Supabase (ou via pipeline de migração), **após** executar o inventário em [../db-security-inventory.sql](../db-security-inventory.sql) e preencher [../../reports/db-security-phase-01.md](../../reports/db-security-phase-01.md).

- Não executa reset, TRUNCATE nem DROP de tabelas de negócio.
- **001** usa grants **por tabela** (não `ALL TABLES` em CRUD) e deixa `audit_logs` só com **SELECT** para `authenticated`.
- **003** ativa **RLS + FORCE** onde aplicável; `audit_logs` **sem** INSERT para `authenticated` (escrita só via backend privilegiado / RPC).
- **005** usa bloco `DO` + `pg_proc` (sem `ALTER FUNCTION IF EXISTS`).

## Ordem

1. `001_grants_minimal.sql` — REVOKE perigoso + grants explícitos por tabela
2. `002_rls_core_users.sql` — `users` UPDATE com WITH CHECK
3. `003_rls_audit_backups_sessions.sql` — RLS/FORCE + policies (audit read-only para JWT)
4. `004_two_factor_attempts.sql` — tabela + RLS + grants
5. `005_functions_hardening.sql` — `search_path` + REVOKE dinâmico
6. `006_views_security_invoker.sql` — views com `security_invoker` (Postgres 15+)

## Pós-validação (obrigatório antes de “fechar” fase BD)

7. Executar [../post-checks.sql](../post-checks.sql) e anexar resultados ao relatório da fase 1 / checklist de release.

## Testes multi-tenant (staging)

Com credenciais de **dois** utilizadores no mesmo projeto Supabase, correr a suite opcional no backend:

```bash
set RUN_DB_SECURITY_INTEGRATION=1
set SUPABASE_URL=https://xxx.supabase.co
set SUPABASE_ANON_KEY=...
set SUPABASE_REFRESH_TOKEN_USER_A=...
set SUPABASE_REFRESH_TOKEN_USER_B=...
cd backend && npm run test:db-security-integration
```

(Ver `src/__tests__/db-security.integration.test.ts` — placeholder até tokens estarem configurados.)

Validar em **staging** antes de produção.
