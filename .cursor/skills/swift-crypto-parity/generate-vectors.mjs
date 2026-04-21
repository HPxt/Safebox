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

// nonces fixos de 12 bytes para vetores de AES-GCM
const FIXED_NONCE_B64 = Buffer.from([
  0xa0, 0xb1, 0xc2, 0xd3, 0xe4, 0xf5, 0x06, 0x17, 0x28, 0x39, 0x4a, 0x5b,
]).toString('base64')

const FIXED_NONCE2_B64 = Buffer.from([
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc,
]).toString('base64')

const FIXED_NONCE3_B64 = Buffer.from([
  0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe, 0x00, 0x01, 0x02, 0x03,
]).toString('base64')

const FIXED_NONCE4_B64 = Buffer.from([
  0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xfe, 0xdc, 0xba, 0x98,
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
  console.log('  aead: building round-trip vectors')
  const firstKdf = kdfVectors[0]
  const rawKey = Buffer.from(firstKdf.derivedKeyHex, 'hex')

  // Helper: build a full AEAD vector from a payload array
  async function buildAeadVector(name, kdfRef, nonceBuf, payloadObj, description) {
    const nonceB64 = bytesToBase64(nonceBuf)
    const plaintext = JSON.stringify(payloadObj)
    const ct = await encryptAesGcm(rawKey, plaintext, nonceBuf)
    const encB64 = bytesToBase64(ct)
    const envJson = canonicalEnvelopeJson('vault-snapshot-v2', nonceB64, encB64)
    const hash = await dataHashOf(envJson)
    return {
      name,
      description,
      kdfVectorRef: kdfRef,
      nonceBase64: nonceB64,
      plaintextJsonUtf8: plaintext,
      encryptedBase64: encB64,
      canonicalEnvelopeJsonUtf8: envJson,
      dataHashHexLower: hash,
    }
  }

  // Vector 1: credential with explicit null fields (notes + totpSecret removed)
  console.log('  aead: v1 credential with null semantic fields')
  const v1 = await buildAeadVector(
    'aead-envelope-v2',
    firstKdf.name,
    base64ToBytes(FIXED_NONCE_B64),
    [
      {
        id: 'fixed-id-0001',
        userId: 'user-uuid-0001',
        title: 'Example',
        username: 'user@example.com',
        encryptedPassword: 'p@ssw0rd!',
        website: 'https://example.com',
        notes: null,          // explicit null: user cleared the notes field
        isFavorite: false,
        isHidden: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        itemType: 'credential',
        totpSecret: null,     // explicit null: TOTP was removed
      },
    ],
    'Single credential with notes=null and totpSecret=null (semantic nulls must be preserved)'
  )

  // Vector 2: card item with all card fields set (some null, some string)
  console.log('  aead: v2 card item with card fields')
  const v2 = await buildAeadVector(
    'aead-card-item',
    firstKdf.name,
    base64ToBytes(FIXED_NONCE2_B64),
    [
      {
        id: 'fixed-id-0002',
        userId: 'user-uuid-0001',
        title: 'My Visa Card',
        encryptedPassword: '1234',
        isFavorite: false,
        isHidden: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        itemType: 'card',
        totpSecret: null,
        cardHolderName: 'JOAO SILVA',
        cardNumber: '4111111111111111',
        cardBrand: 'visa',
        cardExpMonth: '12',
        cardExpYear: '2029',
        cardCvv: null,        // null: user did not provide CVV
      },
    ],
    'Card item: some card fields set, cardCvv=null (not provided)'
  )

  // Vector 3: credential where version field is stripped (set to undefined -> omitted)
  console.log('  aead: v3 version field stripped')
  const credWithVersionStripped = {
    id: 'fixed-id-0003',
    userId: 'user-uuid-0001',
    title: 'Login After Sync',
    username: 'bob@example.com',
    encryptedPassword: 'SecurePass!99',
    isFavorite: true,
    isHidden: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    itemType: 'credential',
    totpSecret: null,
    // NOTE: no 'version' field – it must be stripped before serialization
  }
  const v3 = await buildAeadVector(
    'aead-version-stripped',
    firstKdf.name,
    base64ToBytes(FIXED_NONCE3_B64),
    [credWithVersionStripped],
    'Credential after sync: version field MUST be absent. JSON.stringify with version:undefined omits it.'
  )

  // Vector 4: passthrough unknown item type with unknown fields intact
  console.log('  aead: v4 unknown item type passthrough')
  const v4 = await buildAeadVector(
    'aead-unknown-type-passthrough',
    firstKdf.name,
    base64ToBytes(FIXED_NONCE4_B64),
    [
      {
        id: 'fixed-id-0004',
        userId: 'user-uuid-0001',
        title: 'SSH Key for server',
        encryptedPassword: '-----BEGIN RSA PRIVATE KEY-----',
        isFavorite: false,
        isHidden: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        itemType: 'ssh_key',              // may not be rendered natively on iOS v1
        totpSecret: null,
        privateKeyFingerprint: 'SHA256:abc123xyz',  // unknown extra field
        serverHostname: 'prod.example.com',          // unknown extra field
      },
    ],
    'Unknown itemType with extra fields: iOS must preserve unknown fields on round-trip (passthrough)'
  )

  const aeadVectors = [v1, v2, v3, v4]
  console.log(`  aead: ${aeadVectors.length} vectors built`)

  // Preserve generatedAt when the cryptographic values are unchanged to avoid
  // timestamp-only commits that add noise to parity reviews.
  let generatedAt = new Date().toISOString()
  if (existsSync(VECTORS_PATH)) {
    try {
      const existing = JSON.parse(readFileSync(VECTORS_PATH, 'utf-8'))
      const sameKdf = JSON.stringify(existing.kdfVectors?.map(v => v.derivedKeyHex)) ===
                      JSON.stringify(kdfVectors.map(v => v.derivedKeyHex))
      const sameAead = JSON.stringify(existing.aeadVectors?.map(v => v.dataHashHexLower)) ===
                       JSON.stringify(aeadVectors.map(v => v.dataHashHexLower))
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
    aeadVectors,
  }

  writeFileSync(VECTORS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8')

  const tookSec = ((Date.now() - started) / 1000).toFixed(2)
  console.log(`OK - ${kdfVectors.length} vetores KDF + ${output.aeadVectors.length} vetores AEAD gerados em ${tookSec}s`)
  console.log(`Arquivo: ${VECTORS_PATH}`)
}

main().catch((err) => {
  console.error('Falhou:', err)
  process.exit(1)
})
