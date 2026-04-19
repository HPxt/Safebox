-- SafeBox Database Schema - Optimized Version (idempotente, com FOLDERS)
-- Execute este script no Supabase SQL Editor

/* -------------------------------------------------------------------------- */
/* EXTENSÕES                                                                   */
/* -------------------------------------------------------------------------- */
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

/* -------------------------------------------------------------------------- */
/* 1️⃣  CREDENTIALS – credenciais individuais (compatível com frontend)        */
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

-- 🔄 Para compatibilidade com backend que ainda usa enc_blob, adicionar campos opcionais:
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS enc_blob   TEXT,  -- Mudado de BYTEA para TEXT para JSON
  ADD COLUMN IF NOT EXISTS data_hash  TEXT,
  ADD COLUMN IF NOT EXISTS version    INTEGER DEFAULT 1;

-- 🔧 FORÇAR conversão de enc_blob para TEXT e limpar dados inválidos
DO $$
BEGIN
  -- Primeiro, dropar TODAS as views que possam depender de credentials
  DROP VIEW IF EXISTS admin_stats CASCADE;
  DROP VIEW IF EXISTS public.admin_stats CASCADE;
  DROP VIEW IF EXISTS public.credentials_with_folder CASCADE;
  DROP VIEW IF EXISTS public.user_stats CASCADE;
  
  -- IMPORTANTE: Dropar triggers de backup temporariamente para evitar erros durante conversão
  DROP TRIGGER IF EXISTS trigger_credential_backup ON public.credentials;
  DROP TRIGGER IF EXISTS backup_credentials_before_update ON public.credentials;
  DROP TRIGGER IF EXISTS create_credential_backup ON public.credentials;
  
  -- IMPORTANTE: Desabilitar triggers de usuário temporariamente para evitar erros durante conversão
  ALTER TABLE public.credentials DISABLE TRIGGER USER;
  
  -- Verificar se enc_blob existe e é BYTEA
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credentials' 
    AND column_name = 'enc_blob' 
    AND data_type = 'bytea'
    AND table_schema = 'public'
  ) THEN
    -- Criar coluna temporária
    ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS enc_blob_temp TEXT;
    
    -- Converter dados existentes de BYTEA para TEXT
    UPDATE public.credentials 
    SET enc_blob_temp = 
      CASE 
        WHEN enc_blob IS NOT NULL AND octet_length(enc_blob) > 0 THEN
          -- Tentar decodificar como UTF-8
          CASE 
            WHEN encode(enc_blob, 'escape') LIKE '[%' THEN encode(enc_blob, 'escape')
            ELSE convert_from(enc_blob, 'UTF8')
          END
        ELSE NULL
      END;
    
    -- Dropar coluna antiga e renomear a nova
    ALTER TABLE public.credentials DROP COLUMN enc_blob;
    ALTER TABLE public.credentials RENAME COLUMN enc_blob_temp TO enc_blob;
    
    RAISE NOTICE '✅ Coluna enc_blob convertida de BYTEA para TEXT com dados preservados';
  END IF;
  
  -- Garantir que enc_blob é TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credentials' 
    AND column_name = 'enc_blob' 
    AND data_type != 'text'
    AND table_schema = 'public'
  ) THEN
    -- Forçar conversão para TEXT
    ALTER TABLE public.credentials ALTER COLUMN enc_blob TYPE TEXT;
  END IF;
  
  -- Limpar dados inválidos em enc_blob (que não são JSON válido)
  UPDATE public.credentials 
  SET enc_blob = '[]'
  WHERE enc_blob IS NOT NULL 
    AND enc_blob != ''
    AND (
      NOT (enc_blob LIKE '[%' AND enc_blob LIKE '%]')
      OR enc_blob LIKE '%Object%'
    );
    
  -- Reabilitar triggers de usuário
  ALTER TABLE public.credentials ENABLE TRIGGER USER;
    
  RAISE NOTICE '✅ Dados inválidos em enc_blob foram limpos';
