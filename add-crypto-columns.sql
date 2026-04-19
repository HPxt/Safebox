-- Adicionar colunas de criptografia na tabela users
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS kdf_salt TEXT,
  ADD COLUMN IF NOT EXISTS kdf_params JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_hash TEXT;

-- Verificar se as colunas foram adicionadas
DO $$
BEGIN
  RAISE NOTICE '✅ Colunas de criptografia adicionadas à tabela users!';
  RAISE NOTICE '  - kdf_salt: para armazenar o salt da derivação de chave';
  RAISE NOTICE '  - kdf_params: para armazenar os parâmetros do Argon2id';
  RAISE NOTICE '  - key_hash: para verificar a senha mestra';
END $$;
