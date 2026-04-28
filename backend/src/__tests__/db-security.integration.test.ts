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

const expectSafeAuthorizationError = (message: string | undefined) => {
  expect(message ?? '').toMatch(
    /permission denied|row-level security|violates row-level security|could not find the function/i,
  )
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
  let seededUserAFolderId: string | undefined
  let seededUserACredentialId: string | undefined
  let seededUserAActiveCredentialId: string | undefined
  let seededUserAVaultId: string | undefined
  const userACreatedRows: Array<{ table: string; id: string }> = []

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
    seededUserAFolderId = randomUUID()
    seededUserACredentialId = randomUUID()
    seededUserAActiveCredentialId = randomUUID()
    seededUserAVaultId = randomUUID()

    const credentialInsert = await admin.from('credentials').insert({
      id: seededCredentialId,
      user_id: userBId,
      title: 'db-security-seeded',
      encrypted_password: 'cipher-b',
      enc_blob: 'cipher-b',
      data_hash: 'b'.repeat(64),
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

    const userAFolderInsert = await admin.from('folders').insert({
      id: seededUserAFolderId,
      user_id: userAId,
      name: `dbsec-folder-a-${Date.now()}`,
      color: '#778899',
      icon: 'folder',
      position: 1,
    })
    if (userAFolderInsert.error) {
      throw userAFolderInsert.error
    }

    const userACredentialInsert = await admin.from('credentials').insert({
      id: seededUserACredentialId,
      user_id: userAId,
      title: 'db-security-user-a-credential',
      encrypted_password: 'cipher-a',
      folder_id: seededUserAFolderId,
    })
    if (userACredentialInsert.error) {
      throw userACredentialInsert.error
    }

    const userAActiveCredentialInsert = await admin.from('credentials').insert({
      id: seededUserAActiveCredentialId,
      user_id: userAId,
      title: 'db-security-user-a-active-vault',
      encrypted_password: 'cipher-a-active',
      enc_blob: 'cipher-a-active',
      data_hash: 'e'.repeat(64),
      version: 1,
    })
    if (userAActiveCredentialInsert.error) {
      throw userAActiveCredentialInsert.error
    }

    const userAVaultInsert = await admin.from('vaults').insert({
      id: seededUserAVaultId,
      user_id: userAId,
      encrypted_data: { encrypted: 'vault-cipher-a' },
      data_hash: 'a'.repeat(64),
      version: 1,
    })
    if (userAVaultInsert.error) {
      throw userAVaultInsert.error
    }
  }, 60000)

  afterAll(async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    for (const row of [...userACreatedRows].reverse()) {
      await maybeCleanupById(admin, row.table, row.id)
    }

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
    await maybeCleanupById(admin, 'credentials', seededUserAActiveCredentialId)
    await maybeCleanupById(admin, 'credentials', seededUserACredentialId)
    await maybeCleanupById(admin, 'vaults', seededUserAVaultId)
    await maybeCleanupById(admin, 'folders', seededUserAFolderId)

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

    if (error) {
      expectSafeAuthorizationError(error.message)
      return
    }

    expect(data ?? []).toEqual([])
  }

  const expectUserACannotUpdateUserBRow = async (table: string, id: string) => {
    const { data, error } = await clientA
      .from(table)
      .update({ user_id: userAId })
      .eq('id', id)
      .select('id')

    if (error) {
      expectSafeAuthorizationError(error.message)
      return
    }

    expect(data ?? []).toEqual([])
  }

  const expectUserACannotDeleteUserBRow = async (table: string, id: string) => {
    const { data, error } = await clientA
      .from(table)
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      expectSafeAuthorizationError(error.message)
      return
    }

    expect(data ?? []).toEqual([])
  }

  const expectRejectedWrite = async (
    table: string,
    id: string,
    write: PromiseLike<{ error: unknown }>,
  ) => {
    const { error } = await write
    if (!error) {
      userACreatedRows.push({ table, id })
    }
    expect(error).not.toBeNull()
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
      expectSafeAuthorizationError(error?.message)
    }
  })

  it('rejects user and tenant tampering inside relationships, not only top-level ownership', async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const credentialWithUserBFolderId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      credentialWithUserBFolderId,
      clientA.from('credentials').insert({
        id: credentialWithUserBFolderId,
        user_id: userAId,
        folder_id: seededFolderId,
        title: 'cross-tenant-folder-reference',
        encrypted_password: 'cipher-a',
      }),
    )

    const folderWithUserBParentId = randomUUID()
    await expectRejectedWrite(
      'folders',
      folderWithUserBParentId,
      clientA.from('folders').insert({
        id: folderWithUserBParentId,
        user_id: userAId,
        parent_id: seededFolderId,
        name: `cross-tenant-parent-${Date.now()}`,
        color: '#abcdef',
        position: 3,
      }),
    )

    const selfParentFolderId = randomUUID()
    await expectRejectedWrite(
      'folders',
      selfParentFolderId,
      clientA.from('folders').insert({
        id: selfParentFolderId,
        user_id: userAId,
        parent_id: selfParentFolderId,
        name: `self-parent-${Date.now()}`,
        color: '#abcdef',
        position: 4,
      }),
    )
  })

  it('blocks mass assignment of sensitive profile and auth columns', async () => {
    if (!enabled) {
      return
    }

    const currentUser = await clientA
      .from('users')
      .select('email,status,login_count')
      .eq('id', userAId)
      .maybeSingle()

    expect(currentUser.error).toBeNull()
    expect(currentUser.data?.email).toBeTruthy()

    const allowedProfileUpdate = await clientA
      .from('users')
      .update({ full_name: `dbsec-profile-${Date.now()}` })
      .eq('id', userAId)
      .select('id,full_name')
      .maybeSingle()

    expect(allowedProfileUpdate.error).toBeNull()
    expect(allowedProfileUpdate.data?.id).toEqual(userAId)

    const sensitiveUpdate = await clientA
      .from('users')
      .update({
        email: currentUser.data!.email,
        status: currentUser.data!.status,
        login_count: currentUser.data!.login_count,
        key_hash: '0'.repeat(64),
        two_factor_enabled: true,
      })
      .eq('id', userAId)

    expect(sensitiveUpdate.error).not.toBeNull()
  })

  it('rejects direct writes to audit, backup, session and 2FA auxiliary tables', async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const credentialBackupId = randomUUID()
    await expectRejectedWrite(
      'credential_backups',
      credentialBackupId,
      clientA.from('credential_backups').insert({
        id: credentialBackupId,
        user_id: userAId,
        credential_id: seededUserACredentialId,
        enc_blob: 'client-forged-backup',
        backup_type: 'manual',
      }),
    )

    const vaultBackupId = randomUUID()
    await expectRejectedWrite(
      'vault_backups',
      vaultBackupId,
      clientA.from('vault_backups').insert({
        id: vaultBackupId,
        user_id: userAId,
        vault_id: seededUserAVaultId,
        encrypted_data: { encrypted: 'client-forged-vault-backup' },
        backup_type: 'manual',
      }),
    )

    const auditId = randomUUID()
    await expectRejectedWrite(
      'audit_logs',
      auditId,
      clientA.from('audit_logs').insert({
        id: auditId,
        user_id: userAId,
        event_type: 'password_changed',
        event_data: { forged: true },
      }),
    )

    const sessionId = randomUUID()
    await expectRejectedWrite(
      'user_sessions',
      sessionId,
      clientA.from('user_sessions').insert({
        id: sessionId,
        user_id: userAId,
        session_token: `client-forged-session-${randomUUID()}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    )

    const twoFactorAttemptId = randomUUID()
    await expectRejectedWrite(
      'two_factor_attempts',
      twoFactorAttemptId,
      clientA.from('two_factor_attempts').insert({
        id: twoFactorAttemptId,
        user_id: userAId,
        success: false,
        error_message: 'client-forged-attempt',
      }),
    )
  })

  it('enforces business rules for one active vault snapshot per user', async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const duplicateCredentialVaultId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      duplicateCredentialVaultId,
      clientA.from('credentials').insert({
        id: duplicateCredentialVaultId,
        user_id: userAId,
        title: 'duplicate-active-vault',
        encrypted_password: 'cipher-a-duplicate',
        enc_blob: 'cipher-a-duplicate',
        data_hash: 'f'.repeat(64),
        version: 1,
      }),
    )

    const duplicateVaultId = randomUUID()
    await expectRejectedWrite(
      'vaults',
      duplicateVaultId,
      clientA.from('vaults').insert({
        id: duplicateVaultId,
        user_id: userAId,
        encrypted_data: { encrypted: 'duplicate-vault' },
        data_hash: '1'.repeat(64),
        version: 1,
      }),
    )
  })

  it('enforces payload size and data format constraints against direct API writes', async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const invalidHashCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      invalidHashCredentialId,
      clientA.from('credentials').insert({
        id: invalidHashCredentialId,
        user_id: userAId,
        title: 'invalid-hash',
        encrypted_password: 'cipher-a',
        data_hash: 'not-a-hex-sha256',
      }),
    )

    const oversizedCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      oversizedCredentialId,
      clientA.from('credentials').insert({
        id: oversizedCredentialId,
        user_id: userAId,
        title: 'oversized-password',
        encrypted_password: 'x'.repeat(200001),
      }),
    )

    const emptyTitleCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      emptyTitleCredentialId,
      clientA.from('credentials').insert({
        id: emptyTitleCredentialId,
        user_id: userAId,
        title: '   ',
        encrypted_password: 'cipher-a',
      }),
    )

    const invalidVaultHash = await clientA
      .from('vaults')
      .update({ data_hash: 'not-a-hex-sha256' })
      .eq('id', seededUserAVaultId)

    expect(invalidVaultHash.error).not.toBeNull()

    const oversizedVaultPayload = await clientA
      .from('vaults')
      .update({ encrypted_data: { encrypted: 'x'.repeat(1500001) } })
      .eq('id', seededUserAVaultId)

    expect(oversizedVaultPayload.error).not.toBeNull()
  })

  it('enforces bounds on extended credential, folder, category and settings fields', async () => {
    if (!enabled || !serviceRoleKey) {
      return
    }

    const oversizedCardCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      oversizedCardCredentialId,
      clientA.from('credentials').insert({
        id: oversizedCardCredentialId,
        user_id: userAId,
        title: 'oversized-card-field',
        encrypted_password: 'cipher-a',
        type: 'card',
        card_number: 'x'.repeat(2001),
      }),
    )

    const oversizedTotpCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      oversizedTotpCredentialId,
      clientA.from('credentials').insert({
        id: oversizedTotpCredentialId,
        user_id: userAId,
        title: 'oversized-totp-field',
        encrypted_password: 'cipher-a',
        totp_secret: 'x'.repeat(200001),
      }),
    )

    const oversizedUrisCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      oversizedUrisCredentialId,
      clientA.from('credentials').insert({
        id: oversizedUrisCredentialId,
        user_id: userAId,
        title: 'oversized-uris-field',
        encrypted_password: 'cipher-a',
        uris: ['x'.repeat(50001)],
      }),
    )

    const trackingPixelWebsiteCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      trackingPixelWebsiteCredentialId,
      clientA.from('credentials').insert({
        id: trackingPixelWebsiteCredentialId,
        user_id: userAId,
        title: 'tracking-pixel-url',
        encrypted_password: 'cipher-a',
        website: 'https://attacker.example/pixel.png',
      }),
    )

    const queryTrackingUriCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      queryTrackingUriCredentialId,
      clientA.from('credentials').insert({
        id: queryTrackingUriCredentialId,
        user_id: userAId,
        title: 'query-tracking-uri',
        encrypted_password: 'cipher-a',
        uris: ['https://example.com/login?tracking=attacker'],
      }),
    )

    const privateNetworkUriCredentialId = randomUUID()
    await expectRejectedWrite(
      'credentials',
      privateNetworkUriCredentialId,
      clientA.from('credentials').insert({
        id: privateNetworkUriCredentialId,
        user_id: userAId,
        title: 'private-network-uri',
        encrypted_password: 'cipher-a',
        uris: ['https://127.0.0.1/admin'],
      }),
    )

    const invalidFolderId = randomUUID()
    await expectRejectedWrite(
      'folders',
      invalidFolderId,
      clientA.from('folders').insert({
        id: invalidFolderId,
        user_id: userAId,
        name: '   ',
        color: 'not-a-color',
        icon: 'x'.repeat(65),
        position: -1,
      }),
    )

    const invalidCategoryId = randomUUID()
    await expectRejectedWrite(
      'categories',
      invalidCategoryId,
      clientA.from('categories').insert({
        id: invalidCategoryId,
        user_id: userAId,
        name: '   ',
        color: 'not-a-color',
        icon: 'x'.repeat(65),
      }),
    )

    const invalidSettings = await clientA
      .from('user_settings')
      .update({
        session_timeout: 121,
        clipboard_timeout: 301,
        default_length: 129,
        theme: 'script',
        language: 'xx-XX',
      })
      .eq('user_id', userAId)

    expect(invalidSettings.error).not.toBeNull()
  })

  it('rejects direct RPC calls to internal trigger functions', async () => {
    if (!enabled) {
      return
    }

    const internalFunctions = [
      'create_credential_backup',
      'create_default_user_settings',
      'ensure_credential_folder_owner',
      'ensure_folder_parent_owner',
      'update_updated_at_column',
    ]

    for (const functionName of internalFunctions) {
      const { error } = await clientA.rpc(functionName)
      expect(error).not.toBeNull()
      expectSafeAuthorizationError(error?.message)
    }
  })
})
