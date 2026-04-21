# SafeBox Vault Protocol Specification

**Version**: 1.0  
**Status**: Canonical (source of truth for all clients)  
**Applies to**: Web client (TypeScript), iOS client (Swift v1+)

---

## 1. Overview

The SafeBox vault uses a zero-knowledge encryption model: the server stores only opaque ciphertext and a hash for integrity verification. The server cannot decrypt the vault. Decryption happens exclusively on the client, in memory, using a key derived from the user's master password.

This document specifies the exact cryptographic pipeline and serialization contract that **all clients must implement identically**, bit-for-bit.

---

## 2. Key Derivation Pipeline

### 2.1 Inputs

| Parameter | Type | Source |
|---|---|---|
| `password` | UTF-8 string | User input |
| `kdf_salt` | Base64 string (32 bytes) | `users.kdf_salt` in Supabase |
| `kdf_params` | JSON object | `users.kdf_params` in Supabase |

**Unicode normalization**: NONE. The password bytes are used as-is. Clients MUST NOT apply NFC, NFD, NFKC or any trimming.

### 2.2 Step 1 — PBKDF2-HMAC-SHA256 (pre-hash)

```
pbkdf2_key = PBKDF2-HMAC-SHA256(
  password  = password.utf8Bytes,
  salt      = saltBytes[0 .. 15],      // first 16 bytes only
  c         = 100_000,
  dkLen     = 32
)
```

- Input salt: the **first 16 bytes** of the decoded `kdf_salt`
- Output: 32 bytes

### 2.3 Step 2 — Input composition (critical)

```
b64_pbkdf2      = base64_standard_encode(pbkdf2_key)  // with padding, no line breaks
combined_password = b64_pbkdf2 || password             // string concatenation
```

- `base64_standard_encode`: RFC 4648 alphabet (`A-Za-z0-9+/`), with `=` padding, **no** line breaks
- The resulting `combined_password` is a UTF-8 string that becomes the Argon2id password input

### 2.4 Step 3 — Argon2id

```
aes_key_bytes = Argon2id(
  password    = combined_password.utf8Bytes,
  salt        = saltBytes[0 .. 31],    // all 32 bytes
  m           = kdf_params.memorySize, // in KiB
  t           = kdf_params.iterations,
  p           = kdf_params.parallelism,
  tagLen      = kdf_params.hashLength  // always 32
)
```

- Salt: **all 32 bytes** (NOT just the 16 used in PBKDF2)
- Parameters come from `users.kdf_params`; clients MUST NOT hardcode them
- Output: 32 bytes → used directly as AES-256-GCM key

### 2.5 KDF Parameter Levels

| Level | memorySize (KiB) | iterations | parallelism | hashLength |
|---|---|---|---|---|
| LOW | 65536 | 3 | 4 | 32 |
| MEDIUM | 98304 | 4 | 4 | 32 |
| HIGH | 131072 | 5 | 4 | 32 |
| ULTRA | 262144 | 6 | 4 | 32 |

The active level is stored in `users.kdf_params`. If iOS detects a level that causes >5s KDF time on the device, it should display a "deriving key…" progress indicator but MUST NOT change the parameters.

---

## 3. Encryption (AES-256-GCM)

### 3.1 Parameters

| Parameter | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key | 32 bytes from Argon2id output |
| Nonce / IV | 12 bytes (96 bits), random per encrypt |
| Tag length | 16 bytes (128 bits) |
| AAD | None |

### 3.2 Nonce generation

- Web: `crypto.getRandomValues(new Uint8Array(12))`
- iOS: `SecRandomCopyBytes(kSecRandomDefault, 12, &buf)`

### 3.3 Ciphertext format

Web Crypto API (`crypto.subtle.encrypt`) appends the 16-byte GCM tag to the ciphertext:

```
encryptedBytes = ciphertext || tag    // 128-bit tag appended
encryptedBase64 = base64_standard_encode(encryptedBytes)
```

iOS `AES.GCM.SealedBox` separates `.ciphertext` and `.tag`. When encoding for the wire, concatenate them in the same order:

```swift
let wireBytes = sealed.ciphertext + sealed.tag
let encryptedBase64 = wireBytes.base64EncodedString()
```

When decoding on iOS, split the last 16 bytes as tag:

```swift
let tagStart = combined.count - 16
let ciphertext = combined[0 ..< tagStart]
let tag = combined[tagStart...]
let sealed = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
```

---

## 4. Vault Snapshot Envelope (vault-snapshot-v2)

### 4.1 Structure

```json
{"version":"vault-snapshot-v2","nonce":"<base64>","encrypted":"<base64>"}
```

### 4.2 Serialization rules (all required, no exceptions)

1. **Key order**: `version`, `nonce`, `encrypted` — exactly this order
2. **No whitespace** after `:` or `,`
3. **UTF-8 encoding**, no BOM
4. **No pretty-printing**

These rules make the JSON output deterministic across clients. Any deviation changes the `dataHash`, which breaks parity and test vectors. The backend rejects a write when the submitted `dataHash` does not match the submitted `encryptedData` string.

### 4.3 dataHash computation

```
dataHash = hex_lower(SHA-256(encryptedData.utf8Bytes))
```

Where `encryptedData` is the full JSON string of the envelope (e.g. `{"version":"vault-snapshot-v2","nonce":"...","encrypted":"..."}`).

- Hex output: lowercase, no prefix, no separators
- Example: `9a5fcdd85e01f3c382d81f7373b99102a4d9e9b0dcaa917f9eb6ada7c1229095`

---

## 5. Vault Payload (inner plaintext)

