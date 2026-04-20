-- SafeBox 004: tabela two_factor_attempts + RLS (usada pelo backend em auth.routes)
-- Idempotente: não apaga dados existentes.

CREATE TABLE IF NOT EXISTS public.two_factor_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS two_factor_attempts_user_idx
  ON public.two_factor_attempts (user_id, created_at DESC);

ALTER TABLE public.two_factor_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.two_factor_attempts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS two_factor_attempts_insert_own ON public.two_factor_attempts;
CREATE POLICY two_factor_attempts_insert_own ON public.two_factor_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS two_factor_attempts_select_own ON public.two_factor_attempts;
CREATE POLICY two_factor_attempts_select_own ON public.two_factor_attempts
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.two_factor_attempts TO authenticated;
