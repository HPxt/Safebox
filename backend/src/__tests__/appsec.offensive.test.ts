import http, { type Server } from 'http'
import { type AddressInfo } from 'net'
import { type Express } from 'express'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

type TestUser = {
  id: string
  email: string
  app_metadata?: Record<string, unknown>
}

type QueryState = {
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  filters: Array<{ column: string, value: unknown }>
  payload?: unknown
}

const userACategoryId = '00000000-0000-4000-8000-0000000000a1'
const userBCategoryId = '00000000-0000-4000-8000-0000000000b2'
const adminCategoryId = '00000000-0000-4000-8000-0000000000ad'
const userASessionId = '00000000-0000-4000-8000-0000000000c1'
const backupId = '00000000-0000-4000-8000-0000000000d1'
const validDataHash = 'a'.repeat(64)

const mockGetUser = jest.fn()
const mockCreateSupabaseUserClient = jest.fn()
const mockPrivilegedFrom = jest.fn()
const mockPrivilegedRpcLogAuditEvent = jest.fn()
const mockLogPrivilegedAuditEvent = jest.fn()

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  logoutAllSessions: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  deleteAccount: jest.fn(),
}

const mockVaultService = {
  getCurrentVault: jest.fn(),
  createVault: jest.fn(),
  updateVault: jest.fn(),
  deleteVault: jest.fn(),
  getStats: jest.fn(),
  createBackup: jest.fn(),
  listBackups: jest.fn(),
  restoreBackup: jest.fn(),
  exportVault: jest.fn(),
}

const mockVaultSnapshotServiceConstructor = jest.fn(() => mockVaultService)
const mockQueryStates: QueryState[] = []

const usersByToken: Record<string, TestUser> = {
  'token-userA': {
    id: 'user-a',
    email: 'userA@appsec.test',
  },
  'token-userB': {
    id: 'user-b',
    email: 'userB@appsec.test',
  },
  'token-admin': {
    id: 'admin',
    email: 'admin@appsec.test',
    app_metadata: { role: 'admin' },
  },
}

jest.mock('@/config/database', () => ({
  testDatabaseConnection: jest.fn().mockResolvedValue(true),
  createSupabaseAuthClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
  createSupabaseUserClient: (...args: unknown[]) => mockCreateSupabaseUserClient(...args),
}))

jest.mock('@/config/privilegedDb', () => ({
  getPrivilegedSupabase: () => ({
    from: mockPrivilegedFrom,
  }),
  privilegedRpcLogAuditEvent: (...args: unknown[]) => mockPrivilegedRpcLogAuditEvent(...args),
}))

jest.mock('@/services/auth.service', () => ({
  authService: mockAuthService,
}))

jest.mock('@/domain/vault/VaultSnapshotRepository', () => ({
  VaultSnapshotRepository: jest.fn(),
}))

jest.mock('@/domain/vault/VaultBackupRepository', () => ({
  VaultBackupRepository: jest.fn(),
}))

jest.mock('@/domain/vault/VaultSnapshotService', () => ({
  VaultSnapshotService: mockVaultSnapshotServiceConstructor,
}))

jest.mock('@/security/audit', () => ({
  logPrivilegedAuditEvent: (...args: unknown[]) => mockLogPrivilegedAuditEvent(...args),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}))

let app: Express
let requireAdmin: typeof import('@/middleware/auth.middleware').requireAdmin

const getFilterValue = (state: QueryState, column: string): unknown => {
  return state.filters.find(filter => filter.column === column)?.value
}

const settingsRowForUser = (userId: string) => ({
  user_id: userId,
  session_timeout: 15,
  auto_lock: true,
  require_confirm: true,
  show_hidden_credentials: false,
  clipboard_timeout: 30,
  default_length: 20,
  use_lowercase: true,
  use_uppercase: true,
  use_numbers: true,
  use_symbols: true,
  exclude_ambiguous: false,
  theme: 'system',
  language: 'pt-BR',
  compact_mode: false,
  show_strength: true,
  created_at: '2026-04-28T00:00:00.000Z',
  updated_at: '2026-04-28T00:00:00.000Z',
})

