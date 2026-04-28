-- SafeBox 009: hardening complementar de RLS e regras de negocio
--
-- Objetivos:
-- 1) Impedir mais de um registro ativo em public.vaults por usuario.
-- 2) Bloquear escrita direta de clientes em tabelas auxiliares server-owned.
-- 3) Reforcar FORCE RLS nas tabelas sensiveis.
-- 4) Adicionar limites de payload em tabelas auxiliares e organizacionais.

-- ---------------------------------------------------------------------------
-- A) Um unico vault ativo por usuario em public.vaults
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  duplicate_user uuid;
BEGIN
  SELECT user_id
  INTO duplicate_user
  FROM public.vaults
  GROUP BY user_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_user IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create vaults_single_active_per_user_idx: duplicate vault rows exist for user %',
      duplicate_user
      USING ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS vaults_single_active_per_user_idx
  ON public.vaults (user_id);

-- ---------------------------------------------------------------------------
-- B) FORCE RLS nas tabelas de maior risco
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'credentials',
    'vaults',
    'user_settings',
    'folders',
    'categories',
    'credential_backups',
    'vault_backups',
    'audit_logs',
    'user_sessions',
    'users',
    'two_factor_attempts'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- C) Tabelas auxiliares pertencem ao backend/service role, nao ao cliente
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.audit_logs FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.audit_logs TO authenticated';
  END IF;

  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.user_sessions FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.user_sessions TO authenticated';
  END IF;

  IF to_regclass('public.credential_backups') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.credential_backups FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.credential_backups TO authenticated';
  END IF;

  IF to_regclass('public.vault_backups') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.vault_backups FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.vault_backups TO authenticated';
  END IF;

  IF to_regclass('public.two_factor_attempts') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.two_factor_attempts FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.two_factor_attempts TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- D) Limites de payload adicionais para abusos de storage via anon key
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'folders_business_bounds_check'
  ) THEN
    ALTER TABLE public.folders
      ADD CONSTRAINT folders_business_bounds_check
      CHECK (
        char_length(btrim(name)) BETWEEN 1 AND 100
        AND (color IS NULL OR color ~* '^#[a-f0-9]{6}$')
        AND (icon IS NULL OR char_length(icon) <= 64)
        AND position BETWEEN 0 AND 100000
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_business_bounds_check'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_business_bounds_check
      CHECK (
        char_length(btrim(name)) BETWEEN 1 AND 100
        AND (color IS NULL OR color ~* '^#[a-f0-9]{6}$')
        AND (icon IS NULL OR char_length(icon) <= 64)
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_token_size_check'
  ) THEN
    ALTER TABLE public.user_sessions
      ADD CONSTRAINT user_sessions_token_size_check
      CHECK (char_length(session_token) <= 512)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_event_data_size_check'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_event_data_size_check
      CHECK (octet_length(event_data::text) <= 100000)
      NOT VALID;
  END IF;
END $$;
