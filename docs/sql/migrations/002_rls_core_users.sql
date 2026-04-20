-- SafeBox 002: policy de UPDATE em public.users com WITH CHECK
-- Rollback:
--   DROP POLICY IF EXISTS users_update_own ON public.users;
--   CREATE POLICY users_update_own ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