const resolveQuery = (state: QueryState) => {
  const userId = getFilterValue(state, 'user_id')
  const id = getFilterValue(state, 'id')

  if (state.table === 'categories') {
    if (state.operation === 'select') {
      const rows = {
        'user-a': [{ id: userACategoryId, user_id: 'user-a', name: 'User A category', color: '#112233', icon: 'folder' }],
        'user-b': [{ id: userBCategoryId, user_id: 'user-b', name: 'User B category', color: '#445566', icon: 'folder' }],
        admin: [{ id: adminCategoryId, user_id: 'admin', name: 'Admin category', color: '#778899', icon: 'folder' }],
      }
      return { data: rows[userId as keyof typeof rows] ?? [], error: null }
    }

    if (state.operation === 'insert') {
      return {
        data: {
          id: userACategoryId,
          user_id: userId,
          name: 'Created category',
          color: '#112233',
          icon: 'folder',
        },
        error: null,
      }
    }

    if (state.operation === 'update' || state.operation === 'delete') {
      if (userId === 'user-a' && id === userACategoryId) {
        return {
          data: { id: userACategoryId, user_id: 'user-a', name: 'Updated category', color: '#112233', icon: 'folder' },
          error: null,
        }
      }

      if (userId === 'admin' && id === adminCategoryId) {
        return {
          data: { id: adminCategoryId, user_id: 'admin', name: 'Admin category', color: '#778899', icon: 'folder' },
          error: null,
        }
      }

      return { data: null, error: null }
    }
  }

  if (state.table === 'user_settings') {
    if (state.operation === 'select') {
      return { data: settingsRowForUser(userId as string), error: null }
    }

    if (state.operation === 'upsert') {
      const payload = state.payload as { user_id?: string }
      return { data: settingsRowForUser(payload.user_id ?? 'unknown'), error: null }
    }
  }

  if (state.table === 'audit_logs') {
    return { data: [], error: null, count: 0 }
  }

  if (state.table === 'user_sessions') {
    if (state.operation === 'delete' || state.operation === 'update') {
      return id === userASessionId && userId === 'user-a'
        ? { data: { id: userASessionId }, error: null }
        : { data: null, error: null }
    }

    return { data: [], error: null }
  }

  if (state.table === 'users') {
    return {
      data: {
        kdf_salt: 'A'.repeat(44),
        kdf_params: {
          algorithm: 'argon2id',
          memorySize: 65536,
          iterations: 3,
          parallelism: 1,
          hashLength: 32,
        },
        key_hash: 'B'.repeat(44),
        two_factor_enabled: false,
      },
      error: null,
    }
  }

  return { data: null, error: null }
}

const createQueryBuilder = (table: string) => {
  const state: QueryState = {
    table,
    operation: 'select',
    filters: [],
  }
  mockQueryStates.push(state)

  const builder: Record<string, jest.Mock | unknown> = {}
  const resolve = () => Promise.resolve(resolveQuery(state))

  builder['select'] = jest.fn(() => {
    state.operation = state.operation === 'select' ? 'select' : state.operation
    return builder
  })
  builder['insert'] = jest.fn((payload: unknown) => {
    state.operation = 'insert'
    state.payload = payload
    return builder
  })
  builder['update'] = jest.fn((payload: unknown) => {
    state.operation = 'update'
    state.payload = payload
    return builder
  })
  builder['upsert'] = jest.fn((payload: unknown) => {
    state.operation = 'upsert'
    state.payload = payload
    return builder
  })
  builder['delete'] = jest.fn(() => {
    state.operation = 'delete'
    return builder
  })
  builder['eq'] = jest.fn((column: string, value: unknown) => {
    state.filters.push({ column, value })
    return builder
  })
  builder['order'] = jest.fn(() => builder)
  builder['range'] = jest.fn(() => builder)
  builder['maybeSingle'] = jest.fn(resolve)
  builder['then'] = (onFulfilled: unknown, onRejected: unknown) => resolve().then(
    onFulfilled as ((value: unknown) => unknown) | undefined,
    onRejected as ((reason: unknown) => unknown) | undefined,
  )
  builder['catch'] = (onRejected: unknown) => resolve().catch(onRejected as ((reason: unknown) => unknown) | undefined)

  return builder
}

