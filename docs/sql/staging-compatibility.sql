-- Only used inside the empty-staging bootstrap transaction.
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS show_hidden_credentials boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clipboard_timeout integer DEFAULT 30;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id uuid, p_event_type text, p_event_data jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL, p_user_agent text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_id uuid;
BEGIN
  INSERT INTO public.audit_logs(user_id,event_type,event_data,ip_address,user_agent)
  VALUES(p_user_id,p_event_type,p_event_data,p_ip_address::inet,p_user_agent)
  RETURNING id INTO event_id;
  RETURN event_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_user_last_login(p_user_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.users SET last_login_at=now(), login_count=coalesce(login_count,0)+1 WHERE id=p_user_id;
$$;
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.user_sessions WHERE expires_at < now();
$$;
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '90 days';
$$;
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM public.vault_backups WHERE created_at < now() - interval '30 days';
  DELETE FROM public.credential_backups WHERE created_at < now() - interval '30 days';
END $$;
CREATE OR REPLACE FUNCTION public.get_user_vault(p_user_id uuid)
RETURNS TABLE(vault_id uuid,encrypted_data jsonb,data_hash text,version integer,created_at timestamptz,updated_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT v.id,v.encrypted_data,v.data_hash,v.version,v.created_at,v.updated_at
  FROM public.vaults v WHERE v.user_id=p_user_id;
$$;

CREATE VIEW public.credentials_with_folder WITH (security_invoker=true) AS
SELECT c.*, f.name AS folder_name FROM public.credentials c
LEFT JOIN public.folders f ON f.id=c.folder_id AND f.user_id=c.user_id;
CREATE VIEW public.user_stats WITH (security_invoker=true) AS
SELECT u.id,u.email,u.created_at,u.last_login_at,u.login_count,
  (SELECT count(*) FROM public.audit_logs a WHERE a.user_id=u.id) AS total_audit_events,
  (SELECT count(*) FROM public.audit_logs a WHERE a.user_id=u.id AND a.event_type='vault_unlock') AS vault_unlocks,
  (SELECT count(*) FROM public.vault_backups b WHERE b.user_id=u.id) AS backup_count,
  (SELECT max(v.updated_at) FROM public.vaults v WHERE v.user_id=u.id) AS vault_last_updated
FROM public.users u;
GRANT SELECT ON public.credentials_with_folder, public.user_stats TO authenticated;
