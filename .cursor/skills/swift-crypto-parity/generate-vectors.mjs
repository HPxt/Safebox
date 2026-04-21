#!/usr/bin/env node
/**
 * Gera vetores de teste criptografico REAIS reproduzindo o pipeline exato do
 * frontend/src/services/cryptoService.ts.
 *
 * Fonte de verdade: cryptoService.deriveKey:
 *   1. PBKDF2-HMAC-SHA256, 100k iter, salt = primeiros 16 bytes do saltBytes, saida 32 bytes
 *   2. combinedPassword = btoa(pbkdf2Bytes) + password_original
 *   3. Argon2id com (combinedPassword, saltBytes 32, params)
 *   4. Output: 32 bytes raw que viram SymmetricKey do AES-GCM
 *
 * Tambem gera um vetor de envelope vault-snapshot-v2 com dataHash (SHA-256 hex
 * lowercase do JSON UTF-8).
 *
 * Requer Node 18+ (Web Crypto API global) e dependencia hash-wasm do frontend.
 *
 * Uso:
 *   node .cursor/skills/swift-crypto-parity/generate-vectors.mjs
 */

import { webcrypto } from 'node:crypto'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filenameInit = fileURLToPath(import.meta.url)
const __dirnameInit = dirname(__filenameInit)

// Usa a mesma instalacao de hash-wasm que o frontend usa em producao,
// para garantir paridade entre vetores e codigo real do app web.
const hashWasmUrl = new URL(
  '../../../frontend/node_modules/hash-wasm/dist/index.esm.js',
  import.meta.url
)
const { argon2id } = await import(hashWasmUrl.href)

const subtle = webcrypto.subtle

const VECTORS_PATH = join(__dirnameInit, 'test-vectors.json')

/**
 * Base64 "padrao" igual a btoa do browser:
 * btoa(String.fromCharCode(...bytes)) == Buffer.from(bytes).toString('base64')
 */
function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex')
}

/**
 * Reproduz exatamente frontend/src/services/cryptoService.ts::deriveKey
 * @param {string} password
 * @param {string} saltBase64   salt completo em base64 (32 bytes)
 * @param {{memorySize:number, iterations:number, parallelism:number, hashLength:number}} params
 * @returns {Promise<Uint8Array>} os 32 bytes raw da chave derivada
 */
async function deriveKeyRaw(password, saltBase64, params) {
  const saltBytes = base64ToBytes(saltBase64)
  const passwordBytes = new TextEncoder().encode(password)

  const passwordKey = await subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const pbkdf2Bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.slice(0, 16),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  )

  const pbkdf2Result = new Uint8Array(pbkdf2Bits)
  const combinedPassword = bytesToBase64(pbkdf2Result) + password

  const hashResult = await argon2id({
    password: combinedPassword,
    salt: saltBytes,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memorySize,
    hashLength: params.hashLength,
    outputType: 'binary',
  })

  if (!(hashResult instanceof Uint8Array) || hashResult.length !== 32) {
    throw new Error(
      `Hash result invalido: esperado Uint8Array de 32 bytes, recebido ${typeof hashResult} de ${hashResult?.length ?? 'unknown'} bytes`
    )
  }

  return hashResult
}

/**
 * Encripta com AES-256-GCM no mesmo formato do web:
 *   encrypted_b64 = base64(ciphertext || tag)
 */
async function encryptAesGcm(rawKey, plaintext, nonceBytes) {
  const key = await subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
  const encryptedBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBytes, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  )
  return new Uint8Array(encryptedBuf)
}

/**
 * dataHash = SHA-256 hex lowercase dos bytes UTF-8 do JSON canonico.
 */
async function dataHashOf(envelopeJsonString) {
  const bytes = new TextEncoder().encode(envelopeJsonString)
  const digest = await subtle.digest('SHA-256', bytes)
  return bytesToHex(new Uint8Array(digest))
}

/**
 * Serializa envelope na ordem canonica: version, nonce, encrypted.
 * Sem espacos, sem pretty-print.
 */
function canonicalEnvelopeJson(version, nonceB64, encryptedB64) {
  return (
    '{' +
    JSON.stringify('version') + ':' + JSON.stringify(version) + ',' +
    JSON.stringify('nonce') + ':' + JSON.stringify(nonceB64) + ',' +
    JSON.stringify('encrypted') + ':' + JSON.stringify(encryptedB64) +
    '}'
  )
}

const KDF_LEVELS = {
  LOW:    { memorySize: 65536,  iterations: 3, parallelism: 4, hashLength: 32 },
  MEDIUM: { memorySize: 98304,  iterations: 4, parallelism: 4, hashLength: 32 },
  HIGH:   { memorySize: 131072, iterations: 5, parallelism: 4, hashLength: 32 },
  ULTRA:  { memorySize: 262144, iterations: 6, parallelism: 4, hashLength: 32 },
}

// salts deterministicos de 32 bytes, em base64, escolhidos para reprodutibilidade
const FIXED_SALTS = {
  a: Buffer.from(new Uint8Array(32).map((_, i) => i)).toString('base64'),
  b: Buffer.from(new Uint8Array(32).map((_, i) => (i * 7 + 3) % 256)).toString('base64'),
  c: Buffer.from('safebox-ios-test-vector-salt-0001', 'utf-8').subarray(0, 32).toString('base64'),
}

// nonce fixo de 12 bytes para vetor de AES-GCM
const FIXED_NONCE_B64 = Buffer.from([
  0xa0, 0xb1, 0xc2, 0xd3, 0xe4, 0xf5, 0x06, 0x17, 0x28, 0x39, 0x4a, 0x5b,
]).toString('base64')

