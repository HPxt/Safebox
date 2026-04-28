const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const failures = []

const readJson = (relativePath) => {
  const fullPath = path.join(root, relativePath)
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
}

const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message)
  }
}

const assertSecurityHeaders = (relativePath) => {
  const config = readJson(relativePath)
  const headers = config.headers?.flatMap((entry) => entry.headers ?? []) ?? []
  const byKey = new Map(headers.map((header) => [String(header.key).toLowerCase(), String(header.value)]))
  const csp = byKey.get('content-security-policy') ?? ''
  const rewrites = config.rewrites ?? []

  assert(csp.includes("default-src 'self'"), `${relativePath}: CSP missing default-src self`)
  assert(csp.includes("script-src 'self'"), `${relativePath}: CSP missing script-src self`)
  assert(csp.includes("img-src 'self' data: blob:"), `${relativePath}: CSP must not allow arbitrary remote images`)
  assert(!csp.includes('img-src') || !csp.includes('img-src https:'), `${relativePath}: CSP img-src must not allow remote HTTPS beacons`)
  assert(csp.includes("object-src 'none'"), `${relativePath}: CSP missing object-src none`)
  assert(csp.includes("frame-ancestors 'none'"), `${relativePath}: CSP missing frame-ancestors none`)
  assert(csp.includes("base-uri 'self'"), `${relativePath}: CSP missing base-uri self`)
  assert(byKey.get('x-content-type-options') === 'nosniff', `${relativePath}: missing nosniff`)
  assert(byKey.get('x-frame-options') === 'DENY', `${relativePath}: missing DENY frame option`)
  assert(Boolean(byKey.get('strict-transport-security')), `${relativePath}: missing HSTS`)
  assert(Boolean(byKey.get('permissions-policy')), `${relativePath}: missing Permissions-Policy`)
  assert(
    rewrites.some((rewrite) => String(rewrite.source).includes('(?!api/)')),
    `${relativePath}: SPA fallback must not rewrite /api/* to index.html`,
  )
}

const dangerousSinks = [
  /\bdangerouslySetInnerHTML\b/,
  /\.innerHTML\s*=/,
  /\binsertAdjacentHTML\s*\(/,
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /\bdocument\.write\s*\(/,
]

for (const file of walk(path.join(root, 'frontend', 'src'))) {
  const source = stripComments(fs.readFileSync(file, 'utf8'))
  for (const pattern of dangerousSinks) {
    assert(!pattern.test(source), `${path.relative(root, file)} contains dangerous sink ${pattern}`)
  }
}

assertSecurityHeaders('vercel.json')
assertSecurityHeaders(path.join('frontend', 'vercel.json'))

try {
  const trackedFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)

  for (const file of trackedFiles) {
    const basename = path.basename(file).toLowerCase()
    assert(basename !== '.env' && !basename.endsWith('.env'), `tracked env file is not allowed: ${file}`)
  }
} catch (error) {
  console.warn('Skipping tracked env file check because git is unavailable in this runtime')
}

if (failures.length > 0) {
  console.error('AppSec static checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('AppSec static checks passed')
