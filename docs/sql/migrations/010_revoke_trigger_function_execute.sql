-- SafeBox 010: impedir chamada direta de funcoes internas/trigger via RPC
--
-- Funcoes de trigger continuam executando pelo proprio PostgreSQL.
-- O objetivo aqui e remover EXECUTE direto para clientes anon/authenticated
-- em funcoes que nao fazem parte da API publica.

DO $$
DECLARE
  r RECORD;
  fn_sig text;
  internal_functions text[] := ARRAY[
    'create_credential_backup',
    'create_default_user_settings',
    'ensure_credential_folder_owner',
    'ensure_folder_parent_owner',
    'update_updated_at_column'
  ];
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(internal_functions)
  LOOP
    fn_sig := r.oid::regprocedure::text;

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn_sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn_sig);
  END LOOP;
END $$;
