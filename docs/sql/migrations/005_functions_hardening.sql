-- SafeBox 005: search_path + REVOKE (dinâmico via pg_proc — sem depender de ALTER FUNCTION IF EXISTS)
--
-- O que faz:
-- 1) Para cada função em public com nome na lista, aplica SET search_path = public, pg_temp
-- 2) REVOKE ALL ... FROM PUBLIC, authenticated para RPCs administrativas e funções que não devem
--    ser chamadas pelo cliente com JWT de utilizador
--
-- Compatível com qualquer overload: usa oid::regprocedure como identificador textual exato.

DO $$
DECLARE
  r RECORD;
  fn_sig text;
  names_search_path text[] := ARRAY[
    'create_default_user_settings',
    'create_credential_backup',
    'update_updated_at_column',
    'log_audit_event',
    'update_user_last_login',
    'get_user_vault',
    'cleanup_old_audit_logs',
    'cleanup_expired_sessions',
    'cleanup_old_backups'
  ];
  names_revoke text[] := ARRAY[
    'cleanup_old_audit_logs',
    'cleanup_expired_sessions',
    'cleanup_old_backups',
    'log_audit_event',
    'update_user_last_login',
    'get_user_vault'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(names_search_path)
  LOOP
    fn_sig := r.oid::regprocedure::text;

    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn_sig);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '005: skip ALTER search_path for %: %', fn_sig, SQLERRM;
    END;

    IF r.proname = ANY(names_revoke) THEN
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn_sig);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE '005: skip REVOKE PUBLIC for %: %', fn_sig, SQLERRM;
      END;
      BEGIN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn_sig);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE '005: skip REVOKE authenticated for %: %', fn_sig, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- Nota: triggers SECURITY DEFINER (ex.: create_credential_backup) continuam a executar no servidor;
-- REVOKE EXECUTE para authenticated impede chamadas diretas via PostgREST, não o trigger.
