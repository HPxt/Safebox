-- SafeBox 008: regras de negocio e limites no banco
--
-- Objetivos:
-- 1) Impedir mais de um vault ativo por usuario em public.credentials.
-- 2) Enforcar limites de payload tambem quando alguem usa a anon key direto.
-- 3) Bloquear UPDATE amplo em public.users e liberar apenas campos de perfil.
-- 4) Impedir referencias cross-tenant entre credentials/folders.
-- 5) Remover INSERT direto em tabelas auxiliares que podem inflar o banco.

-- ---------------------------------------------------------------------------
-- A) Um unico vault ativo por usuario
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  duplicate_user uuid;
BEGIN
  SELECT user_id
  INTO duplicate_user
  FROM public.credentials
  WHERE enc_blob IS NOT NULL
  GROUP BY user_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_user IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot create credentials_single_active_vault_per_user_idx: duplicate active vault snapshots exist for user %',
      duplicate_user
      USING ERRCODE = '23505';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS credentials_single_active_vault_per_user_idx
  ON public.credentials (user_id)
  WHERE enc_blob IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B) Limites de payload e formato em writes diretos
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS kdf_salt TEXT,
  ADD COLUMN IF NOT EXISTS kdf_params JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_hash TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
  ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_enc_blob_size_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_enc_blob_size_check
      CHECK (enc_blob IS NULL OR char_length(enc_blob) <= 1500000)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_data_hash_format_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_data_hash_format_check
      CHECK (data_hash IS NULL OR data_hash ~* '^[a-f0-9]{64}$')
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credentials_field_size_check'
  ) THEN
    ALTER TABLE public.credentials
      ADD CONSTRAINT credentials_field_size_check
      CHECK (
        char_length(btrim(title)) BETWEEN 1 AND 200
        AND (username IS NULL OR char_length(username) <= 500)
        AND (email IS NULL OR char_length(email) <= 500)
        AND char_length(encrypted_password) <= 200000
        AND (website IS NULL OR char_length(website) <= 1000)
        AND (notes IS NULL OR char_length(notes) <= 10000)
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credential_backups_enc_blob_size_check'
  ) THEN
    ALTER TABLE public.credential_backups
      ADD CONSTRAINT credential_backups_enc_blob_size_check
      CHECK (enc_blob IS NULL OR char_length(enc_blob) <= 1500000)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vaults_encrypted_data_size_check'
  ) THEN
    ALTER TABLE public.vaults
      ADD CONSTRAINT vaults_encrypted_data_size_check
      CHECK (octet_length(encrypted_data::text) <= 1500000)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vaults_data_hash_format_check'
  ) THEN
    ALTER TABLE public.vaults
      ADD CONSTRAINT vaults_data_hash_format_check
      CHECK (data_hash ~* '^[a-f0-9]{64}$')
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_backups_encrypted_data_size_check'
  ) THEN
    ALTER TABLE public.vault_backups
      ADD CONSTRAINT vault_backups_encrypted_data_size_check
      CHECK (octet_length(encrypted_data::text) <= 1500000)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_security_bounds_check'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_security_bounds_check
      CHECK (
        session_timeout BETWEEN 5 AND 120
        AND clipboard_timeout BETWEEN 5 AND 300
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_crypto_profile_size_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_crypto_profile_size_check
      CHECK (
        (kdf_salt IS NULL OR char_length(kdf_salt) <= 512)
        AND (key_hash IS NULL OR char_length(key_hash) <= 256)
        AND (two_factor_secret IS NULL OR char_length(two_factor_secret) <= 512)
        AND (two_factor_backup_codes IS NULL OR cardinality(two_factor_backup_codes) <= 20)
      )
      NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- C) Mass assignment: authenticated nao pode atualizar public.users inteiro
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.users TO authenticated;

-- ---------------------------------------------------------------------------
-- D) Backups e tentativas 2FA: escrita direta pelo cliente fica bloqueada
-- ---------------------------------------------------------------------------
DO $$
BEGIN
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
-- E) Ownership cross-tenant em folders/credentials
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_credential_folder_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.folder_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.folders f
      WHERE f.id = NEW.folder_id
        AND f.user_id = NEW.user_id
    )
  THEN
    RAISE EXCEPTION 'folder_id must belong to the same user as the credential'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS ensure_credential_folder_owner ON public.credentials;
CREATE TRIGGER ensure_credential_folder_owner
  BEFORE INSERT OR UPDATE OF user_id, folder_id ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION public.ensure_credential_folder_owner();

CREATE OR REPLACE FUNCTION public.ensure_folder_parent_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'folder cannot be its own parent'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.folders parent
      WHERE parent.id = NEW.parent_id
        AND parent.user_id = NEW.user_id
    )
  THEN
    RAISE EXCEPTION 'parent_id must belong to the same user as the folder'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS ensure_folder_parent_owner ON public.folders;
CREATE TRIGGER ensure_folder_parent_owner
  BEFORE INSERT OR UPDATE OF user_id, parent_id ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.ensure_folder_parent_owner();

REVOKE ALL ON FUNCTION public.ensure_credential_folder_owner() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.ensure_folder_parent_owner() FROM PUBLIC, authenticated;
