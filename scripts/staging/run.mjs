import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'backend/package.json'))
const dotenv = require('dotenv')
const config = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env.staging.local')))
if (config.SUPABASE_URL !== 'https://xxynxmktvonnldokhyem.supabase.co' || config.APPSEC_STAGING_PROJECT_REF !== 'xxynxmktvonnldokhyem') {
  throw new Error('Refusing to run against any project other than the dedicated staging project')
}
const mode = process.argv[2]
let args
const env = { ...process.env, ...config, REDIS_URL: '', DATABASE_URL: '' }
delete env.STAGING_API_BASE_URL
if (mode === 'test-db' || mode === 'test-api' || mode === 'test-api-https') {
  env.NODE_ENV = 'test'
  env.RUN_DB_SECURITY_INTEGRATION = '1'
  env.RUN_STAGING_API_INTEGRATION = mode !== 'test-db' ? '1' : '0'
  if (mode === 'test-api-https') env.STAGING_API_BASE_URL = 'https://safebox-backend-staging.vercel.app'
  args = [require.resolve('jest/bin/jest'), '--runInBand', '--testTimeout=45000', mode !== 'test-db'
    ? 'src/__tests__/staging-api.integration.test.ts'
    : 'src/__tests__/db-security.integration.test.ts']
} else if (mode === 'serve') {
  args = [require.resolve('tsx/cli'), 'src/index.ts']
} else {
  throw new Error('Use test-db, test-api, test-api-https or serve')
}
const result = spawnSync(process.execPath, args, { cwd: path.join(root, 'backend'), env, stdio: 'inherit' })
process.exit(result.status ?? 1)
