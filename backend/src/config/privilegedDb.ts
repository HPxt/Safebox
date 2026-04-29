/**
 * Single entry point for Supabase service_role (privileged) access.
 * Use only for: privileged audit RPC, maintenance jobs, legacy paths without a user JWT.
 * Prefer createSupabaseUserClient(accessToken) for all tenant data.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { config } from '@/config/environment'

let privilegedClient: SupabaseClient<Database> | null = null

const createPrivilegedClient = (): SupabaseClient<Database> =>
  createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: { schema: 'public' },
    global: {
      headers: {
        'X-Client-Info': 'safebox-backend-privileged',
      },
    },
  })

export const getPrivilegedSupabase = (): SupabaseClient<Database> => {
  if (!privilegedClient) {
    privilegedClient = createPrivilegedClient()
  }
  return privilegedClient
}

export type PrivilegedOperation =
  | 'audit_rpc'
  | 'health_probe'
  | 'legacy_session_write'
  | 'legacy_session_read'
  | 'legacy_session_update'
  | 'legacy_last_login_rpc'
  | 'maintenance_rpc'

const logPrivilegedUse = (operation: PrivilegedOperation, meta?: Record<string, unknown>): void => {
  if (config.isDevelopment && typeof console !== 'undefined' && console.debug) {
    console.debug('[privilegedDb]', operation, meta ?? {})
  }
}

export const privilegedRpcLogAuditEvent = async (args: {
  p_user_id: string
  p_event_type: string
  p_event_data?: Json
  p_ip_address?: string | null
  p_user_agent?: string | null
}): Promise<void> => {
  logPrivilegedUse('audit_rpc', { eventType: args.p_event_type, userId: args.p_user_id })
  const rpcArgs: Database['public']['Functions']['log_audit_event']['Args'] = {
    p_user_id: args.p_user_id,
    p_event_type: args.p_event_type as Database['public']['Functions']['log_audit_event']['Args']['p_event_type'],
    p_event_data: args.p_event_data ?? {},
  }

  if (args.p_ip_address) {
    rpcArgs.p_ip_address = args.p_ip_address
  }
  if (args.p_user_agent) {
    rpcArgs.p_user_agent = args.p_user_agent
  }

  const { error } = await getPrivilegedSupabase().rpc('log_audit_event', rpcArgs)
  if (error) {
    throw error
  }
}

export const privilegedRpcUpdateUserLastLogin = async (userId: string): Promise<void> => {
  logPrivilegedUse('legacy_last_login_rpc', { userId })
  const { error } = await getPrivilegedSupabase().rpc('update_user_last_login', {
    p_user_id: userId,
  })
  if (error) {
    throw error
  }
}

export const privilegedMaintenanceRpc = async (
  name: 'cleanup_expired_sessions' | 'cleanup_old_audit_logs' | 'cleanup_old_backups',
): Promise<void> => {
  logPrivilegedUse('maintenance_rpc', { name })
  const { error } = await getPrivilegedSupabase().rpc(name)
  if (error) {
    throw error
  }
}

export const privilegedUserSessionsInsert = async (
  row: Database['public']['Tables']['user_sessions']['Insert'],
): Promise<void> => {
  logPrivilegedUse('legacy_session_write', { userId: row.user_id })
  const { error } = await getPrivilegedSupabase().from('user_sessions').insert(row)
  if (error) {
    throw error
  }
}

export const privilegedUserSessionsSelectActive = async (
  userId: string,
  sessionId: string,
): Promise<Pick<
  Database['public']['Tables']['user_sessions']['Row'],
  'id' | 'session_token' | 'expires_at' | 'is_active'
> | null> => {
  logPrivilegedUse('legacy_session_read', { userId, sessionId })
  const { data, error } = await getPrivilegedSupabase()
    .from('user_sessions')
    .select('id, session_token, expires_at, is_active')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }
  return data
}

export const privilegedUserSessionsUpdate = async (
  filter: { userId: string; sessionId?: string; sessionIds?: string[] },
  patch: Database['public']['Tables']['user_sessions']['Update'],
): Promise<void> => {
  logPrivilegedUse('legacy_session_update', { userId: filter.userId })
  let q = getPrivilegedSupabase().from('user_sessions').update(patch).eq('user_id', filter.userId)
  if (filter.sessionId) {
    q = q.eq('id', filter.sessionId)
  }
  if (filter.sessionIds?.length) {
    q = q.in('id', filter.sessionIds)
  }
  const { error } = await q
  if (error) {
    throw error
  }
}

export const privilegedUserSessionsListActiveIds = async (
  userId: string,
): Promise<{ id: string }[]> => {
  logPrivilegedUse('legacy_session_read', { userId, list: true })
  const { data, error } = await getPrivilegedSupabase()
    .from('user_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_activity_at', { ascending: false })

  if (error) {
    throw error
  }
  return data ?? []
}
