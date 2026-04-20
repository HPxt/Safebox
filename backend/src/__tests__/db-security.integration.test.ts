/**
 * Testes multi-tenant contra Supabase staging (opcional).
 *
 * Variaveis:
 *   RUN_DB_SECURITY_INTEGRATION=1
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   E uma destas opcoes:
 *     A) SUPABASE_REFRESH_TOKEN_USER_A, SUPABASE_REFRESH_TOKEN_USER_B
 *     B) SUPABASE_SERVICE_ROLE_KEY (provisiona utilizadores temporarios automaticamente)
 *
 * Comando:
 *   npm run test:db-security-integration
 */
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const enabled = process.env['RUN_DB_SECURITY_INTEGRATION'] === '1'

type IntegrationEnv = {
  url: string
  anonKey: string
  refreshA?: string
  refreshB?: string
  serviceRoleKey?: string
}

const requireIntegrationEnv = (): IntegrationEnv => {
  const url = process.env['SUPABASE_URL'] ?? ''
  const anonKey = process.env['SUPABASE_ANON_KEY'] ?? ''
  const refreshA = process.env['SUPABASE_REFRESH_TOKEN_USER_A'] ?? ''
  const refreshB = process.env['SUPABASE_REFRESH_TOKEN_USER_B'] ?? ''
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

  if (!url || !anonKey || (!(refreshA && refreshB) && !serviceRoleKey)) {
    throw new Error(
      'Missing SUPABASE_URL, SUPABASE_ANON_KEY and either refresh tokens or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return { url, anonKey, refreshA, refreshB, serviceRoleKey }
}

const userScopedClient = async (
  url: string,
  anonKey: string,
  refreshToken: string,
): Promise<{ client: SupabaseClient; userId: string }> => {
  const raw = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data, error } = await raw.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session?.access_token || !data.user?.id) {
    throw error ?? new Error('refreshSession returned no session')
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })

  return { client, userId: data.user.id }
}

const signInWithPassword = async (
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; userId: string }> => {
  const raw = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data, error } = await raw.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token || !data.user?.id) {
    throw error ?? new Error('signInWithPassword returned no session')
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })

  return { client, userId: data.user.id }
}

;(enabled ? describe : describe.skip)('DB security multi-tenant integration (Supabase staging)', () => {
  let url: string
  let anonKey: string
  let refreshA: string | undefined
  let refreshB: string | undefined
  let serviceRoleKey: string | undefined

  let clientA: SupabaseClient
  let userAId: string
  let userBId: string

  let tempUserAId: string | undefined
  let tempUserBId: string | undefined
  let seededCredentialId: string | undefined
  let seededAuditId: string | undefined

  beforeAll(async () => {
    if (!enabled) {
      return
    }

    ;({ url, anonKey, refreshA, refreshB, serviceRoleKey } = requireIntegrationEnv())

    if (refreshA && refreshB) {
      const sessionA = await userScopedClient(url, anonKey, refreshA)
      const sessionB = await userScopedClient(url, anonKey, refreshB)
      clientA = sessionA.client
      userAId = sessionA.userId
      userBId = sessionB.userId
      return
    }

    const admin = createClient(url, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    const password = `DbSec-${randomUUID()}!Aa1`
    const emailA = `dbsec-a-${Date.now()}@example.test`
    const emailB = `dbsec-b-${Date.now()}@example.test`

    const createdA = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    })
    if (createdA.error || !createdA.data.user?.id) {
      throw createdA.error ?? new Error('Failed to create temporary user A')
    }

    const createdB = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })
    if (createdB.error || !createdB.data.user?.id) {
      throw createdB.error ?? new Error('Failed to create temporary user B')
    }

    tempUserAId = createdA.data.user.id
    tempUserBId = createdB.data.user.id

    const sessionA = await signInWithPassword(url, anonKey, emailA, password)
    const sessionB = await signInWithPassword(url, anonKey, emailB, password)
    clientA = sessionA.client
    userAId = sessionA.userId
    userBId = sessionB.userId

    seededCredentialId = randomUUID()
    seededAuditId = randomUUID()

    const credentialInsert = await admin.from('credentials').insert({
      id: seededCredentialId,
      user_id: userBId,
      title: 'db-security-seeded',
      encrypted_password: 'cipher-b',
      enc_blob: 'cipher-b',
      data_hash: 'hash-b',
      version: 1,
    })
    if (credentialInsert.error) {
      throw credentialInsert.error
    }

    const auditInsert = await admin.from('audit_logs').insert({
      id: seededAuditId,
      user_id: userBId,
      event_type: 'credential_created',
      event_data: { source: 'db-security-integration' },
    })
    if (auditInsert.error) {
      throw auditInsert.error
    }
  }, 60000)

  afterAll(async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    if (seededAuditId) {
      await admin.from('audit_logs').delete().eq('id', seededAuditId)
    }
    if (seededCredentialId) {
      await admin.from('credentials').delete().eq('id', seededCredentialId)
    }
    if (tempUserAId) {
      await admin.auth.admin.deleteUser(tempUserAId)
    }
    if (tempUserBId) {
      await admin.auth.admin.deleteUser(tempUserBId)
    }
  }, 60000)

  it('user A cannot list credentials owned by user B', async () => {
    if (!enabled) {
      return
    }

    expect(userAId).not.toEqual(userBId)

    const { data, error } = await clientA
      .from('credentials')
      .select('id')
      .eq('user_id', userBId)
      .limit(5)

    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('user A cannot read audit logs owned by user B', async () => {
    if (!enabled) {
      return
    }

    const { data, error } = await clientA
      .from('audit_logs')
      .select('id')
      .eq('user_id', userBId)
      .limit(5)

    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })
})
