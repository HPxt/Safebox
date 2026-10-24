import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ref = 'xxynxmktvonnldokhyem'
const url = `https://${ref}.supabase.co`
const publicKey = 'sb_publishable_4_j0-3MA5vPNhLbAIsuwzw_UA1SjRg3'
const cli = path.join(root, 'node_modules/supabase/bin', process.platform === 'win32' ? 'supabase.exe' : 'supabase')
const result = spawnSync(cli, ['projects', 'api-keys', '--project-ref', ref, '--output', 'json'], { cwd: root, encoding: 'utf8' })
if (result.status !== 0) throw new Error('Could not obtain staging keys from the authenticated CLI')
const keys = JSON.parse(result.stdout)
const privileged = keys.find(key => key.name === 'service_role')?.api_key
if (!privileged) throw new Error('No staging service role available; no configuration was written')
const values = {
  NODE_ENV: 'development', PORT: '3101', HOST: '127.0.0.1',
  SUPABASE_URL: url, SUPABASE_ANON_KEY: publicKey, SUPABASE_SERVICE_ROLE_KEY: privileged,
  APPSEC_STAGING_PROJECT_REF: ref,
  JWT_SECRET: randomBytes(48).toString('hex'),
  TWO_FACTOR_ENCRYPTION_SECRET: randomBytes(48).toString('hex'),
  ENABLE_AUDIT_LOGS: 'false', ENABLE_EMAIL_NOTIFICATIONS: 'false',
  ENABLE_BACKUP_CLEANUP: 'false', ENABLE_MAINTENANCE_JOBS: 'false',
  ENABLE_RATE_LIMITING: 'true', ENABLE_LEGACY_BACKEND_AUTH: 'false',
  CORS_ORIGIN: 'http://localhost:3000', LOG_LEVEL: 'warn',
}
const target = path.join(root, 'backend/.env.staging.local')
if (fs.existsSync(target)) throw new Error('Staging configuration already exists; refusing to replace encryption secrets')
fs.writeFileSync(target, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 })
console.log('Staging backend configuration written to ignored backend/.env.staging.local. No credentials printed.')
