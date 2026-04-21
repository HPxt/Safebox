---
name: swift-crypto-parity
description: >-
  Garante paridade bit-a-bit entre a criptografia do cliente iOS (Swift) e o
  cliente web (TypeScript) do SafeBox. Use sempre que tocar em Swift que derive
  chave (PBKDF2 + Argon2id), criptografe/descriptografe com AES-GCM, calcule
  dataHash do envelope, ou serialize JSON que atravessa a fronteira web <-> iOS.
  Skill critica: erro aqui significa vault inacessivel, perda de dados ou
  comprometimento da promessa zero-knowledge.
triggers:
  - "**/*Crypto*.swift"
  - "**/Vault*.swift"
  - "**/VaultSnapshot*.swift"
  - "**/KeyDerivation*.swift"
  - ".cursor/skills/swift-crypto-parity/**"
  - "frontend/src/services/cryptoService.ts"
  - "frontend/src/services/credentialsService.ts"
---

# swift-crypto-parity

## Por que essa skill existe

O SafeBox e zero-knowledge: o servidor nunca ve senhas em claro. Se o iOS derivar a chave de forma diferente do web, mesmo que por um unico bit, acontece **um** dos seguintes desastres:

- usuario loga no iOS com senha correta e ve "vault invalido" (chave nao abre o blob que o web criou)
- usuario salva credencial no iOS, abre no web e ve dados corrompidos
- `dataHash` diverge entre clientes e o backend rejeita o PUT do vault
- campos `null` somem silenciosamente no round-trip

Toda violacao desta skill e **bloqueador de submissao**: o reviewer da Apple pode perceber como bug funcional (clausula 2.1).

## Fonte de verdade

O contrato canonico e a implementacao em TypeScript do frontend. Qualquer codigo Swift que divergir DEVE ser corrigido. Caso o frontend precise mudar o contrato, atualize primeiro esta skill e os vetores em `test-vectors.json`, depois o Swift, depois o frontend -- nessa ordem, nunca em ordem diferente.

Arquivos de referencia:

- `frontend/src/services/cryptoService.ts` -- pipeline de derivacao
- `frontend/src/services/credentialsService.ts` -- envelope vault-snapshot-v2
- `backend/src/domain/vault/VaultSnapshotService.ts` -- validacao de `dataHash`

## Pipeline canonico (obrigatorio implementar igual)

### 1) Entradas

- `password: String` em UTF-8, **sem normalizacao Unicode** (o web nao normaliza; nao aplicar `.precomposedStringWithCanonicalMapping` no Swift)
- `saltBase64: String` de 32 bytes -- decodificar como base64 padrao (alfabeto RFC 4648, com padding `=`)
- `kdfParams: KdfParams` (veja 3)

### 2) PBKDF2 (pre-hash)

- Algoritmo: PBKDF2-HMAC-SHA256
- Senha: bytes UTF-8 da `password`
- Salt: **primeiros 16 bytes** do salt decodificado (`saltBytes[0..<16]`)
- Iteracoes: **100_000**
- Saida: **32 bytes (256 bits)**
- Implementacao Swift recomendada: `CommonCrypto.CCKeyDerivationPBKDF`

```swift
// pseudocodigo
let pbkdf2Key = try PBKDF2.deriveKey(
    password: password.data(using: .utf8)!,
    salt: saltBytes.subdata(in: 0..<16),
    iterations: 100_000,
    keyLength: 32,
    hash: .sha256
)
```

### 3) Concatenacao (step critico -- erro classico)

O web faz:

```ts
const pbkdf2Result = new Uint8Array(pbkdf2Bits)
const combinedInput = btoa(String.fromCharCode(...Array.from(pbkdf2Result))) + password
```

Traducao Swift:

- `btoa` do resultado do PBKDF2 = `base64(pbkdf2Key)` com alfabeto padrao e padding
- Concatenacao: `base64(pbkdf2Key) + password_original_em_string`
- `combinedInput` e **string**, nao bytes (entra no Argon2id como string UTF-8)

```swift
let b64Pbkdf2 = pbkdf2Key.base64EncodedString()  // padding padrao, sem line breaks
let combinedInput = b64Pbkdf2 + password          // string + string
```

