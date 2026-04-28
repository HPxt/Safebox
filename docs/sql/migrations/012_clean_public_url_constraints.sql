-- SafeBox 012: URL limpa para campos persistidos
--
-- Bloqueia URLs que possam virar tracking pixel/web beacon ou alvo local:
-- - apenas https
-- - sem query string, fragment, usuario/senha
-- - sem localhost, IPs privados/link-local
-- - sem extensoes comuns de imagem/script/recurso ativo

CREATE OR REPLACE FUNCTION public.is_clean_public_url(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    value IS NULL
    OR btrim(value) = ''
    OR (
      char_length(value) <= 1000
      AND value = btrim(value)
      AND value !~ '[[:space:][:cntrl:]]'
      AND value ~* '^https://[a-z0-9.-]+(:[0-9]{1,5})?(/[a-z0-9._~!$&''()*+,;=:@%/-]*)?$'
      AND value !~ '[?#]'
      AND value !~* '^https://[^/]*@'
      AND value !~* '^https://([^/:]+\.)?(localhost|local)([:/]|$)'
      AND value !~* '^https://(localhost|127\.[0-9.]+|10\.[0-9.]+|0\.[0-9.]+|169\.254\.[0-9.]+|192\.168\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+)([:/]|$)'
      AND value !~* '\.(apng|avif|bmp|gif|ico|jpe?g|png|svg|webp|css|mjs|js|json|xml)$'
    );
$$;

CREATE OR REPLACE FUNCTION public.are_clean_public_urls(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    value IS NULL
    OR (
      jsonb_typeof(value) = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(value) AS item(url)
        WHERE NOT public.is_clean_public_url(item.url)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.are_clean_public_urls_text_array(value text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    value IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM unnest(value) AS item(url)
      WHERE NOT public.is_clean_public_url(item.url)
    );
$$;

DO $$
DECLARE
  credential_uris_type text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'credentials'
      AND column_name = 'website'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_website_clean_url_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_website_clean_url_check
      CHECK (public.is_clean_public_url(website))
      NOT VALID;
  END IF;

  SELECT udt_name
  INTO credential_uris_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'credentials'
    AND column_name = 'uris';

  IF credential_uris_type = 'jsonb'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_uris_clean_url_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_uris_clean_url_check
      CHECK (public.are_clean_public_urls(uris))
      NOT VALID;
  ELSIF credential_uris_type = '_text'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_uris_clean_url_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_uris_clean_url_check
      CHECK (public.are_clean_public_urls_text_array(uris))
      NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'avatar_url'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_avatar_url_clean_url_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_avatar_url_clean_url_check
      CHECK (public.is_clean_public_url(avatar_url))
      NOT VALID;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.is_clean_public_url(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.are_clean_public_urls(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.are_clean_public_urls_text_array(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clean_public_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_clean_public_urls(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_clean_public_urls_text_array(text[]) TO authenticated;
