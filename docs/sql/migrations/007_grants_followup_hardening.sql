-- SafeBox 007: follow-up de grants e default privileges
--
-- Objetivo:
-- 1) Remover grants excessivos que permaneceram em tabelas auxiliares sensiveis
-- 2) Impedir que novos objetos em public herdem GRANT ALL para authenticated/anon
--    por default ACL legado

-- ---------------------------------------------------------------------------
-- A) Tabelas auxiliares: revogar privilegios alem do necessario
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.audit_logs FROM authenticated';
  END IF;

  IF to_regclass('public.credential_backups') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.credential_backups FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON public.credential_backups TO authenticated';
  END IF;

  IF to_regclass('public.vault_backups') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.vault_backups FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON public.vault_backups TO authenticated';
  END IF;

  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    EXECUTE 'REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.user_sessions FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated';
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.users FROM authenticated';
    EXECUTE 'REVOKE INSERT ON public.users FROM authenticated';
    EXECUTE 'GRANT SELECT, UPDATE ON public.users TO authenticated';
  END IF;

  IF to_regclass('public.two_factor_attempts') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.two_factor_attempts FROM authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON public.two_factor_attempts TO authenticated';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- B) Default privileges: parar de herdar GRANT ALL em objetos futuros
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['postgres', 'supabase_admin']
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip revoke default table privileges for role %: %', owner_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip revoke default table privileges from anon for role %: %', owner_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip revoke default function privileges for role %: %', owner_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip revoke default function privileges from anon for role %: %', owner_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip revoke default sequence privileges for role %: %', owner_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip revoke default sequence privileges from anon for role %: %', owner_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated',
        owner_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '007: skip grant default sequence usage for role %: %', owner_name, SQLERRM;
    END;
  END LOOP;
END $$;
