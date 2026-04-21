#!/usr/bin/env node
/**
 * Golden Path E0 - SafeBox iOS
 *
 * Valida que a Etapa 0 (criacao das skills Cursor) esta integra antes de
 * avancar para a Etapa 1. Este script e o Golden Path mandatorio da Etapa 0
 * e deve passar em uma maquina limpa com node 18+.
 *
 * Checks:
 *   1. Cada uma das 5 skills tem SKILL.md com frontmatter valido (nome,
 *      descricao, triggers).
 *   2. Cada skill tem pelo menos um arquivo complementar documentado.
 *   3. JSON files (test-vectors, aasa-templates) parseiam sem erros.
 *   4. XML (xcprivacy) tem declaracao e tag raiz plist.
 *   5. O gerador de vetores criptograficos e re-executavel e produz saida
 *      determinista (mesma que foi committada).
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const SKILLS_DIR = join(ROOT, '.cursor', 'skills')

const REQUIRED_SKILLS = [
  {
    name: 'swift-crypto-parity',
    required: ['SKILL.md', 'test-vectors.json', 'canonical-json-examples.md', 'generate-vectors.mjs'],
  },
  {
    name: 'swift-keychain-secure',
    required: ['SKILL.md', 'accessibility-matrix.md', 'error-cheatsheet.md'],
  },
  {
    name: 'swift-autofill-extension',
    required: ['SKILL.md', 'lifecycle-diagram.md', 'app-group-contract.md'],
  },
  {
    name: 'apple-compliance-ios',
    required: ['SKILL.md', 'privacy-manifest-template.xcprivacy', 'aasa-template.json', 'aasa-template-v1x.json', 'submission-checklist.md'],
  },
  {
    name: 'swiftui-security-ui',
    required: ['SKILL.md', 'patterns.md'],
  },
]

const results = { passed: [], failed: [] }

function pass(msg) { results.passed.push(msg); console.log(`  OK  ${msg}`) }
function fail(msg) { results.failed.push(msg); console.error(`  FAIL ${msg}`) }

function parseFrontmatter(content, skillName) {
  // Normaliza CRLF para LF antes de procurar marcadores (tolera arquivos gerados no Windows)
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    fail(`${skillName}/SKILL.md: frontmatter ausente (deve comecar com ---\\n)`)
    return null
  }
  const end = normalized.indexOf('\n---\n', 4)
  if (end === -1) {
    fail(`${skillName}/SKILL.md: frontmatter nao fechado (falta ---\\n)`)
    return null
  }
  const fm = normalized.slice(4, end)
  const lines = fm.split(/\r?\n/)
  const fields = {}
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/)
    if (m) fields[m[1]] = m[2]
  }
  return { fields, rawLength: fm.length }
}

async function checkSkill(skill) {
  console.log(`\n[skill] ${skill.name}`)
  const dir = join(SKILLS_DIR, skill.name)
  if (!existsSync(dir)) {
    fail(`diretorio ausente: ${dir}`)
    return
  }
  pass(`diretorio existe`)

  for (const file of skill.required) {
    const p = join(dir, file)
    if (!existsSync(p)) {
      fail(`arquivo requerido ausente: ${file}`)
      continue
    }
    const st = statSync(p)
    if (st.size < 50) {
      fail(`arquivo muito curto (${st.size}B): ${file}`)
      continue
    }
    pass(`${file} (${st.size}B)`)
  }

  // Frontmatter do SKILL.md
  const skillMdPath = join(dir, 'SKILL.md')
  if (existsSync(skillMdPath)) {
    const content = readFileSync(skillMdPath, 'utf-8')
    const normalized = content.replace(/\r\n/g, '\n')
    const fm = parseFrontmatter(content, skill.name)
    if (fm) {
      if (fm.fields.name) pass(`frontmatter.name presente`)
      else fail(`frontmatter.name ausente em SKILL.md`)
      if (fm.fields.description !== undefined) pass(`frontmatter.description presente`)
      else fail(`frontmatter.description ausente em SKILL.md`)
      if (normalized.includes('triggers:')) pass(`frontmatter.triggers presente`)
      else fail(`frontmatter.triggers ausente em SKILL.md`)
    }
  }

  // JSON files: parse
  for (const file of skill.required.filter(f => f.endsWith('.json'))) {
    const p = join(dir, file)
    try {
      JSON.parse(readFileSync(p, 'utf-8'))
      pass(`${file} e JSON valido`)
    } catch (e) {
      fail(`${file} JSON invalido: ${e.message}`)
    }
  }

  // xcprivacy files: verificar declaracao XML + plist
  for (const file of skill.required.filter(f => f.endsWith('.xcprivacy'))) {
    const p = join(dir, file)
    const c = readFileSync(p, 'utf-8')
    if (!c.startsWith('<?xml')) {
      fail(`${file}: falta declaracao XML`)
      continue
    }
    if (!c.includes('<plist')) {
      fail(`${file}: falta tag plist`)
      continue
    }
    if (!c.includes('</plist>')) {
      fail(`${file}: plist nao fechado`)
      continue
    }
    pass(`${file} XML/plist valido`)
  }
}

async function validateCryptoDeterminism() {
  console.log(`\n[crypto] re-gerando vetores para checar determinismo`)
  const vectorsPath = join(SKILLS_DIR, 'swift-crypto-parity', 'test-vectors.json')
  const before = JSON.parse(readFileSync(vectorsPath, 'utf-8'))
  const beforeDigest = JSON.stringify({
    kdf: before.kdfVectors.map(v => v.derivedKeyHex),
    aead: before.aeadVectors.map(v => v.dataHashHexLower),
  })

  try {
    execFileSync(
      process.execPath,
      [join(SKILLS_DIR, 'swift-crypto-parity', 'generate-vectors.mjs')],
      { stdio: 'pipe', cwd: ROOT }
    )
  } catch (e) {
    fail(`generate-vectors.mjs falhou: ${e.message}`)
    return
  }

  const after = JSON.parse(readFileSync(vectorsPath, 'utf-8'))
  const afterDigest = JSON.stringify({
    kdf: after.kdfVectors.map(v => v.derivedKeyHex),
    aead: after.aeadVectors.map(v => v.dataHashHexLower),
  })

  if (beforeDigest === afterDigest) {
    pass(`vetores KDF+AEAD deterministicos (${after.kdfVectors.length} KDF + ${after.aeadVectors.length} AEAD)`)
  } else {
    fail(`vetores mudaram entre execucoes consecutivas -- pipeline nao-deterministico ou estado sujo`)
  }
}

async function validateSkillsDirectoryStructure() {
  console.log(`\n[structure] listando .cursor/skills/`)
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true })
  const found = entries.filter(e => e.isDirectory()).map(e => e.name).sort()
  const expected = REQUIRED_SKILLS.map(s => s.name).sort()
  if (JSON.stringify(found) === JSON.stringify(expected)) {
    pass(`5 skills presentes e nenhuma extra (${found.join(', ')})`)
  } else {
    fail(`divergencia de diretorios. esperado: ${expected.join(', ')} | encontrado: ${found.join(', ')}`)
  }
}

async function main() {
  console.log('Golden Path E0 - SafeBox iOS Skills')
  console.log('====================================')

  await validateSkillsDirectoryStructure()
  for (const skill of REQUIRED_SKILLS) {
    await checkSkill(skill)
  }
  await validateCryptoDeterminism()

  console.log('\n====================================')
  console.log(`Passed: ${results.passed.length}`)
  console.log(`Failed: ${results.failed.length}`)
  if (results.failed.length > 0) {
    console.error('\nFALHAS:')
    for (const f of results.failed) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log('\nGolden Path E0: PASSOU')
}

main().catch((err) => {
  console.error('Erro inesperado:', err)
  process.exit(2)
})