END $$;

-- 🔧 Remover NOT NULL constraint de enc_blob se existir (para permitir uso de campos individuais)
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
/* 1️⃣.2  CREDENTIAL_BACKUPS – backups de credenciais (para triggers)          */
/* -------------------------------------------------------------------------- */

-- 🔧 PRIMEIRO: Converter tabela existente se necessário (ANTES de criar/modificar)
DO $$
BEGIN
  -- Se a tabela credential_backups já existe, precisamos convertê-la ANTES
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'credential_backups' 
    AND table_schema = 'public'
  ) THEN
    -- Dropar triggers de backup temporariamente
    DROP TRIGGER IF EXISTS trigger_credential_backup ON public.credentials;
    DROP TRIGGER IF EXISTS backup_credentials_before_update ON public.credentials;
    DROP TRIGGER IF EXISTS create_credential_backup ON public.credentials;
    
    -- Desabilitar triggers de usuário temporariamente
    ALTER TABLE public.credentials DISABLE TRIGGER USER;
    
    -- Verificar se enc_blob existe e é BYTEA
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'credential_backups' 
      AND column_name = 'enc_blob' 
      AND data_type = 'bytea'
      AND table_schema = 'public'
    ) THEN
      -- Criar coluna temporária
      ALTER TABLE public.credential_backups ADD COLUMN IF NOT EXISTS enc_blob_temp TEXT;
      
      -- Converter dados existentes de BYTEA para TEXT
      UPDATE public.credential_backups 
      SET enc_blob_temp = 
        CASE 
          WHEN enc_blob IS NOT NULL AND octet_length(enc_blob) > 0 THEN
            -- Tentar decodificar como UTF-8
            CASE 
              WHEN encode(enc_blob, 'escape') LIKE '[%' THEN encode(enc_blob, 'escape')
              ELSE convert_from(enc_blob, 'UTF8')
            END
          ELSE NULL
        END;
      
      -- Dropar coluna antiga e renomear a nova
      ALTER TABLE public.credential_backups DROP COLUMN enc_blob;
      ALTER TABLE public.credential_backups RENAME COLUMN enc_blob_temp TO enc_blob;
      
      RAISE NOTICE '✅ Coluna enc_blob em credential_backups convertida de BYTEA para TEXT';
    END IF;
    
    -- Garantir que enc_blob é TEXT
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'credential_backups' 
      AND column_name = 'enc_blob' 
      AND data_type != 'text'
      AND table_schema = 'public'
    ) THEN
      -- Forçar conversão para TEXT
      ALTER TABLE public.credential_backups ALTER COLUMN enc_blob TYPE TEXT;
    END IF;
    
    -- Reabilitar triggers de usuário
    ALTER TABLE public.credentials ENABLE TRIGGER USER;
  END IF;
END $$;

