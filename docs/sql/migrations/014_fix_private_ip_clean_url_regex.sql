-- SafeBox 014: corrigir bloqueio de IP privado/local em URL limpa
--
-- A versao inicial bloqueava prefixos como 127. apenas quando eram seguidos
-- imediatamente por /, : ou fim; isso nao capturava o IP completo 127.0.0.1.

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

REVOKE ALL ON FUNCTION public.is_clean_public_url(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clean_public_url(text) TO authenticated;