const configureDefaultMocks = () => {
  mockQueryStates.length = 0

  mockGetUser.mockImplementation(async (token: string) => {
    const user = usersByToken[token]

    if (!user || token === 'expired-token') {
      return {
        data: { user: null },
        error: new Error('invalid or expired token'),
      }
    }

    return {
      data: { user },
      error: null,
    }
  })

  mockCreateSupabaseUserClient.mockImplementation(() => ({
    from: (table: string) => createQueryBuilder(table),
  }))
  mockPrivilegedFrom.mockImplementation((table: string) => createQueryBuilder(table))
  mockPrivilegedRpcLogAuditEvent.mockResolvedValue({ data: null, error: null })
  mockLogPrivilegedAuditEvent.mockResolvedValue(undefined)

  mockAuthService.register.mockResolvedValue({ user: { id: 'registered-user' } })
  mockAuthService.login.mockResolvedValue({ token: 'legacy-token' })
  mockAuthService.logoutAllSessions.mockResolvedValue(undefined)
  mockAuthService.getProfile.mockImplementation(async (userId: string) => ({ id: userId, email: `${userId}@appsec.test` }))
  mockAuthService.updateProfile.mockImplementation(async (userId: string, updates: Record<string, unknown>) => ({
    id: userId,
    ...updates,
  }))
  mockAuthService.changePassword.mockResolvedValue(undefined)
  mockAuthService.deleteAccount.mockResolvedValue(undefined)

  mockVaultService.getCurrentVault.mockImplementation(async (userId: string) => ({
    id: `vault-${userId}`,
    encryptedData: `cipher-${userId}`,
    dataHash: validDataHash,
    version: 1,
    createdAt: '2026-04-28T00:00:00.000Z',
    updatedAt: '2026-04-28T00:00:00.000Z',
    storageMode: 'credentials',
  }))
  mockVaultService.createVault.mockImplementation(async (userId: string, payload: Record<string, unknown>) => ({
    id: `vault-${userId}`,
    ...payload,
    version: 1,
    storageMode: 'credentials',
  }))
  mockVaultService.updateVault.mockImplementation(async (userId: string, payload: Record<string, unknown>) => ({
    id: `vault-${userId}`,
    ...payload,
    version: 2,
    storageMode: 'credentials',
  }))
  mockVaultService.deleteVault.mockResolvedValue({ version: 1, storageMode: 'credentials' })
  mockVaultService.getStats.mockResolvedValue({ itemCount: 0, version: 1 })
  mockVaultService.createBackup.mockResolvedValue({
    vault: { version: 1, storageMode: 'credentials' },
    backup: { id: backupId, version: 1 },
  })
  mockVaultService.listBackups.mockResolvedValue([{ id: backupId, version: 1 }])
  mockVaultService.restoreBackup.mockImplementation(async (userId: string) => ({
    id: `vault-${userId}`,
    encryptedData: `restored-${userId}`,
    dataHash: validDataHash,
    version: 2,
    storageMode: 'credentials',
  }))
  mockVaultService.exportVault.mockResolvedValue({
    vault: { id: 'vault-user-a', encryptedData: 'cipher-user-a', dataHash: validDataHash, version: 1 },
    backups: [],
    exportedAt: '2026-04-28T00:00:00.000Z',
  })
}

const validVaultCreateBody = () => ({
  encryptedData: 'ciphertext',
  dataHash: validDataHash,
})

const validVaultUpdateBody = () => ({
  ...validVaultCreateBody(),
  expectedVersion: 1,
})

