import http, { type Server } from 'http'
import type { AddressInfo } from 'net'
import type { Express } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomUUID } from 'crypto'

const enabled = process.env['RUN_STAGING_API_INTEGRATION'] === '1'
const suite = enabled ? describe : describe.skip

suite('Real backend and Supabase staging contract (no database mocks)', () => {
  let app: Express
  let admin: SupabaseClient
  let server: Server
  let baseURL: string
  const users: string[] = []
  const tokens: string[] = []
  const encryptedData = randomBytes(96).toString('base64')
  const dataHash = createHash('sha256').update(encryptedData).digest('hex')

  const call = async (method: string, route: string, status: number, token?: string, body?: unknown) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const response = await fetch(`${baseURL}${route}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const payload = await response.json() as any
    expect(response.status).toBe(status)
    return payload
  }

  beforeAll(async () => {
    const url = process.env['SUPABASE_URL']
    if (url !== 'https://xxynxmktvonnldokhyem.supabase.co') throw new Error('Staging only')
    admin = createClient(url, process.env['SUPABASE_SERVICE_ROLE_KEY']!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    app = (await import('../index')).app
    server = http.createServer(app)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    for (const name of ['a', 'b']) {
      const email = `api-${name}-${randomUUID()}@example.test`
      const password = `Synthetic-${randomUUID()}!Aa1`
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (created.error || !created.data.user) throw new Error('Failed to create synthetic API test user')
      users.push(created.data.user.id)
      const client = createClient(url, process.env['SUPABASE_ANON_KEY']!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const signedIn = await client.auth.signInWithPassword({ email, password })
      if (signedIn.error || !signedIn.data.session) throw new Error('Failed staging sign-in')
      tokens.push(signedIn.data.session.access_token)
    }
  }, 45000)

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    for (const id of users) {
      const result = await admin.auth.admin.deleteUser(id)
      if (result.error) throw new Error('Synthetic API test user cleanup failed')
    }
  }, 15000)

  test('health checks the real staging database', async () => {
    const result = await call('GET', '/health', 200)
    expect(result.checks.database).toBe(true)
  })

  test('missing and invalid sessions are rejected', async () => {
    await call('GET', '/api/vault', 401)
    await call('GET', '/api/vault', 403, 'synthetic-invalid-token')
  })

  test('user A creates and reads only their own opaque encrypted snapshot', async () => {
    const created = await call('POST', '/api/vault', 201, tokens[0], { encryptedData, dataHash })
    expect(created.data.version).toBe(1)
    const own = await call('GET', '/api/vault', 200, tokens[0])
    expect(own.data.encryptedData).toBe(encryptedData)
    const other = await call('GET', '/api/vault', 200, tokens[1])
    expect(other.data).toBeNull()
  })

  test('extra ownership fields and incorrect hashes fail without mutation', async () => {
    await call('PUT', '/api/vault', 400, tokens[0], { encryptedData, dataHash, expectedVersion: 1, userId: users[1] })
    await call('PUT', '/api/vault', 400, tokens[0], { encryptedData, dataHash: '0'.repeat(64), expectedVersion: 1 })
  })

  test('versioned update succeeds and stale retry returns conflict', async () => {
    const updated = await call('PUT', '/api/vault', 200, tokens[0], { encryptedData, dataHash, expectedVersion: 1 })
    expect(updated.data.version).toBe(2)
    await call('PUT', '/api/vault', 409, tokens[0], { encryptedData, dataHash, expectedVersion: 1 })
  })

  test('backup works and another user cannot restore it', async () => {
    const backup = await call('POST', '/api/vault/backup', 201, tokens[0], {})
    expect(backup.data.id).toBeTruthy()
    await call('POST', `/api/vault/restore/${backup.data.id}`, 404, tokens[1], {})
  })
})