### 5.1 Format

The plaintext is a **JSON array** of credential objects. There is no outer wrapper object.

```json
[<credential>, <credential>, ...]
```

### 5.2 Credential field definitions

| Field | Type | Nullable | Serialization rule |
|---|---|---|---|
| `id` | string | no | always present |
| `userId` | string | no | always present |
| `title` | string | no | always present |
| `username` | string | yes (omit) | omit if not set (`undefined`) |
| `email` | string | yes (omit) | omit if not set |
| `encryptedPassword` | string | no | always present (password field) |
| `website` | string | yes (omit) | omit if not set |
| `notes` | string | yes (`null`) | `null` is preserved; omit only if `undefined` |
| `categoryId` | string | yes (omit) | omit if undefined |
| `folderId` | string | yes (omit) | omit if undefined |
| `tags` | string[] | yes (omit) | omit if undefined |
| `isFavorite` | boolean | no | always present |
| `isHidden` | boolean | no | always present |
| `createdAt` | ISO 8601 string | no | always present |
| `updatedAt` | ISO 8601 string | no | always present |
| `itemType` | string | yes (omit) | omit if undefined |
| `totpSecret` | string \| null | yes (`null` preserved) | `null` is preserved |
| `requireMasterPassword` | boolean | yes (omit) | omit if undefined |
| `cardHolderName` | string \| null | yes (`null` preserved) | `null` is preserved |
| `cardNumber` | string \| null | yes (`null` preserved) | `null` is preserved |
| `cardBrand` | string \| null | yes (`null` preserved) | `null` is preserved |
| `cardExpMonth` | string \| null | yes (`null` preserved) | `null` is preserved |
| `cardExpYear` | string \| null | yes (`null` preserved) | `null` is preserved |
| `cardCvv` | string \| null | yes (`null` preserved) | `null` is preserved |
| `version` | number | stripped | ALWAYS omit (set to `undefined` before serialization) |

> **Critical**: the `version` field is present on `Credential` objects in memory (set to the vault version by the service layer) but MUST be stripped (`set to undefined`) before serializing into the vault payload. Failing to strip it does not break decryption, but it pollutes the payload and changes the `dataHash` compared to what the server expects.

> **Critical**: fields typed as `string | null` have semantic meaning for `null`. `null` means "user explicitly set this to empty/removed". Do NOT convert `null` to `""` or omit the key.

> **Forward compatibility**: if a client finds fields not listed in this table, it MUST preserve them on round-trip (passthrough strategy) unless the user explicitly edits/removes those fields.

### 5.3 Key ordering in the payload

The web client uses `JSON.stringify` on a spread object, which preserves insertion order (ECMAScript 2015+). The order is determined by the property order of the `Credential` object spread.

For iOS, when re-serializing a credential that came from the server **without edits**, the safest strategy is **passthrough** — store the original parsed JSON and re-emit it as-is. This avoids any ordering divergence.

When creating or editing a credential, use the canonical key order from the table above (which matches the `Credential` interface declaration order in `frontend/src/types/index.ts`).

---

## 6. Wire Protocol (backend API)

### 6.1 GET /api/vault

Response:

```json
{
  "id": "uuid",
  "encryptedData": "{\"version\":\"vault-snapshot-v2\",\"nonce\":\"...\",\"encrypted\":\"...\"}",
  "dataHash": "hex64chars",
  "version": 3,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "storageMode": "credentials"
}
```

- `encryptedData` is a **JSON-encoded string** (the envelope JSON is itself a string value in the response object). On iOS: `let envelopeJSON = vaultApiResponse.encryptedData`
- `dataHash` is used to detect tampering; clients SHOULD verify it matches `SHA-256(encryptedData.utf8)`

### 6.2 PUT /api/vault

Request body:

```json
{
  "encryptedData": "{...envelope JSON...}",
  "dataHash": "hex64chars",
  "expectedVersion": 3
}
```

- `expectedVersion` enables optimistic locking; backend returns `409 VAULT_VERSION_CONFLICT` if the current DB version differs

### 6.3 POST /api/vault (first save)

Same body as PUT but without `expectedVersion`.

---

## 7. Legacy Vault Format

The `vaults` table (legacy) stores `encrypted_data` as a JSONB column, not a string. The service layer handles this by `JSON.stringify`-ing the JSONB value before passing it to the decrypt pipeline.

iOS clients MUST support reading the legacy format for users migrating from the web. Detection: if `decryptVaultPayload` receives an `encryptedData` that, when parsed, is an **array** (not an object with `version: "vault-snapshot-v2"`), it is a legacy snapshot.

Per-item behavior MUST match the current web implementation:

- If an item has both `encryptedPassword` **and** `passwordNonce`, decrypt that item password.
- Otherwise, preserve the item as-is (do not fail, do not drop fields).

For v1, iOS **read** support for legacy format is required. **Write** (creating/editing) must always produce `vault-snapshot-v2`.

---

## 8. Test Vectors

Test vectors are maintained in `.cursor/skills/swift-crypto-parity/test-vectors.json`.

To regenerate (deterministic, same output if pipeline unchanged):

```bash
node .cursor/skills/swift-crypto-parity/generate-vectors.mjs
```

Frontend automated tests:

```bash
npm --prefix frontend test -- --watchAll=false --testPathPattern="vault-protocol"
```

---

## 9. Change Control

Any change to this document requires:

1. Update `test-vectors.json` (re-run generator)
2. Update and pass frontend Jest tests
3. Update iOS Swift implementation in the same PR
4. PR description references this spec and explains the motivation

**Never** change the serialization format without a coordinated version bump across all clients.
