-- SafeBox 011: limites para campos estendidos de credentials
--
-- A migration 008 protegia os campos historicos. O schema atual tambem tem
-- campos de TOTP, URI e cartao; todos precisam de limite no banco porque a
-- anon key permite writes diretos quando a RLS autoriza o usuario.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_extended_field_size_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_extended_field_size_check
      CHECK (
        (totp_secret IS NULL OR char_length(totp_secret) <= 200000)
        AND (uris IS NULL OR octet_length(uris::text) <= 50000)
        AND (card_holder_name IS NULL OR char_length(card_holder_name) <= 1000)
        AND (card_number IS NULL OR char_length(card_number) <= 2000)
        AND (card_brand IS NULL OR char_length(card_brand) <= 100)
        AND (card_exp_month IS NULL OR char_length(card_exp_month) <= 32)
        AND (card_exp_year IS NULL OR char_length(card_exp_year) <= 32)
        AND (card_cvv IS NULL OR char_length(card_cvv) <= 1000)
      )
      NOT VALID;
  END IF;
END $$;