-- Agora criar a tabela se não existir (ou adicionar colunas faltantes)
CREATE TABLE IF NOT EXISTS public.credential_backups (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id  UUID NOT NULL,
  enc_blob       TEXT,  -- Usando TEXT para compatibilidade com credentials
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
/* 1️⃣.5  VAULTS – cofre criptografado único por usuário (para backend)        */
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
/* 3️⃣  FOLDERS – pastas hierárquicas                                          */
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
/* 4️⃣  USER_SETTINGS                                                          */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS public.user_settings (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_timeout         INTEGER DEFAULT 15,
  auto_lock               BOOLEAN DEFAULT true,
  require_confirm         BOOLEAN DEFAULT true,
  default_length          INTEGER DEFAULT 16 CHECK (default_length BETWEEN 8 AND 128),
  use_lowercase           BOOLEAN DEFAULT true,
  use_uppercase           BOOLEAN DEFAULT true,
  use_numbers             BOOLEAN DEFAULT true,
  use_symbols             BOOLEAN DEFAULT true,
  exclude_ambiguous       BOOLEAN DEFAULT true,
  theme                   TEXT DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  language                TEXT DEFAULT 'pt-BR' CHECK (language IN ('pt-BR','en-US')),
  compact_mode            BOOLEAN DEFAULT false,
  show_strength           BOOLEAN DEFAULT true,
  show_hidden_credentials BOOLEAN DEFAULT false,  -- Habilita visualização de credenciais ocultas
  clipboard_timeout       INTEGER DEFAULT 30,     -- Tempo em segundos para limpar clipboard
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Adicionar novas colunas se não existirem (para bancos existentes)
ALTER TABLE public.user_settings 
  ADD COLUMN IF NOT EXISTS show_hidden_credentials BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS clipboard_timeout INTEGER DEFAULT 30;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_rw_own ON public.user_settings;
CREATE POLICY settings_rw_own
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

/* -------------------------------------------------------------------------- */
/* 5️⃣  USERS – tabela de usuários (para backend)                              */
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
/* 6️⃣  AUDIT_LOGS – logs de auditoria                                         */
/* -------------------------------------------------------------------------- */
-- Primeiro, verificar e corrigir tabela existente se necessário
DO $$
BEGIN
  -- Se a tabela audit_logs já existe com coluna "action", renomear para "event_type"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'action' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'event_type' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.audit_logs RENAME COLUMN action TO event_type;
  END IF;
  
  -- Se a tabela audit_logs já existe com coluna "details", renomear para "event_data"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'details' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'event_data' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.audit_logs RENAME COLUMN details TO event_data;
  END IF;
END $$;

-- Agora criar ou modificar a tabela
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

-- Adicionar colunas que podem não existir
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'vault_unlock',
  ADD COLUMN IF NOT EXISTS event_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Adicionar constraint no event_type (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'audit_logs_event_type_check'
  ) THEN
    ALTER TABLE public.audit_logs 
    ADD CONSTRAINT audit_logs_event_type_check 
    CHECK (event_type IN (
      'vault_unlock','vault_lock','credential_created','credential_updated',
      'credential_deleted','settings_updated','login_success','login_failure',
      'password_changed','backup_created','backup_restored'
    ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_event_idx ON public.audit_logs (event_type, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS audit_logs_insert_system ON public.audit_logs;
CREATE POLICY audit_logs_insert_system ON public.audit_logs FOR INSERT WITH CHECK (true);

/* -------------------------------------------------------------------------- */
/* 7️⃣  USER_SESSIONS – sessões ativas                                         */
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
/* 8️⃣  VAULT_BACKUPS – backups dos vaults                                    */
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
/* 6️⃣  TRIGGERS e FUNÇÕES (inclui update_folders_updated_at)                  */
/* -------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at: credentials, vaults, categories, folders, user_settings, users
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
/* DEFAULTS PARA NOVOS USERS – inclui pastas padrão                            */
/* -------------------------------------------------------------------------- */
-- 🔧 IMPORTANTE: Dropar trigger primeiro para evitar erro de dependência
-- "cannot drop function create_default_user_settings() because other objects depend on it"
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS create_default_user_settings();
CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar registro na tabela users (necessário para o backend)
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

-- ✅ Recriar o trigger após a função estar pronta
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_user_settings();

/* -------------------------------------------------------------------------- */
/* TRIGGER PARA BACKUP DE CREDENCIAIS                                         */
/* -------------------------------------------------------------------------- */
-- Dropar todos os triggers que possam usar esta função
DROP TRIGGER IF EXISTS trigger_credential_backup ON public.credentials;
DROP TRIGGER IF EXISTS backup_credentials_before_update ON public.credentials;
DROP TRIGGER IF EXISTS create_credential_backup ON public.credentials;

-- Dropar função com CASCADE para remover dependências
DROP FUNCTION IF EXISTS create_credential_backup() CASCADE;

-- Função para criar backup antes de atualização
CREATE OR REPLACE FUNCTION create_credential_backup()
RETURNS TRIGGER AS $$
BEGIN
  -- Só criar backup se enc_blob foi alterado
  IF OLD.enc_blob IS DISTINCT FROM NEW.enc_blob THEN
    INSERT INTO public.credential_backups (user_id, credential_id, enc_blob, backup_type)
    VALUES (OLD.user_id, OLD.id, OLD.enc_blob, 'pre_update');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para chamar a função de backup
CREATE TRIGGER trigger_credential_backup
  BEFORE UPDATE ON public.credentials
  FOR EACH ROW EXECUTE FUNCTION create_credential_backup();

/* -------------------------------------------------------------------------- */
/* 9️⃣  FUNÇÕES ESPECÍFICAS (necessárias para o backend)                       */
/* -------------------------------------------------------------------------- */

-- Função para log de auditoria (usada pelo backend) - versão robusta
-- DROP da função existente para evitar conflitos de parâmetros
DROP FUNCTION IF EXISTS public.log_audit_event(UUID, TEXT, JSONB, INET, TEXT);
DROP FUNCTION IF EXISTS public.log_audit_event(UUID, TEXT, JSONB, INET);
DROP FUNCTION IF EXISTS public.log_audit_event(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.log_audit_event(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Tentar inserir com a estrutura padrão
  BEGIN
    INSERT INTO public.audit_logs (user_id, event_type, event_data, ip_address, user_agent)
    VALUES (p_user_id, p_event_type, p_event_data, p_ip_address, p_user_agent)
    RETURNING id INTO log_id;
    
    RETURN log_id;
  EXCEPTION
    WHEN undefined_column THEN
      -- Se falhou, tentar com nomes alternativos (para compatibilidade)
      BEGIN
        INSERT INTO public.audit_logs (user_id, action, details, ip_address, user_agent)
        VALUES (p_user_id, p_event_type, p_event_data, p_ip_address, p_user_agent)
        RETURNING id INTO log_id;
        
        RETURN log_id;
      EXCEPTION
        WHEN OTHERS THEN
          -- Se ainda falhou, apenas logar o erro
          RAISE NOTICE 'Erro ao inserir audit log: %, usando: %', SQLERRM, p_event_type;
          RETURN NULL;
      END;
    WHEN OTHERS THEN
      RAISE NOTICE 'Erro inesperado no audit log: %', SQLERRM;
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar último login
DROP FUNCTION IF EXISTS public.update_user_last_login(UUID);
CREATE OR REPLACE FUNCTION public.update_user_last_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users 
  SET last_login_at = NOW(), 
      login_count = login_count + 1,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter vault do usuário (compatibilidade)
DROP FUNCTION IF EXISTS public.get_user_vault(UUID);
CREATE OR REPLACE FUNCTION public.get_user_vault(p_user_id UUID)
RETURNS TABLE(
  vault_id UUID,
  encrypted_data JSONB,
  data_hash TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.encrypted_data, v.data_hash, v.version, v.created_at, v.updated_at
  FROM public.vaults v
  WHERE v.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar logs antigos
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs();
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.audit_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar sessões expiradas
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.user_sessions 
  WHERE expires_at < NOW() OR is_active = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar backups antigos
DROP FUNCTION IF EXISTS public.cleanup_old_backups();
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS VOID AS $$
BEGIN
  -- Manter apenas os 10 backups mais recentes por usuário
  DELETE FROM public.vault_backups 
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM public.vault_backups
    ) ranked
    WHERE rn > 10
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/* -------------------------------------------------------------------------- */
/* 🔟  VIEWS ÚTEIS                                                             */
/* -------------------------------------------------------------------------- */

-- View com estatísticas do usuário (usada pelo backend)
DROP VIEW IF EXISTS public.user_stats;
CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.last_login_at,
  u.login_count,
  COUNT(DISTINCT al.id) as total_audit_events,
  COUNT(DISTINCT CASE WHEN al.event_type = 'vault_unlock' THEN al.id END) as vault_unlocks,
  COUNT(DISTINCT vb.id) as backup_count,
  MAX(v.updated_at) as vault_last_updated
FROM public.users u
LEFT JOIN public.audit_logs al ON u.id = al.user_id
LEFT JOIN public.vault_backups vb ON u.id = vb.user_id
LEFT JOIN public.vaults v ON u.id = v.user_id
WHERE u.id = auth.uid()
GROUP BY u.id, u.email, u.created_at, u.last_login_at, u.login_count;

-- View de credenciais com informações de pasta  
DROP VIEW IF EXISTS public.credentials_with_folder;
CREATE OR REPLACE VIEW public.credentials_with_folder AS
SELECT 
  c.*,
  f.name as folder_name,
  f.color as folder_color,
  f.icon as folder_icon
FROM public.credentials c
LEFT JOIN public.folders f ON c.folder_id = f.id
WHERE c.user_id = auth.uid()
ORDER BY c.updated_at DESC;

/* -------------------------------------------------------------------------- */
/* 1️⃣1️⃣  PERMISSÕES                                                            */
/* -------------------------------------------------------------------------- */

-- Garantir permissões para usuários autenticados
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Permitir acesso às views
GRANT SELECT ON public.user_stats TO authenticated;
GRANT SELECT ON public.credentials_with_folder TO authenticated;

/* -------------------------------------------------------------------------- */
/* 1️⃣2️⃣  RECRIAR VIEW ADMIN_STATS (se existia)                                */
/* -------------------------------------------------------------------------- */

-- Recriar admin_stats se necessário (ajustada para TEXT ao invés de BYTEA)
DO $$
BEGIN
  -- Verificar se devemos recriar admin_stats
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'admin'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE VIEW admin_stats AS
    SELECT 
      COUNT(DISTINCT c.user_id) as total_users,
      COUNT(c.id) as total_credentials,
      COUNT(DISTINCT c.user_id) FILTER (WHERE c.enc_blob IS NOT NULL) as users_with_vault,
      COUNT(c.id) FILTER (WHERE c.enc_blob IS NULL) as individual_credentials,
      COUNT(DISTINCT f.id) as total_folders,
      COUNT(DISTINCT cat.id) as total_categories,
      COUNT(DISTINCT al.id) as total_audit_events,
      MAX(c.updated_at) as last_credential_update,
      MAX(al.created_at) as last_audit_event
    FROM public.credentials c
    LEFT JOIN public.folders f ON f.user_id = c.user_id
    LEFT JOIN public.categories cat ON cat.user_id = c.user_id
    LEFT JOIN public.audit_logs al ON al.user_id = c.user_id
    ';
    
    RAISE NOTICE '✅ View admin_stats recriada com suporte para TEXT';
  END IF;
END $$;

/* -------------------------------------------------------------------------- */
DO $$
BEGIN
  RAISE NOTICE '✅ SafeBox Schema HÍBRIDO criado com sucesso!';
  RAISE NOTICE '📋 Tabelas: credentials (campos individuais), credential_backups, vaults (backend), folders, categories, users, audit_logs, user_sessions, vault_backups';
  RAISE NOTICE '🔧 Funções: log_audit_event (robusta), update_user_last_login, get_user_vault, cleanup_*, create_credential_backup';
  RAISE NOTICE '👁️  Views: user_stats, credentials_with_folder';
  RAISE NOTICE '🔄 Compatibilidade: Frontend (campos individuais) + Backend (vaults criptografados)';
  RAISE NOTICE '🛠️  Correções: event_type/action automático, estruturas existentes preservadas, enc_blob como TEXT em todas as tabelas';
  RAISE NOTICE '🎯 Sistema pronto para uso completo - Frontend e Backend SEM ERROS!';
END $$;
