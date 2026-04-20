-- SafeBox 003: ENABLE RLS + FORCE (quando a tabela existe), policies em audit_logs / backups / user_sessions
--
-- Decisão audit_logs: authenticated NÃO insere diretamente — só SELECT das próprias linhas.
-- Escrita fica para service_role (backend com service key) via RPC log_audit_event (bypass RLS).
--
-- Compatibilidade: ENABLE/FORCE envoltos em DO + to_regclass (evita depender de ALTER TABLE IF EXISTS).

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.credential_backups') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.credential_backups ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.credential_backups FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.vault_backups') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.vault_backups ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.vault_backups FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ---------- audit_logs ----------
DROP POLICY IF EXISTS audit_logs_insert_system ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_own ON public.audit_logs;

DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Sem policy de INSERT para authenticated => inserção direta negada; RPC + service_role continuam a funcionar.

-- ---------- credential_backups ----------
DROP POLICY IF EXISTS credential_backups_select_own ON public.credential_backups;
DROP POLICY IF EXISTS credential_backups_insert_own ON public.credential_backups;

CREATE POLICY credential_backups_select_own ON public.credential_backups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY credential_backups_insert_own ON public.credential_backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- vault_backups ----------
DROP POLICY IF EXISTS vault_backups_rw_own ON public.vault_backups;

CREATE POLICY vault_backups_select_own ON public.vault_backups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY vault_backups_insert_own ON public.vault_backups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------- user_sessions ----------
DROP POLICY IF EXISTS user_sessions_rw_own ON public.user_sessions;

CREATE POLICY user_sessions_select_own ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_sessions_insert_own ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_sessions_update_own ON public.user_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
