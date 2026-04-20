-- SafeBox: inventário de segurança (somente leitura)
-- Execute no Supabase SQL Editor ou psql; não altera dados nem schema.
-- Copie o resultado para docs/reports/db-security-phase-01.md (matriz).

-- 1) Tabelas sensíveis + RLS
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

-- 2) Políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'credentials', 'vaults', 'user_settings', 'folders', 'categories',
    'vault_backups', 'credential_backups', 'audit_logs', 'user_sessions', 'users',
    'two_factor_attempts'
  )
ORDER BY tablename, policyname;

-- 3) Funções SECURITY DEFINER em public
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
ORDER BY p.proname;

-- 4) Privilégios em tabelas para authenticated
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN (
    'credentials', 'vaults', 'user_settings', 'folders', 'categories',
    'vault_backups', 'credential_backups', 'audit_logs', 'user_sessions', 'users',
    'two_factor_attempts'
  )
ORDER BY table_name, privilege_type;

-- 5) EXECUTE em funções para authenticated
SELECT
  routine_schema,
  routine_name,
  privilege_type
FROM information_schema.routine_privileges
WHERE grantee = 'authenticated'
  AND routine_schema = 'public'
ORDER BY routine_name;

-- Após aplicar migrações em docs/sql/migrations/, executar também:
--   docs/sql/post-checks.sql
