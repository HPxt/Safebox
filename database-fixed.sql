-- SafeBox Database Schema - FIXED ORDER
-- Execute este script no Supabase SQL Editor

/* -------------------------------------------------------------------------- */
/* EXTENSÕES                                                                   */
/* -------------------------------------------------------------------------- */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

/* -------------------------------------------------------------------------- */
/* 1️⃣  FOLDERS – pastas hierárquicas (DEVE SER CRIADA PRIMEIRO!)              */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.folders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  color      TEXT DEFAULT '#175DDC' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon       TEXT DEFAULT 'folder',
  parent_id  UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  position   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_folder UNIQUE (user_id, name, parent_id)
);

CREATE INDEX IF NOT EXISTS folders_user_idx   ON public.folders (user_id, position);
CREATE INDEX IF NOT EXISTS folders_parent_idx ON public.folders (parent_id);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS folders_rw_own ON public.folders;
CREATE POLICY folders_rw_own
  ON public.folders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 2️⃣  CATEGORIES – etiquetas do usuário                                      */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  color      TEXT DEFAULT '#4f46e5' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon       TEXT DEFAULT 'folder',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_category UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS categories_user_idx ON public.categories (user_id, name);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_rw_own ON public.categories;
CREATE POLICY categories_rw_own
  ON public.categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 3️⃣  CREDENTIALS – credenciais individuais (AGORA PODE REFERENCIAR FOLDERS) */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.credentials (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  username           TEXT,
  email              TEXT,
  encrypted_password TEXT NOT NULL,
  website            TEXT,
  notes              TEXT,
  folder_id          UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  is_favorite        BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS enc_blob   TEXT,
  ADD COLUMN IF NOT EXISTS data_hash  TEXT,
  ADD COLUMN IF NOT EXISTS version    INTEGER DEFAULT 1;

ALTER TABLE public.credentials ALTER COLUMN enc_blob DROP NOT NULL;

CREATE INDEX IF NOT EXISTS credentials_user_idx     ON public.credentials (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS credentials_title_idx    ON public.credentials (user_id, title);
CREATE INDEX IF NOT EXISTS credentials_folder_idx   ON public.credentials (folder_id);
CREATE INDEX IF NOT EXISTS credentials_favorite_idx ON public.credentials (user_id, is_favorite);
CREATE INDEX IF NOT EXISTS credentials_hash_idx     ON public.credentials (data_hash);

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credentials_select_own  ON public.credentials;
DROP POLICY IF EXISTS credentials_insert_own  ON public.credentials;
DROP POLICY IF EXISTS credentials_update_own  ON public.credentials;
DROP POLICY IF EXISTS credentials_delete_own  ON public.credentials;

CREATE POLICY credentials_select_own  ON public.credentials FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY credentials_insert_own  ON public.credentials FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY credentials_update_own  ON public.credentials FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY credentials_delete_own  ON public.credentials FOR DELETE  USING (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 4️⃣  CREDENTIAL_BACKUPS – backups de credenciais                            */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.credential_backups (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id  UUID NOT NULL,
  enc_blob       TEXT,
  backup_type    TEXT DEFAULT 'pre_update',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credential_backups_user_idx ON public.credential_backups (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credential_backups_credential_idx ON public.credential_backups (credential_id);

ALTER TABLE public.credential_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credential_backups_select_own ON public.credential_backups;
CREATE POLICY credential_backups_select_own ON public.credential_backups 
  FOR SELECT USING (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 5️⃣  VAULTS – cofre criptografado único por usuário                         */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.vaults (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_data JSONB NOT NULL,
  data_hash      TEXT NOT NULL,
  version        INTEGER DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_vault UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS vaults_user_idx ON public.vaults (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS vaults_hash_idx ON public.vaults (data_hash);

ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vaults_select_own ON public.vaults;
DROP POLICY IF EXISTS vaults_insert_own ON public.vaults;
DROP POLICY IF EXISTS vaults_update_own ON public.vaults;
DROP POLICY IF EXISTS vaults_delete_own ON public.vaults;

CREATE POLICY vaults_select_own ON public.vaults FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY vaults_insert_own ON public.vaults FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY vaults_update_own ON public.vaults FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY vaults_delete_own ON public.vaults FOR DELETE USING (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 6️⃣  USER_SETTINGS                                                          */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.user_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_timeout   INTEGER DEFAULT 15,
  auto_lock         BOOLEAN DEFAULT true,
  require_confirm   BOOLEAN DEFAULT true,
  default_length    INTEGER DEFAULT 16 CHECK (default_length BETWEEN 8 AND 128),
  use_lowercase     BOOLEAN DEFAULT true,
  use_uppercase     BOOLEAN DEFAULT true,
  use_numbers       BOOLEAN DEFAULT true,
  use_symbols       BOOLEAN DEFAULT true,
  exclude_ambiguous BOOLEAN DEFAULT true,
  theme             TEXT DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  language          TEXT DEFAULT 'pt-BR' CHECK (language IN ('pt-BR','en-US')),
  compact_mode      BOOLEAN DEFAULT false,
  show_strength     BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_rw_own ON public.user_settings;
CREATE POLICY settings_rw_own
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 7️⃣  USERS – tabela de usuários                                             */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  avatar_url     TEXT,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  preferences    JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  last_login_at  TIMESTAMPTZ,
  login_count    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_status_idx ON public.users (status);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (auth.uid() = id);

/* -------------------------------------------------------------------------- */
/* 8️⃣  AUDIT_LOGS – logs de auditoria                                         */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL DEFAULT 'vault_unlock',
  event_data  JSONB DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  session_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_event_idx ON public.audit_logs (event_type, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS audit_logs_insert_system ON public.audit_logs;
CREATE POLICY audit_logs_insert_system ON public.audit_logs FOR INSERT WITH CHECK (true);

/* -------------------------------------------------------------------------- */
/* 9️⃣  USER_SESSIONS – sessões ativas                                         */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token     TEXT NOT NULL UNIQUE,
  expires_at        TIMESTAMPTZ NOT NULL,
  ip_address        INET,
  user_agent        TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions (user_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS user_sessions_token_idx ON public.user_sessions (session_token) WHERE is_active = true;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_sessions_rw_own ON public.user_sessions;
CREATE POLICY user_sessions_rw_own ON public.user_sessions 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 🔟  VAULT_BACKUPS – backups dos vaults                                     */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.vault_backups (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id       UUID NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  encrypted_data JSONB NOT NULL,
  backup_type    TEXT DEFAULT 'manual',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_backups_user_idx ON public.vault_backups (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vault_backups_vault_idx ON public.vault_backups (vault_id);

ALTER TABLE public.vault_backups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_backups_rw_own ON public.vault_backups;
CREATE POLICY vault_backups_rw_own ON public.vault_backups 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* TRIGGERS e FUNÇÕES                                                          */
/* -------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_credentials_updated_at ON public.credentials;
CREATE TRIGGER update_credentials_updated_at
  BEFORE UPDATE ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vaults_updated_at ON public.vaults;
CREATE TRIGGER update_vaults_updated_at
  BEFORE UPDATE ON public.vaults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

/* -------------------------------------------------------------------------- */
/* DEFAULTS PARA NOVOS USERS                                                   */
/* -------------------------------------------------------------------------- */
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_default_user_settings();

CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar registro na tabela users
  INSERT INTO public.users (id, email, full_name, status, created_at) VALUES
    (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'active', NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Criar configurações padrão
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  -- Criar categorias padrão
  INSERT INTO public.categories (user_id, name, color, icon) VALUES
    (NEW.id,'Pessoal','#10b981','user'),
    (NEW.id,'Trabalho','#3b82f6','briefcase'),
    (NEW.id,'Financeiro','#f59e0b','credit-card'),
    (NEW.id,'Social','#8b5cf6','users')
  ON CONFLICT DO NOTHING;

  -- Criar pastas padrão
  INSERT INTO public.folders (user_id, name, color, icon, position) VALUES
    (NEW.id,'Trabalho','#3b82f6','briefcase',1),
    (NEW.id,'Pessoal','#10b981','user',2),
    (NEW.id,'Financeiro','#f59e0b','credit-card',3),
    (NEW.id,'Redes Sociais','#ec4899','share-2',4)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_user_settings();

/* -------------------------------------------------------------------------- */
/* TRIGGER PARA BACKUP DE CREDENCIAIS                                         */
/* -------------------------------------------------------------------------- */
DROP TRIGGER IF EXISTS trigger_credential_backup ON public.credentials;
DROP FUNCTION IF EXISTS create_credential_backup() CASCADE;

CREATE OR REPLACE FUNCTION create_credential_backup()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.enc_blob IS DISTINCT FROM NEW.enc_blob THEN
    INSERT INTO public.credential_backups (user_id, credential_id, enc_blob, backup_type)
    VALUES (OLD.user_id, OLD.id, OLD.enc_blob, 'pre_update');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_credential_backup
  BEFORE UPDATE ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION create_credential_backup();

/* -------------------------------------------------------------------------- */
/* PERMISSÕES                                                                  */
/* -------------------------------------------------------------------------- */
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

/* -------------------------------------------------------------------------- */
DO $$
BEGIN
  RAISE NOTICE '✅ SafeBox Schema criado com sucesso!';
  RAISE NOTICE '📋 Tabelas: folders, categories, credentials, credential_backups, vaults, user_settings, users, audit_logs, user_sessions, vault_backups';
END $$;