**Erro comum**: concatenar bytes em vez de strings. O Argon2id de `hash-wasm` interpreta a entrada como bytes UTF-8 da string final, entao precisa ser `base64(bytes).utf8 + password.utf8`, nao `bytes + password_bytes`.

### 4) Argon2id

- Algoritmo: Argon2id (nao Argon2i, nao Argon2d)
- Password: `combinedInput` em bytes UTF-8
- Salt: **32 bytes completos** (nao os 16 usados no PBKDF2)
- Parametros: lidos de `users.kdf_params` no Supabase (NUNCA hardcoded)
  - `memorySize` (em KiB no formato `hash-wasm`, converter para bytes na lib Swift se necessario)
  - `iterations`
  - `parallelism`
  - `hashLength` -- sempre 32
- Saida: 32 bytes raw (binary)

Niveis conhecidos (ver `frontend/src/components/MasterPasswordSettings.tsx`):

| Nivel  | memorySize (KiB) | iterations | parallelism | hashLength |
|--------|------------------|------------|-------------|------------|
| LOW    | 65536            | 3          | 4           | 32         |
| MEDIUM | 98304            | 4          | 4           | 32         |
| HIGH   | 131072           | 5          | 4           | 32         |
| ULTRA  | 262144           | 6          | 4           | 32         |

**Obrigatorio**: validar com `test-vectors.json` antes de considerar a implementacao pronta.

### 5) Importacao da chave AES-GCM

- Os 32 bytes do Argon2id sao **diretamente** a chave AES-256-GCM (nao aplicar KDF adicional)
- Swift: `SymmetricKey(data: argon2Output)` do CryptoKit

### 6) AES-256-GCM (encrypt/decrypt)

- Nonce: 12 bytes (96 bits), gerados com `SecRandomCopyBytes` (iOS) e transportados em base64
- Tag: 16 bytes (128 bits), **concatenada ao ciphertext** (Web Crypto faz isso automaticamente; `AES.GCM.SealedBox` do CryptoKit separa, precisa reconstruir)
- AAD: **nao usar**
- Formato de saida no envelope: `encrypted = base64(ciphertext || tag)`, exatamente como o Web Crypto entrega

```swift
// Encriptar
let sealed = try AES.GCM.seal(plaintextData, using: symKey, nonce: AES.GCM.Nonce(data: nonceBytes))
let ciphertextPlusTag = sealed.ciphertext + sealed.tag  // ordem web
let encryptedB64 = ciphertextPlusTag.base64EncodedString()

// Decriptar
let combined = Data(base64Encoded: encryptedB64)!
let tagStart = combined.count - 16
let ciphertext = combined.subdata(in: 0..<tagStart)
let tag = combined.subdata(in: tagStart..<combined.count)
let sealed = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonceBytes), ciphertext: ciphertext, tag: tag)
let plaintext = try AES.GCM.open(sealed, using: symKey)
```

## Envelope `vault-snapshot-v2`

O envelope serializado e o UNICO input para `dataHash`. Qualquer byte diferente faz o backend rejeitar o PUT com `409 VAULT_SNAPSHOT_MISMATCH`.

### Schema

```json
{
  "version": "vault-snapshot-v2",
  "nonce": "<base64>",
  "encrypted": "<base64>"
}
```

### Regras de serializacao (obrigatorias)

1. **Ordem das chaves**: exatamente `version`, `nonce`, `encrypted`. Swift: struct `Encodable` com `CodingKeys` nessa ordem + `JSONEncoder().outputFormatting = []` (nao sortear chaves, nao pretty-print)
2. **Encoding**: UTF-8 sem BOM
3. **Sem whitespace**: sem espacos apos `:` ou `,`. `JSONEncoder` com `outputFormatting = []` ja faz isso
4. **Strings**: aspas duplas, escape padrao JSON. `JSONEncoder` cuida disso
5. **dataHash**: `SHA-256` dos bytes UTF-8 do JSON, em **hex lowercase**, sem prefixo

```swift
let envelope = VaultEnvelope(version: "vault-snapshot-v2", nonce: nonceB64, encrypted: encryptedB64)
let jsonData = try JSONEncoder().encode(envelope)  // output determinista
let hashBytes = SHA256.hash(data: jsonData)
let dataHash = hashBytes.map { String(format: "%02x", $0) }.joined()
```

