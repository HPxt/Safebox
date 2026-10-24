import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'backend/package.json'))
const config = require('dotenv').parse(fs.readFileSync(path.join(root, 'backend/.env.staging.local')))
const project = 'safebox-backend-staging'
const team = 'pxt77s-projects'
const target = path.join(root, '.staging-work/backend-deploy')
const mode = process.argv[2]
const cli = process.argv[3]
if (config.SUPABASE_URL !== 'https://xxynxmktvonnldokhyem.supabase.co' || config.APPSEC_STAGING_PROJECT_REF !== 'xxynxmktvonnldokhyem') {
  throw new Error('Refusing any Supabase project other than staging')
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options })
  if (result.status !== 0) throw new Error(`Command failed: ${command} (exit ${result.status})`)
  return result.stdout
}
function vercel(args, options = {}) {
  if (!cli || !fs.existsSync(cli)) throw new Error('Pass the installed official Vercel CLI entrypoint as the third argument')
  return run(process.execPath, [cli, ...args, '--scope', team], { cwd: target, ...options })
}
if (mode === 'prepare' || mode === 'refresh') {
  if (run('git', ['diff', 'HEAD', '--name-only', '--', 'backend']).trim()) throw new Error('Commit reviewed backend changes before preparing a release')
  if (mode === 'prepare' && fs.existsSync(target)) throw new Error('Deployment snapshot already exists; use refresh for a new committed release')
  if (mode === 'refresh') {
    const link = JSON.parse(fs.readFileSync(path.join(target, '.vercel/project.json'), 'utf8'))
    if (link.projectName !== project || link.orgId !== 'team_ptZIGo0q33zRPJ464kehVGW3') throw new Error('Unexpected deployment snapshot link')
  }
  const files = run('git', ['ls-tree', '-r', '--name-only', 'HEAD:backend']).trim().split('\n')
  if (files.some(file => /(^|\/)(\.env(?:\..*)?|env|env-ready\.txt|env-template\.txt)$/.test(file))) {
    throw new Error('Refusing a snapshot containing environment files')
  }
  fs.mkdirSync(target, { recursive: true })
  const archive = path.join(root, '.staging-work/backend-deploy.tar')
  run('git', ['archive', '--format=tar', '--output', archive, 'HEAD:backend'])
  run('tar', ['-xf', archive, '-C', target])
  console.log(`Tracked backend snapshot prepared: ${target}`)
} else if (mode === 'env' || mode === 'deploy') {
  const link = JSON.parse(fs.readFileSync(path.join(target, '.vercel/project.json'), 'utf8'))
  if (link.projectName !== project || link.projectId !== 'prj_6CPyc13CuBaCG7S28jWTubBksCem' || link.orgId !== 'team_ptZIGo0q33zRPJ464kehVGW3') {
    throw new Error('Refusing deployment: unexpected Vercel project/team link')
  }
  if (mode === 'env') {
    const values = { ...config, NODE_ENV: 'production', HOST: '0.0.0.0' }
    delete values.PORT
    delete values.CORS_ORIGIN
    // Only explicitly configured staging values; never inherit production services.
    delete values.REDIS_URL
    delete values.DATABASE_URL
    for (const [key, value] of Object.entries(values)) {
      vercel(['env', 'add', key, '--environment', 'production', '--sensitive', '--yes'], { input: value, stdio: ['pipe', 'pipe', 'pipe'] })
      console.log(`Staging secret configured: ${key}`)
    }
  } else {
    vercel(['deploy', '--prod', '--yes'], { stdio: 'inherit' })
  }
} else {
  throw new Error('Use prepare, refresh, env or deploy. This publishes only the separate staging project.')
}
