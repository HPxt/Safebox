-- SafeBox: validação pós-migração (somente leitura)
-- Executar depois de aplicar docs/sql/migrations/*.sql em staging/produção.
-- Copiar resultados relevantes para docs/reports/db-security-phase-01.md (secção pós-check).

-- ---------------------------------------------------------------------------
-- 1) RLS ativo e FORCE (tabelas sensíveis)
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'credentials', 'vaults', 'user_settings', 'folders', 'categories',
    'vault_backups', 'credential_backups', 'audit_logs', 'user_sessions', 'users',
    'two_factor_attempts'
  )
ORDER BY c.relname;

-- ---------------------------------------------------------------------------
-- 2) Policies por tabela (resumo)
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, permissive, roles::text AS roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'credentials', 'vaults', 'user_settings', 'folders', 'categories',
    'vault_backups', 'credential_backups', 'audit_logs', 'user_sessions', 'users',
    'two_factor_attempts'
  )
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- 3) audit_logs: não deve existir policy de INSERT para authenticated
-- ---------------------------------------------------------------------------
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'audit_logs'
  AND cmd = 'INSERT';

-- Esperado: 0 linhas (ou apenas roles que não incluam authenticated — alinhar com a política desejada).

-- ---------------------------------------------------------------------------
-- 4) Grants em tabelas sensíveis para authenticated
-- ---------------------------------------------------------------------------
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN (
    'credentials', 'vaults', 'user_settings', 'folders', 'categories',
    'vault_backups', 'credential_backups', 'audit_logs', 'user_sessions', 'users',
    'two_factor_attempts'
  )
ORDER BY table_name, privilege_type;

-- Esperado audit_logs: SELECT apenas (sem INSERT se 001 foi aplicado).

-- ---------------------------------------------------------------------------
-- 5) Funções SECURITY DEFINER em public
-- ---------------------------------------------------------------------------
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
ORDER BY p.proname, args;

-- ---------------------------------------------------------------------------
-- 6) EXECUTE concedido a authenticated em funções “sensíveis” (deve estar vazio após 005)
-- ---------------------------------------------------------------------------
SELECT routine_name, routine_schema, privilege_type
FROM information_schema.routine_privileges
WHERE grantee = 'authenticated'
  AND routine_schema = 'public'
  AND routine_name IN (
    'cleanup_old_audit_logs',
    'cleanup_expired_sessions',
    'cleanup_old_backups',
    'log_audit_event',
    'update_user_last_login',
    'get_user_vault'
  )
ORDER BY routine_name;

-- Esperado: 0 linhas.

-- ---------------------------------------------------------------------------
-- 7) Regras de negocio adicionadas em 008
-- ---------------------------------------------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'credentials_single_active_vault_per_user_idx';

SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN ('users', 'credential_backups', 'vault_backups', 'two_factor_attempts')
ORDER BY table_name, privilege_type;

SELECT table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name = 'users'
  AND privilege_type = 'UPDATE'
ORDER BY column_name;

-- Esperado:
-- - indice credentials_single_active_vault_per_user_idx presente.
-- - users sem UPDATE amplo de tabela; UPDATE apenas via column grants para full_name/avatar_url.
-- - backups e two_factor_attempts sem INSERT/UPDATE/DELETE para authenticated.