## Serializacao do payload interno (array de credenciais)

### Regras

- Payload interno (antes do encrypt) e um **array JSON de credenciais**, nao objeto
- **Ordem das chaves dentro de cada credencial**: preservar a ordem original se a credencial veio do servidor sem edicao; se foi editada ou criada nova, usar ordem alfabetica das chaves
- **Campos `null`**: preservar **sempre**. Campos como `totpSecret`, `cardHolderName`, `cardNumber`, `cardBrand`, `cardExpMonth`, `cardExpYear`, `cardCvv` sao `string | null` no frontend. NAO usar `encodeIfPresent` para esses campos.
- **Campos `undefined` no web** (ausentes do objeto): omitir da serializacao no iOS tambem. Em Swift: nao incluir a chave no dicionario
- **Campos desconhecidos** (tipos de item nao mapeados no iOS): preservar via passthrough (`[String: AnyJSON]` overflow) para nao descartar dados ao re-salvar

### Padrao recomendado: passthrough quando possivel

```swift
// Ao receber vault do servidor:
// 1. JSONSerialization.jsonObject(with: plaintextData, options: [])
// 2. Guardar referencia ao dicionario/array original
// 3. Se usuario NAO editou nada, re-serializar o objeto original na escrita
// 4. Se usuario editou credencial X:
//    - sobrescrever apenas a credencial X no array original
//    - manter ordem das outras
//    - para a credencial editada, usar JSONEncoder com ordem alfabetica de chaves
```

**Motivo**: `JSONEncoder` do Swift nao garante ordem estavel entre versoes. Passthrough elimina o risco de re-serializacao produzir JSON byte-diferente do que o web produziu.

## Don'ts (erros que quebram paridade silenciosamente)

- NAO normalizar a senha em Unicode (nem NFC, nem NFD)
- NAO aplicar `trimmingCharacters` na senha -- espacos sao significativos
- NAO usar `arc4random`, `Int.random`, `UUID()` como fonte de nonce ou salt
- NAO passar o salt de 32 bytes inteiro para o PBKDF2 (sao apenas os 16 primeiros)
- NAO passar so 16 bytes para o Argon2id (sao os 32 completos)
- NAO aplicar HKDF/segundo KDF sobre o output do Argon2id
- NAO esquecer de concatenar `base64(pbkdf2) + password` -- a senha raw entra de novo no Argon2id
- NAO usar `JSONEncoder.outputFormatting = .sortedKeys` no envelope (o web NAO sorteia; a ordem certa e literal `version, nonce, encrypted`)
- NAO pretty-print o JSON antes do hash
- NAO confundir `hex` com `base64` em salt/nonce/encrypted (tudo e base64; o dataHash e hex)
- NAO assumir que `null` pode ser convertido para `""` ou "ausente" -- preservar `null` literal

## Validacao obrigatoria

Antes de considerar qualquer mudanca em cripto como "pronta":

1. Rodar todos os vetores de `test-vectors.json` e verificar igualdade byte-a-byte da derived key e do dataHash
2. Teste de round-trip com credencial que contem campos `null`, `undefined` (ausentes) e tipo desconhecido
3. Teste cross-decrypt: pegar snapshot real do web, descriptografar no iOS, verificar igualdade com plaintext esperado

Se algum vetor falhar, nao seguir para proxima etapa. Investigar ate bater bit-a-bit.

## Artefatos desta skill

- `SKILL.md` -- este arquivo
- `test-vectors.json` -- vetores gerados a partir do frontend (ver `generate-vectors.mjs`)
- `canonical-json-examples.md` -- exemplos de JSON exato para inputs conhecidos
- `generate-vectors.mjs` -- script Node.js que regenera os vetores executando o mesmo pipeline do frontend (usa `hash-wasm` e Web Crypto API do Node 18+)

## Como regenerar os vetores

```bash
# na raiz do repo
node .cursor/skills/swift-crypto-parity/generate-vectors.mjs
```

O script sobrescreve `test-vectors.json` com a saida determinista atual. Commitar o arquivo atualizado se houver mudanca proposital no pipeline; se houver mudanca nao-intencional, investigar antes.
