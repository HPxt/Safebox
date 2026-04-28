-- SafeBox 013: permitir que constraints de URL executem validadores puros
--
-- As funcoes abaixo nao leem dados sensiveis nem alteram estado; elas sao usadas
-- por CHECK constraints em writes feitos por authenticated. Sem EXECUTE, o Postgres
-- rejeita ate updates legitimos que disparam a constraint.

REVOKE ALL ON FUNCTION public.is_clean_public_url(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.are_clean_public_urls(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.are_clean_public_urls_text_array(text[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_clean_public_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_clean_public_urls(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_clean_public_urls_text_array(text[]) TO authenticated;
