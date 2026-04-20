-- SafeBox 006: views respeitam RLS do invocador (Postgres 15+)
-- Se ALTER VIEW ... SET (security_invoker) falhar, verifique a versão do Postgres no projeto Supabase.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'user_stats') THEN
    EXECUTE 'ALTER VIEW public.user_stats SET (security_invoker = true)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'credentials_with_folder') THEN
    EXECUTE 'ALTER VIEW public.credentials_with_folder SET (security_invoker = true)';
  END IF;
END $$;