async function main() {
  console.log('Gerando vetores de teste...')
  const started = Date.now()

  const kdfCases = [
    {
      name: 'low-ascii-short',
      password: 'SafeBox#Vector1!',
      saltBase64: FIXED_SALTS.a,
      level: 'LOW',
    },
    {
      name: 'low-unicode-accents',
      password: 'Mañana-Ação-漢字-Тест',
      saltBase64: FIXED_SALTS.b,
      level: 'LOW',
    },
    {
      name: 'low-long-password',
      password: 'correct horse battery staple 12345 !@# end-of-test',
      saltBase64: FIXED_SALTS.c,
      level: 'LOW',
    },
    {
      name: 'medium-standard',
      password: 'SafeBox#Vector4!',
      saltBase64: FIXED_SALTS.a,
      level: 'MEDIUM',
    },
    {
      name: 'high-standard',
      password: 'SafeBox#Vector5!',
      saltBase64: FIXED_SALTS.b,
      level: 'HIGH',
    },
  ]

  const kdfVectors = []
  for (const c of kdfCases) {
    console.log(`  kdf: ${c.name} (${c.level})`)
    const params = KDF_LEVELS[c.level]
    const derivedKey = await deriveKeyRaw(c.password, c.saltBase64, params)
    kdfVectors.push({
      name: c.name,
      password: c.password,
      saltBase64: c.saltBase64,
      kdfParams: {
        algorithm: 'argon2id',
        level: c.level,
        memorySize: params.memorySize,
        iterations: params.iterations,
        parallelism: params.parallelism,
        hashLength: params.hashLength,
      },
      pbkdf2: {
        algorithm: 'PBKDF2-HMAC-SHA256',
        iterations: 100000,
        saltPrefixBytes: 16,
        outputBytes: 32,
      },
      derivedKeyHex: bytesToHex(derivedKey),
    })
  }

  // Vetor de encrypt/envelope/dataHash usando a chave do primeiro vetor KDF
  console.log('  aead: vault-snapshot-v2 envelope + dataHash')
  const firstKdf = kdfVectors[0]
  const rawKey = Buffer.from(firstKdf.derivedKeyHex, 'hex')
  const nonceBytes = base64ToBytes(FIXED_NONCE_B64)
  const plaintext = JSON.stringify([
    {
      id: 'fixed-id-0001',
      itemType: 'credential',
      title: 'Example',
      username: 'user@example.com',
      password: 'p@ssw0rd!',
      website: 'https://example.com',
      notes: null,
      totpSecret: null,
    },
  ])
  const ciphertextAndTag = await encryptAesGcm(rawKey, plaintext, nonceBytes)
  const encryptedB64 = bytesToBase64(ciphertextAndTag)
  const envelopeJson = canonicalEnvelopeJson('vault-snapshot-v2', FIXED_NONCE_B64, encryptedB64)
  const envelopeHash = await dataHashOf(envelopeJson)

  const aeadVector = {
    name: 'aead-envelope-v2',
    kdfVectorRef: firstKdf.name,
    nonceBase64: FIXED_NONCE_B64,
    plaintextJsonUtf8: plaintext,
    encryptedBase64: encryptedB64,
    canonicalEnvelopeJsonUtf8: envelopeJson,
    dataHashHexLower: envelopeHash,
  }

  // Preserve generatedAt when the cryptographic values are unchanged to avoid
  // timestamp-only commits that add noise to parity reviews.
  let generatedAt = new Date().toISOString()
  if (existsSync(VECTORS_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(VECTORS_PATH, 'utf-8'))
      const sameKdf = JSON.stringify(existing.kdfVectors?.map(v => v.derivedKeyHex)) ===
                      JSON.stringify(kdfVectors.map(v => v.derivedKeyHex))
      const sameAead = JSON.stringify(existing.aeadVectors?.map(v => v.dataHashHexLower)) ===
                       JSON.stringify([aeadVector].map(v => v.dataHashHexLower))
      if (sameKdf && sameAead && existing.generatedAt) {
        generatedAt = existing.generatedAt
      }
    } catch {
      // If existing file is unreadable, use current timestamp.
    }
  }

  const output = {
    $schema: 'https://safebox.app/schemas/swift-crypto-parity.test-vectors.v1.json',
    generatedAt,
    sourceOfTruth: 'frontend/src/services/cryptoService.ts',
    notes: [
      'Vetores gerados executando exatamente o mesmo pipeline do frontend.',
      'Qualquer mudanca proposital no pipeline exige regenerar este arquivo e validar Swift contra os novos valores.',
    ],
    pipeline: {
      step1: 'PBKDF2-HMAC-SHA256, salt=saltBytes[0..16], iterations=100000, output=32 bytes',
      step2: 'combinedPassword = base64(pbkdf2_32bytes) + password_utf8',
      step3: 'Argon2id(password=combinedPassword_utf8, salt=saltBytes_32bytes, params=users.kdf_params)',
      step4: 'AES-256-GCM key = argon2_output_32bytes diretamente (sem KDF adicional)',
      step5: 'Envelope vault-snapshot-v2: {"version","nonce","encrypted"} ordem fixa; dataHash = SHA-256 hex lower do JSON UTF-8',
    },
    kdfVectors,
    aeadVectors: [aeadVector],
  }

  writeFileSync(VECTORS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8')

  const tookSec = ((Date.now() - started) / 1000).toFixed(2)
  console.log(`OK - ${kdfVectors.length} vetores KDF + ${output.aeadVectors.length} vetor AEAD gerados em ${tookSec}s`)
  console.log(`Arquivo: ${VECTORS_PATH}`)
}

main().catch((err) => {
  console.error('Falhou:', err)
  process.exit(1)
})