const validCryptoProfileBody = () => ({
  kdfSalt: 'A'.repeat(44),
  kdfParams: {
    algorithm: 'argon2id',
    memorySize: 65536,
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
  },
  keyHash: 'B'.repeat(44),
  currentKeyHash: 'B'.repeat(44),
})

const expectNoSensitiveLeak = (body: string) => {
  expect(body).not.toMatch(/token-userA|token-userB|token-admin|super-secret|service_role|JWT_SECRET/i)
  expect(body).not.toMatch(/select \* from|PostgresError|SQLSTATE/i)
  expect(body).not.toMatch(/C:\\Users\\|backend\\src|\.ts:\d+|stack/i)
}

describe('AppSec offensive request battery', () => {
  let server: Server
  let baseUrl: string

  const request = async (
    method: HttpMethod,
    path: string,
    options: {
      token?: string
      body?: unknown
      rawBody?: string
      headers?: Record<string, string>
      userAgent?: string
    } = {},
  ) => {
    const headers: Record<string, string> = {
      'User-Agent': options.userAgent ?? `SafeBox-AppSec-Test/${expect.getState().currentTestName ?? 'unknown'}`,
      ...(options.headers ?? {}),
    }

    let body: string | undefined
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }

    if (options.rawBody !== undefined) {
      body = options.rawBody
    } else if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
      body = JSON.stringify(options.body)
    }

    const requestInit: RequestInit = {
      method,
      headers,
    }

    if (body !== undefined) {
      requestInit.body = body
    }

    const response = await fetch(`${baseUrl}${path}`, requestInit)
    const text = await response.text()
    const json = text ? JSON.parse(text) as unknown : undefined

    return {
      status: response.status,
      text,
      json: json as any,
      headers: response.headers,
    }
  }

  beforeAll(async () => {
    const appModule = await import('@/index')
    const authMiddleware = await import('@/middleware/auth.middleware')
    app = appModule.app
    requireAdmin = authMiddleware.requireAdmin

    await new Promise<void>((resolve) => {
      server = http.createServer(app)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    configureDefaultMocks()
  })

  const protectedRoutes: Array<{ method: HttpMethod, path: string, body?: unknown }> = [
    { method: 'POST', path: '/api/auth/logout' },
    { method: 'GET', path: '/api/auth/profile' },
    { method: 'PUT', path: '/api/auth/profile', body: { fullName: 'User A' } },
    { method: 'GET', path: '/api/auth/crypto-profile' },
    { method: 'PUT', path: '/api/auth/crypto-profile', body: validCryptoProfileBody() },
    { method: 'POST', path: '/api/auth/change-password', body: { currentPassword: 'old', newPassword: 'NewPassword123!' } },
    { method: 'POST', path: '/api/auth/refresh-token' },
    { method: 'GET', path: '/api/auth/2fa/status' },
    { method: 'POST', path: '/api/auth/2fa/enable', body: { secret: 'A'.repeat(32), verificationCode: '123456', backupCodes: ['code-01', 'code-02', 'code-03', 'code-04'] } },
    { method: 'POST', path: '/api/auth/2fa/verify', body: { code: '123456' } },
    { method: 'POST', path: '/api/auth/2fa/disable' },
    { method: 'DELETE', path: '/api/auth/account' },
    { method: 'GET', path: '/api/vault' },
    { method: 'POST', path: '/api/vault', body: validVaultCreateBody() },
    { method: 'PUT', path: '/api/vault', body: validVaultUpdateBody() },
    { method: 'DELETE', path: '/api/vault', body: { expectedVersion: 1 } },
    { method: 'GET', path: '/api/vault/stats' },
    { method: 'POST', path: '/api/vault/backup' },
    { method: 'GET', path: '/api/vault/backups' },
    { method: 'POST', path: `/api/vault/restore/${backupId}`, body: { expectedVersion: 1 } },
    { method: 'GET', path: '/api/vault/export' },
    { method: 'GET', path: '/api/settings' },
    { method: 'PUT', path: '/api/settings', body: { security: { sessionTimeout: 15 } } },
    { method: 'GET', path: '/api/settings/categories' },
    { method: 'POST', path: '/api/settings/categories', body: { name: 'Personal', color: '#112233' } },
    { method: 'PUT', path: `/api/settings/categories/${userACategoryId}`, body: { name: 'Personal', color: '#112233' } },
    { method: 'DELETE', path: `/api/settings/categories/${userACategoryId}` },
    { method: 'GET', path: '/api/settings/audit-logs' },
    { method: 'GET', path: '/api/settings/sessions' },
    { method: 'DELETE', path: `/api/settings/sessions/${userASessionId}` },
  ]

  test.each(protectedRoutes)('blocks unauthenticated access to $method $path', async ({ method, path, body }) => {
    const response = await request(method, path, { body })

    expect(response.status).toBe(401)
    expect(response.json).toMatchObject({
      success: false,
      code: 'UNAUTHORIZED',
    })
    expectNoSensitiveLeak(response.text)
  })

  test.each([
    { token: 'invalid-token', expectedStatus: 403, expectedCode: 'FORBIDDEN' },
    { token: 'expired-token', expectedStatus: 403, expectedCode: 'FORBIDDEN' },
  ])('blocks $token on protected routes', async ({ token, expectedStatus, expectedCode }) => {
    const response = await request('GET', '/api/vault', { token })

    expect(response.status).toBe(expectedStatus)
    expect(response.json).toMatchObject({
      success: false,
      code: expectedCode,
    })
    expectNoSensitiveLeak(response.text)
  })

  test('rejects client-supplied userId, ownerId and tenantId on vault writes', async () => {
    const response = await request('POST', '/api/vault', {
      token: 'token-userA',
      body: {
        ...validVaultCreateBody(),
        userId: 'user-b',
        ownerId: 'user-b',
        tenantId: 'tenant-b',
      },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('VALIDATION_ERROR')
    expect(mockVaultService.createVault).not.toHaveBeenCalled()
    expectNoSensitiveLeak(response.text)
  })

  test('keeps category reads scoped to userA even when query params ask for userB', async () => {
    const response = await request('GET', '/api/settings/categories?user_id=user-b&tenantId=tenant-b', {
      token: 'token-userA',
    })

    expect(response.status).toBe(200)
    expect(response.json.data).toEqual([
      expect.objectContaining({ id: userACategoryId, user_id: 'user-a' }),
    ])
    expect(response.text).not.toContain(userBCategoryId)
    expect(mockQueryStates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'categories',
        filters: expect.arrayContaining([{ column: 'user_id', value: 'user-a' }]),
      }),
    ]))
  })

  test('prevents userA from updating userB category by IDOR', async () => {
    const response = await request('PUT', `/api/settings/categories/${userBCategoryId}`, {
      token: 'token-userA',
      body: { name: 'Takeover attempt', color: '#112233' },
    })

    expect(response.status).toBe(404)
    expect(response.json.code).toBe('NOT_FOUND')
    expect(mockQueryStates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'categories',
        operation: 'update',
        filters: expect.arrayContaining([
          { column: 'id', value: userBCategoryId },
          { column: 'user_id', value: 'user-a' },
        ]),
      }),
    ]))
    expectNoSensitiveLeak(response.text)
  })

  test('rejects mass assignment on profile updates', async () => {
    const response = await request('PUT', '/api/auth/profile', {
      token: 'token-userA',
      body: {
        fullName: 'User A',
        role: 'admin',
        isAdmin: true,
        status: 'active',
        emailVerified: true,
        userId: 'user-b',
      },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('VALIDATION_ERROR')
    expect(mockAuthService.updateProfile).not.toHaveBeenCalled()
  })

  test('rejects beacon-style avatar URLs on profile updates', async () => {
    const dirtyAvatarUrls = [
      'https://attacker.example/pixel.png',
      'https://example.com/avatar.svg',
      'https://example.com/profile?track=user-a',
      'https://127.0.0.1/admin',
      'javascript:alert(1)',
    ]

    for (const avatarUrl of dirtyAvatarUrls) {
      const response = await request('PUT', '/api/auth/profile', {
        token: 'token-userA',
        body: {
          fullName: 'User A',
          avatarUrl,
        },
      })

      expect(response.status).toBe(400)
      expect(response.json.code).toBe('VALIDATION_ERROR')
    }

    expect(mockAuthService.updateProfile).not.toHaveBeenCalled()
  })

  test('rejects mass assignment on crypto profile updates', async () => {
    const response = await request('PUT', '/api/auth/crypto-profile', {
      token: 'token-userA',
      body: {
        ...validCryptoProfileBody(),
        role: 'admin',
        isAdmin: true,
        status: 'active',
        emailVerified: true,
        ownerId: 'user-b',
      },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('VALIDATION_ERROR')
    expect(mockQueryStates.find(state => state.table === 'users')).toBeUndefined()
  })

  test('rejects extra nested fields in settings updates', async () => {
    const response = await request('PUT', '/api/settings', {
      token: 'token-userA',
      body: {
        security: {
          sessionTimeout: 15,
          isAdmin: true,
        },
      },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('VALIDATION_ERROR')
    expect(mockQueryStates.find(state => state.table === 'user_settings')).toBeUndefined()
  })

  test('rejects ownership fields on category creation', async () => {
    const response = await request('POST', '/api/settings/categories', {
      token: 'token-userA',
      body: {
        name: 'Injected category',
        color: '#112233',
        userId: 'user-b',
        ownerId: 'user-b',
        tenantId: 'tenant-b',
      },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('VALIDATION_ERROR')
    expect(mockQueryStates.find(state => state.table === 'categories')).toBeUndefined()
  })

  test('rejects malformed JSON bodies without leaking parser internals', async () => {
    const response = await request('POST', '/api/vault', {
      token: 'token-userA',
      rawBody: '{"encryptedData":',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status).toBe(400)
    expect(response.json).toMatchObject({
      success: false,
      code: 'BAD_REQUEST',
      error: 'Invalid request body',
    })
    expectNoSensitiveLeak(response.text)
  })

  test('returns a controlled 413 for oversized JSON payloads', async () => {
    const oversizedVaultPayload = JSON.stringify({
      ...validVaultCreateBody(),
      encryptedData: 'A'.repeat(2 * 1024 * 1024 + 1),
    })

    const response = await request('POST', '/api/vault', {
      token: 'token-userA',
      rawBody: oversizedVaultPayload,
      headers: { 'Content-Type': 'application/json' },
    })

    expect(response.status).toBe(413)
    expect(response.json).toMatchObject({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      error: 'Payload too large',
    })
    expect(mockVaultService.createVault).not.toHaveBeenCalled()
    expectNoSensitiveLeak(response.text)
  })

  test('rejects fake MIME uploads sent to JSON-only critical endpoints', async () => {
    const response = await request('POST', '/api/vault', {
      token: 'token-userA',
      rawBody: 'not-a-json-vault',
      headers: { 'Content-Type': 'image/png' },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('VALIDATION_ERROR')
    expect(mockVaultService.createVault).not.toHaveBeenCalled()
  })

  test('rejects out-of-range limit controls on sensitive list endpoints', async () => {
    const vaultBackups = await request('GET', '/api/vault/backups?limit=9999', {
      token: 'token-userA',
    })
    const auditLogs = await request('GET', '/api/settings/audit-logs?limit=9999', {
      token: 'token-userA',
    })

    expect(vaultBackups.status).toBe(400)
    expect(vaultBackups.json.code).toBe('VALIDATION_ERROR')
    expect(auditLogs.status).toBe(400)
    expect(auditLogs.json.code).toBe('VALIDATION_ERROR')
    expect(mockVaultService.listBackups).not.toHaveBeenCalled()
    expectNoSensitiveLeak(vaultBackups.text)
    expectNoSensitiveLeak(auditLogs.text)
  })

  test('scopes backup, restore and export flows to the authenticated user', async () => {
    const createBackup = await request('POST', '/api/vault/backup', {
      token: 'token-userA',
    })
    const listBackups = await request('GET', '/api/vault/backups?limit=10', {
      token: 'token-userA',
    })
    const restoreBackup = await request('POST', `/api/vault/restore/${backupId}`, {
      token: 'token-userA',
      body: {
        expectedVersion: 1,
        userId: 'user-b',
        ownerId: 'user-b',
        tenantId: 'tenant-b',
      },
    })
    const exportVault = await request('GET', '/api/vault/export?user_id=user-b&tenantId=tenant-b', {
      token: 'token-userA',
    })

    expect(createBackup.status).toBe(201)
    expect(listBackups.status).toBe(200)
    expect(restoreBackup.status).toBe(400)
    expect(restoreBackup.json.code).toBe('VALIDATION_ERROR')
    expect(exportVault.status).toBe(200)
    expect(exportVault.text).not.toContain('user-b')
    expect(mockVaultService.createBackup).toHaveBeenCalledWith('user-a')
    expect(mockVaultService.listBackups).toHaveBeenCalledWith('user-a', 10)
    expect(mockVaultService.restoreBackup).not.toHaveBeenCalled()
    expect(mockVaultService.exportVault).toHaveBeenCalledWith('user-a')
  })

  test('sets defensive API security headers', async () => {
    const response = await request('GET', '/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(response.headers.get('content-security-policy')).toContain("object-src 'none'")
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(response.headers.get('permissions-policy')).toContain('camera=()')
  })

  test('does not leak stack traces, SQL, paths, tokens or secrets on internal errors', async () => {
    mockAuthService.getProfile.mockRejectedValueOnce(
      new Error('select * from users where service_role_key=super-secret-token at C:\\Users\\KABUM\\Documents\\SafeBox\\Safebox-3\\backend\\src\\routes\\auth.routes.ts:1'),
    )

    const response = await request('GET', '/api/auth/profile', {
      token: 'token-userA',
    })

    expect(response.status).toBe(500)
    expect(response.json).toEqual({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    })
    expectNoSensitiveLeak(response.text)
  })

  test('rate limits repeated login attempts before backend auth logic is trusted', async () => {
    const statuses: number[] = []

    for (let index = 0; index < 6; index += 1) {
      const response = await request('POST', '/api/auth/login', {
        userAgent: 'SafeBox-AppSec-RateLimit/1',
        body: {
          email: 'userA@appsec.test',
          password: 'WrongPassword123!',
        },
      })
      statuses.push(response.status)
    }

    expect(statuses.slice(0, 5)).toEqual([410, 410, 410, 410, 410])
    expect(statuses[5]).toBe(429)
  })

  test('rate limits repeated 2FA verification attempts', async () => {
    const statuses: number[] = []

    for (let index = 0; index < 11; index += 1) {
      const response = await request('POST', '/api/auth/2fa/verify', {
        token: 'token-userA',
        userAgent: 'SafeBox-AppSec-2FA-RateLimit/1',
        body: { code: '000000' },
      })
      statuses.push(response.status)
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200))
    expect(statuses[10]).toBe(429)
  })

  test('does not let an admin-looking client token bypass resource ownership', async () => {
    const response = await request('PUT', `/api/settings/categories/${userACategoryId}`, {
      token: 'token-admin',
      body: { name: 'Admin takeover attempt', color: '#112233' },
    })

    expect(response.status).toBe(404)
    expect(response.json.code).toBe('NOT_FOUND')
    expect(mockQueryStates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'categories',
        operation: 'update',
        filters: expect.arrayContaining([
          { column: 'id', value: userACategoryId },
          { column: 'user_id', value: 'admin' },
        ]),
      }),
    ]))
  })

  test('keeps admin middleware fail-closed until explicit admin authorization is configured', async () => {
    const req = {
      user: {
        userId: 'admin',
        email: 'admin@appsec.test',
        sessionId: 'session-admin',
      },
    }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    }

    await requireAdmin(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Admin authorization is not configured',
    })
  })
})
