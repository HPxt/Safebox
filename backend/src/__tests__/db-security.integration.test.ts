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

const maybeCleanupById = async (
  admin: SupabaseClient,
  table: string,
  id: string | undefined,
): Promise<void> => {
  if (!id) {
    return
  }

  await admin.from(table).delete().eq('id', id)
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
  let seededUserSettingsId: string | undefined
  let seededUserSettingsCreated = false
  let seededCategoryId: string | undefined
  let seededFolderId: string | undefined
  let seededSessionId: string | undefined
  let seededCredentialBackupId: string | undefined
  let seededVaultId: string | undefined
  let seededVaultBackupId: string | undefined

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
    seededUserSettingsId = randomUUID()
    seededCategoryId = randomUUID()
    seededFolderId = randomUUID()
    seededSessionId = randomUUID()
    seededCredentialBackupId = randomUUID()
    seededVaultId = randomUUID()
    seededVaultBackupId = randomUUID()

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

    const existingUserSettings = await admin
      .from('user_settings')
      .select('id')
      .eq('user_id', userBId)
      .maybeSingle()
    if (existingUserSettings.error) {
      throw existingUserSettings.error
    }

    if (existingUserSettings.data?.id) {
      seededUserSettingsId = existingUserSettings.data.id
    } else {
      const userSettingsInsert = await admin.from('user_settings').insert({
        id: seededUserSettingsId,
        user_id: userBId,
        session_timeout: 15,
      }).select('id').maybeSingle()
      if (userSettingsInsert.error || !userSettingsInsert.data?.id) {
        throw userSettingsInsert.error ?? new Error('Failed to seed user_settings')
      }
      seededUserSettingsCreated = true
      seededUserSettingsId = userSettingsInsert.data.id
    }

    const categoryInsert = await admin.from('categories').insert({
      id: seededCategoryId,
      user_id: userBId,
      name: `dbsec-category-${Date.now()}`,
      color: '#112233',
      icon: 'folder',
    })
    if (categoryInsert.error) {
      throw categoryInsert.error
    }

    const folderInsert = await admin.from('folders').insert({
      id: seededFolderId,
      user_id: userBId,
      name: `dbsec-folder-${Date.now()}`,
      color: '#445566',
      icon: 'folder',
      position: 1,
    })
    if (folderInsert.error) {
      throw folderInsert.error
    }

    const sessionInsert = await admin.from('user_sessions').insert({
      id: seededSessionId,
      user_id: userBId,
      session_token: `dbsec-session-${randomUUID()}`,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      is_active: true,
    })
    if (sessionInsert.error) {
      throw sessionInsert.error
    }

    const credentialBackupInsert = await admin.from('credential_backups').insert({
      id: seededCredentialBackupId,
      user_id: userBId,
      credential_id: seededCredentialId,
      enc_blob: 'backup-cipher-b',
      backup_type: 'manual',
    })
    if (credentialBackupInsert.error) {
      throw credentialBackupInsert.error
    }

    const vaultInsert = await admin.from('vaults').insert({
      id: seededVaultId,
      user_id: userBId,
      encrypted_data: { encrypted: 'vault-cipher-b' },
      data_hash: 'c'.repeat(64),
      version: 1,
    })
    if (vaultInsert.error) {
      throw vaultInsert.error
    }

    const vaultBackupInsert = await admin.from('vault_backups').insert({
      id: seededVaultBackupId,
      user_id: userBId,
      vault_id: seededVaultId,
      encrypted_data: { encrypted: 'vault-backup-cipher-b' },
      backup_type: 'manual',
    })
    if (vaultBackupInsert.error) {
      throw vaultBackupInsert.error
    }
  }, 60000)

  afterAll(async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    await maybeCleanupById(admin, 'vault_backups', seededVaultBackupId)
    await maybeCleanupById(admin, 'credential_backups', seededCredentialBackupId)
    await maybeCleanupById(admin, 'audit_logs', seededAuditId)
    await maybeCleanupById(admin, 'user_sessions', seededSessionId)
    if (seededUserSettingsCreated) {
      await maybeCleanupById(admin, 'user_settings', seededUserSettingsId)
    }
    await maybeCleanupById(admin, 'categories', seededCategoryId)
    await maybeCleanupById(admin, 'folders', seededFolderId)
    await maybeCleanupById(admin, 'vaults', seededVaultId)
    await maybeCleanupById(admin, 'credentials', seededCredentialId)

    if (tempUserAId) {
      await admin.auth.admin.deleteUser(tempUserAId)
    }
    if (tempUserBId) {
      await admin.auth.admin.deleteUser(tempUserBId)
    }
  }, 60000)

  const expectUserACannotReadUserBRow = async (table: string, id: string) => {
    const { data, error } = await clientA
      .from(table)
      .select('id')
      .eq('id', id)
      .eq('user_id', userBId)
      .limit(5)

    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  }

  const expectUserACannotUpdateUserBRow = async (table: string, id: string) => {
    const { data, error } = await clientA
      .from(table)
      .update({ user_id: userAId })
      .eq('id', id)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  }

  const expectUserACannotDeleteUserBRow = async (table: string, id: string) => {
    const { data, error } = await clientA
      .from(table)
      .delete()
      .eq('id', id)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  }

  it('user A cannot read rows owned by user B across multi-tenant tables', async () => {
    if (!enabled) {
      return
    }

    expect(userAId).not.toEqual(userBId)

    await expectUserACannotReadUserBRow('credentials', seededCredentialId!)
    await expectUserACannotReadUserBRow('audit_logs', seededAuditId!)
    await expectUserACannotReadUserBRow('user_settings', seededUserSettingsId!)
    await expectUserACannotReadUserBRow('categories', seededCategoryId!)
    await expectUserACannotReadUserBRow('folders', seededFolderId!)
    await expectUserACannotReadUserBRow('user_sessions', seededSessionId!)
    await expectUserACannotReadUserBRow('credential_backups', seededCredentialBackupId!)
    await expectUserACannotReadUserBRow('vaults', seededVaultId!)
    await expectUserACannotReadUserBRow('vault_backups', seededVaultBackupId!)
  })

  it('user A cannot update rows owned by user B across mutable multi-tenant tables', async () => {
    if (!enabled) {
      return
    }

    await expectUserACannotUpdateUserBRow('credentials', seededCredentialId!)
    await expectUserACannotUpdateUserBRow('user_settings', seededUserSettingsId!)
    await expectUserACannotUpdateUserBRow('categories', seededCategoryId!)
    await expectUserACannotUpdateUserBRow('folders', seededFolderId!)
    await expectUserACannotUpdateUserBRow('user_sessions', seededSessionId!)
    await expectUserACannotUpdateUserBRow('vaults', seededVaultId!)
  })

  it('user A cannot delete rows owned by user B across mutable multi-tenant tables', async () => {
    if (!enabled) {
      return
    }

    await expectUserACannotDeleteUserBRow('credentials', seededCredentialId!)
    await expectUserACannotDeleteUserBRow('user_settings', seededUserSettingsId!)
    await expectUserACannotDeleteUserBRow('categories', seededCategoryId!)
    await expectUserACannotDeleteUserBRow('folders', seededFolderId!)
    await expectUserACannotDeleteUserBRow('vaults', seededVaultId!)
  })

  it('user A cannot insert rows for user B in tenant-owned tables', async () => {
    if (!enabled) {
      return
    }

    const insertAttempts = [
      clientA.from('credentials').insert({
        user_id: userBId,
        title: 'cross-tenant-credential',
        encrypted_password: 'cipher-a-to-b',
      }),
      clientA.from('categories').insert({
        user_id: userBId,
        name: `cross-tenant-category-${Date.now()}`,
        color: '#abcdef',
      }),
      clientA.from('folders').insert({
        user_id: userBId,
        name: `cross-tenant-folder-${Date.now()}`,
        color: '#abcdef',
        position: 2,
      }),
      clientA.from('user_settings').insert({
        user_id: userBId,
        session_timeout: 15,
      }),
      clientA.from('vaults').insert({
        user_id: userBId,
        encrypted_data: { encrypted: 'cross-tenant-vault' },
        data_hash: 'd'.repeat(64),
        version: 1,
      }),
      clientA.from('user_sessions').insert({
        user_id: userBId,
        session_token: `cross-tenant-session-${randomUUID()}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    ]

    for (const attempt of insertAttempts) {
      const { error } = await attempt
      expect(error).not.toBeNull()
      expect(error?.message).toMatch(/row-level security|violates row-level security/i)
    }
  })
})
