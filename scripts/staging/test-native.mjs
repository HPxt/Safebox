import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomUUID, randomBytes, createHash, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'backend/package.json'))
const config = require('dotenv').parse(fs.readFileSync(path.join(root, 'backend/.env.staging.local')))
if (config.SUPABASE_URL !== 'https://xxynxmktvonnldokhyem.supabase.co' || config.APPSEC_STAGING_PROJECT_REF !== 'xxynxmktvonnldokhyem') {
  throw new Error('Dedicated staging only')
}
const { createClient } = require('@supabase/supabase-js')
const authOptions = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, authOptions)
const vector = JSON.parse(fs.readFileSync(path.join(root, 'ios/SafeBoxCore/Tests/SafeBoxCryptoTests/Fixtures/test-vectors.json'))).kdfVectors[0]
const users = []
const fixture = path.join(root, '.staging-work', `native-${randomUUID()}.json`)
let status = 1
try {
  for (const name of ['a', 'b']) {
    const email = `native-${name}-${randomUUID()}@example.test`
    const password = `Synthetic-${randomUUID()}!Aa1`
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error || !created.data.user) throw new Error('Synthetic native test user creation failed')
    users.push({ id: created.data.user.id, email, password })
  }
  const client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, authOptions)
  const signedIn = await client.auth.signInWithPassword(users[0])
  if (signedIn.error || !signedIn.data.session) throw new Error('Synthetic profile setup login failed')
  const { level, ...legacyParams } = vector.kdfParams
  const response = await fetch('https://safebox-backend-staging.vercel.app/api/auth/crypto-profile', {
    method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signedIn.data.session.access_token}` },
    body: JSON.stringify({ kdfSalt: vector.saltBase64, kdfParams: legacyParams, keyHash: vector.keyHashBase64 }),
  })
  if (response.status !== 200) throw new Error(`Synthetic web-format crypto profile setup failed (${response.status})`)
  await client.auth.signOut({ scope: 'local' })
  fs.mkdirSync(path.dirname(fixture), { recursive: true })
  fs.writeFileSync(fixture, JSON.stringify({ users: users.map(({ email, password }) => ({ email, password })), masterPassword: vector.testPassphrase }), { mode: 0o600 })
  const env = { ...process.env, SAFEBOX_STAGING_FIXTURE: fixture }
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'JWT_SECRET', 'TWO_FACTOR_ENCRYPTION_SECRET', 'DATABASE_URL', 'REDIS_URL']) delete env[key]
  const result = spawnSync('swift', ['test', '--package-path', 'ios', '--configuration', 'release', '--filter', 'StagingFlowTests'], {
    cwd: root, env, stdio: 'inherit', timeout: 900000,
  })
  if (result.error) console.error(`Native test runner failed: ${result.error.code ?? 'unknown'}`)
  status = result.status ?? 1
  if (status === 0) {
    const login = await client.auth.signInWithPassword(users[0])
    if (login.error || !login.data.session) throw new Error('WebCrypto roundtrip sign-in failed')
    const call = async (method, body) => {
      const response = await fetch('https://safebox-backend-staging.vercel.app/api/vault', {
        method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${login.data.session.access_token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (response.status !== 200) throw new Error(`WebCrypto roundtrip API failed (${response.status})`)
      return (await response.json()).data
    }
    const record = await call('GET')
    const envelope = JSON.parse(record.encryptedData)
    if (createHash('sha256').update(record.encryptedData).digest('hex') !== record.dataHash) throw new Error('WebCrypto received a mismatching hash')
    const key = await webcrypto.subtle.importKey('raw', Buffer.from(vector.derivedKeyHex, 'hex'), 'AES-GCM', false, ['encrypt', 'decrypt'])
    const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(envelope.nonce, 'base64') }, key, Buffer.from(envelope.encrypted, 'base64'))
    const items = JSON.parse(Buffer.from(decrypted).toString('utf8'))
    if (items[0]?.encryptedPassword !== 'Synthetic-Vault-Only!' || record.version !== 2) throw new Error('Swift to WebCrypto roundtrip mismatch')
    console.log('CHECK: Node WebCrypto successfully decrypted the native Swift ciphertext')
    items[0].notes = 'WebCrypto synthetic roundtrip'
    const nonce = randomBytes(12)
    const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, Buffer.from(JSON.stringify(items)))
    const encryptedData = JSON.stringify({ version: 'vault-snapshot-v2', nonce: nonce.toString('base64'), encrypted: Buffer.from(encrypted).toString('base64') })
    await call('PUT', { encryptedData, dataHash: createHash('sha256').update(encryptedData).digest('hex'), expectedVersion: 2 })
    await client.auth.signOut({ scope: 'local' })
    const reopened = spawnSync('swift', ['test', '--package-path', 'ios', '--configuration', 'release', '--skip-build', '--filter', 'testNativeReadsWebCryptoWrite'], {
      cwd: root, env: { ...env, SAFEBOX_NATIVE_FLOW_PHASE: 'web-readback' }, stdio: 'inherit', timeout: 120000,
    })
    status = reopened.status ?? 1
  }
} catch (error) {
  status = 1
  console.error(error.message)
} finally {
  if (fs.existsSync(fixture)) fs.unlinkSync(fixture)
  let removed = 0
  for (const user of users) {
    const result = await admin.auth.admin.deleteUser(user.id)
    if (result.error) { status = 1; console.error('Synthetic native test user cleanup failed') }
    else removed++
  }
  console.log(`Native staging fixture removed; synthetic test accounts removed: ${removed}/${users.length}.`)
}
process.exitCode = status
