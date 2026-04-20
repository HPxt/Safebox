-- SafeBox 001: revoga privilégios perigosos + grants explícitos por tabela (authenticated)
--
-- Motivação (revisão): evitar "GRANT ... ON ALL TABLES" que reabre superfície em tabelas onde
-- não queremos CRUD completo (ex.: audit_logs só leitura; backups sem UPDATE/DELETE direto).
--
-- Pré-requisito: executar docs/sql/db-security-inventory.sql e guardar export de role_table_grants.
-- Ordem: 001 antes de 004 (two_factor_attempts) — tabela 2FA recebe grants em 004.
--
-- Rollback: restaurar export de grants do inventário (não automatizado aqui).

-- ---------------------------------------------------------------------------
-- A) Remover privilégios perigosos em todas as tabelas public (recomendado)
-- ---------------------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ---------------------------------------------------------------------------
-- B) Grants mínimos por tabela (ajuste se o inventário mostrar tabelas extra)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Core cofre / dados do utilizador
  IF to_regclass('public.credentials') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.credentials TO authenticated';
  END IF;
  IF to_regclass('public.vaults') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaults TO authenticated';
  END IF;
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated';
  END IF;
  IF to_regclass('public.folders') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated';
  END IF;
  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated';
  END IF;
  IF to_regclass('public.users') IS NOT NULL THEN
    -- Perfil: leitura + atualização; INSERT costuma vir do trigger on_auth_user_created
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated';
  END IF;

  -- Backups: leitura + criação; limpeza/manutenção via service_role / RPC
  IF to_regclass('public.vault_backups') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.vault_backups TO authenticated';
  END IF;
  IF to_regclass('public.credential_backups') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.credential_backups TO authenticated';
  END IF;

  -- Sessões (fluxo Supabase + legado)
  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated';
  END IF;

  -- Auditoria: apenas leitura para o próprio utilizador (escrita = backend privilegiado / RPC)
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.audit_logs TO authenticated';
  END IF;
END $$;

-- Sequências usadas por colunas default (uuid, etc.)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ---------------------------------------------------------------------------
-- C) Objetos futuros: NÃO reabrir GRANT CRUD em todas as tabelas.
--     Apenas sequências; novas tabelas devem ser tratadas numa migração explícita.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;
