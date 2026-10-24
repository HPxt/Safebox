-- Explicit search paths for URL constraint helpers and no direct access to
-- Supabase's internal automatic-RLS event trigger. Apply staging first.
ALTER FUNCTION public.is_clean_public_url(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.are_clean_public_urls(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.are_clean_public_urls_text_array(text[]) SET search_path = public, pg_temp;
DO $$
DECLARE fn regprocedure;
BEGIN
  fn := to_regprocedure('public.rls_auto_enable()');
  IF fn IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END IF;
END $$;
