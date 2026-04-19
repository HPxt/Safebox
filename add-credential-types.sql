-- =====================================================
-- SafeBox - Adicionar tipos de credenciais
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Adicionar coluna de tipo
ALTER TABLE public.credentials 
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'credential' 
    CHECK (type IN ('credential', 'card', 'identity', 'note', 'ssh_key'));

-- 2. Adicionar campos para Credencial
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,           -- Chave TOTP (autenticador)
  ADD COLUMN IF NOT EXISTS uris JSONB DEFAULT '[]',    -- Lista de URIs/sites
  ADD COLUMN IF NOT EXISTS require_master_password BOOLEAN DEFAULT false;  -- Resolicitar senha mestre

-- 3. Adicionar campos para Cartão
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS card_holder_name TEXT,      -- Nome do titular
  ADD COLUMN IF NOT EXISTS card_number TEXT,           -- Número do cartão (criptografado)
  ADD COLUMN IF NOT EXISTS card_brand TEXT,            -- Bandeira (Visa, Mastercard, etc)
  ADD COLUMN IF NOT EXISTS card_exp_month TEXT,        -- Mês de vencimento
  ADD COLUMN IF NOT EXISTS card_exp_year TEXT,         -- Ano de vencimento
  ADD COLUMN IF NOT EXISTS card_cvv TEXT;              -- CVV (criptografado)

-- 4. Adicionar campos para Identidade (futuro)
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS identity_title TEXT,        -- Sr., Sra., Dr., etc
  ADD COLUMN IF NOT EXISTS identity_first_name TEXT,
  ADD COLUMN IF NOT EXISTS identity_last_name TEXT,
  ADD COLUMN IF NOT EXISTS identity_cpf TEXT,          -- CPF (criptografado)
  ADD COLUMN IF NOT EXISTS identity_rg TEXT,           -- RG
  ADD COLUMN IF NOT EXISTS identity_birth_date TEXT,
  ADD COLUMN IF NOT EXISTS identity_phone TEXT,
  ADD COLUMN IF NOT EXISTS identity_address JSONB;     -- Endereço completo

-- 5. Adicionar campos para Chave SSH (futuro)
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS ssh_public_key TEXT,
  ADD COLUMN IF NOT EXISTS ssh_private_key TEXT,       -- Criptografada
  ADD COLUMN IF NOT EXISTS ssh_passphrase TEXT;        -- Criptografada

-- 6. Criar índice para tipo
CREATE INDEX IF NOT EXISTS credentials_type_idx ON public.credentials (user_id, type);

-- 7. Atualizar credenciais existentes para tipo 'credential'
UPDATE public.credentials SET type = 'credential' WHERE type IS NULL;

-- 8. Confirmação
DO $$
BEGIN
  RAISE NOTICE '✅ Tipos de credenciais adicionados com sucesso!';
  RAISE NOTICE '📋 Tipos disponíveis: credential, card, identity, note, ssh_key';
  RAISE NOTICE '🔐 Campos de cartão: card_holder_name, card_number, card_brand, card_exp_month, card_exp_year, card_cvv';
  RAISE NOTICE '🔒 Campo require_master_password adicionado para proteção extra';
END $$;
