import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomBytes, randomUUID, pbkdf2Sync, createHash, webcrypto } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'backend/package.json'))
const config = require('dotenv').parse(fs.readFileSync(path.join(root, 'backend/.env.staging.local')))
const ref = 'xxynxmktvonnldokhyem'
if (config.SUPABASE_URL !== `https://${ref}.supabase.co` || config.APPSEC_STAGING_PROJECT_REF !== ref) throw new Error('Dedicated staging only')
const { createClient } = require('@supabase/supabase-js')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, options)
const target = path.join(root, '.staging-work/iphone-test-account.json')
const mode = process.argv[2]

if (mode === 'delete') {
  const saved = JSON.parse(fs.readFileSync(target, 'utf8'))
  if (saved.projectRef !== ref || !/^native-device-[0-9a-f-]+@example\.test$/.test(saved.email)) throw new Error('Unexpected test fixture')
  const found = await admin.auth.admin.getUserById(saved.id)
  if (found.error || found.data.user?.email !== saved.email) throw new Error('Fixture does not match the Auth user; refusing deletion')
  const deleted = await admin.auth.admin.deleteUser(saved.id)
  if (deleted.error) throw new Error('Test account cleanup failed')
  fs.unlinkSync(target)
  console.log('Synthetic iPhone account and local credential fixture removed.')
} else if (mode === 'create') {
  if (fs.existsSync(target)) throw new Error('An iPhone fixture already exists; delete it explicitly before creating another')
  const { argon2id } = require('hash-wasm')
  const email = `native-device-${randomUUID()}@example.test`
  const loginPassword = `Synthetic-${randomBytes(24).toString('base64url')}!Aa1`
  const masterPassword = `Native-Master-${randomBytes(24).toString('base64url')}!Aa1`
  const salt = randomBytes(32)
  const prehash = pbkdf2Sync(masterPassword, salt.subarray(0, 16), 100000, 32, 'sha256')
  const rawKey = await argon2id({ password: prehash.toString('base64') + masterPassword, salt,
    iterations: 3, parallelism: 4, memorySize: 65536, hashLength: 32, outputType: 'binary' })
  let id
  let retained = false
  try {
    const created = await admin.auth.admin.createUser({ email, password: loginPassword, email_confirm: true })
    if (created.error || !created.data.user) throw new Error('Synthetic iPhone account creation failed')
    id = created.data.user.id
    const client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, options)
    const signedIn = await client.auth.signInWithPassword({ email, password: loginPassword })
    if (signedIn.error || !signedIn.data.session) throw new Error('Synthetic fixture sign-in failed')
    const call = async (route, method, body, expected) => {
      const response = await fetch(`https://safebox-backend-staging.vercel.app/api/${route}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signedIn.data.session.access_token}` },
        body: JSON.stringify(body),
      })
      if (response.status !== expected) throw new Error(`Synthetic fixture setup failed (${response.status})`)
    }
    await call('auth/crypto-profile', 'PUT', {
      kdfSalt: salt.toString('base64'), keyHash: createHash('sha256').update(rawKey).digest('base64'),
      kdfParams: { algorithm: 'argon2id', memorySize: 65536, iterations: 3, parallelism: 4, hashLength: 32 },
    }, 200)
    const credentialPassword = `Fictitious-${randomBytes(12).toString('base64url')}!`
    const plaintext = JSON.stringify([{ id: randomUUID(), userId: id, title: 'Credencial ficticia de staging',
      username: 'usuario-ficticio', encryptedPassword: credentialPassword, website: 'https://example.test',
      notes: 'Somente teste. Nao inserir dados reais.', itemType: 'credential', isFavorite: false, isHidden: false }])
    const key = await webcrypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
    const nonce = randomBytes(12)
    const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, Buffer.from(plaintext))
    const encryptedData = JSON.stringify({ version: 'vault-snapshot-v2', nonce: nonce.toString('base64'), encrypted: Buffer.from(encrypted).toString('base64') })
    await call('vault', 'POST', { encryptedData, dataHash: createHash('sha256').update(encryptedData).digest('hex') }, 201)
    await client.auth.signOut({ scope: 'local' })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify({ projectRef: ref, id, email, loginPassword, masterPassword,
      credentialPassword, createdAt: new Date().toISOString(),
      reviewAfter: new Date(Date.now() + 7 * 86400000).toISOString(),
      cleanup: 'node scripts/staging/device-account.mjs delete', onlySyntheticData: true }, null, 2) + '\n', { mode: 0o600 })
    retained = true
    console.log(`Synthetic iPhone fixture ready. Credentials are only in ignored ${target}; never upload this file.`)
  } finally {
    if (id && !retained) {
      const removed = await admin.auth.admin.deleteUser(id)
      if (removed.error) console.error('Synthetic setup rollback failed; check native-device accounts in staging.')
    }
  }
} else {
  throw new Error('Use create or delete. Creates a persistent synthetic account for manual device testing; no production access.')
}
