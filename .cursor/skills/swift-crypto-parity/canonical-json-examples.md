# Canonical JSON Examples (iOS <-> Web parity)

Este documento mostra **exemplos exatos** de JSON como o web produz, e como o iOS deve produzir de volta. Qualquer byte diferente quebra o `dataHash` e e rejeitado pelo backend.

## 1. Envelope `vault-snapshot-v2`

### Forma canonica (unica aceita)

Ordem literal das chaves: `version`, `nonce`, `encrypted`. Sem espacos. UTF-8 sem BOM.

```json
{"version":"vault-snapshot-v2","nonce":"oLHC0+T1BhcoOUpb","encrypted":"x4n2WVbbuPqFOSTUvh8ahaYTbm7/Z5lM9uw4ItJ4IJucxL1gOsFLTbtY5QD1m8MrhxfxUmPx+6rnIhArZvz3YBARK+9l8ENpcuoDZD/TX6sIv7N6DLAdWGnRf5yMOHHJeyLW7IpIn3LU0KXIwTzYUxPhMdGWTyZeTnkpFMBcaVY/KiH+jwFJn1MoGIc7Fi22xTHz4cjMqiUBZopFzO/9bi0L/zq5Nyubr1XoQWJk4X+PVaveMPwouM1JNS6k011jOUZe9HLk"}
```

Hash esperado: `9a5fcdd85e01f3c382d81f7373b99102a4d9e9b0dcaa917f9eb6ada7c1229095` (SHA-256 hex lower).

### Formas ERRADAS (nao usar)

```json
// ERRO: ordem diferente (encrypted antes de nonce)
{"version":"vault-snapshot-v2","encrypted":"...","nonce":"..."}
```

```json
// ERRO: chaves sorteadas alfabeticamente
{"encrypted":"...","nonce":"...","version":"vault-snapshot-v2"}
```

```json
// ERRO: espacos apos : e ,
{"version": "vault-snapshot-v2", "nonce": "...", "encrypted": "..."}
```

```json
// ERRO: pretty-printed
{
  "version": "vault-snapshot-v2",
  "nonce": "...",
  "encrypted": "..."
}
```

### Implementacao Swift correta

```swift
struct VaultEnvelope: Encodable {
    let version: String
    let nonce: String
    let encrypted: String

    // Ordem do web. CodingKeys define a ordem de saida do JSONEncoder padrao.
    enum CodingKeys: String, CodingKey {
        case version, nonce, encrypted
    }
}

let encoder = JSONEncoder()
// NAO usar .sortedKeys. NAO usar .prettyPrinted.
encoder.outputFormatting = []
let bytes = try encoder.encode(envelope)
```

Validar com o vetor `aead-envelope-v2` em `test-vectors.json` antes de seguir.

## 2. Payload interno (array de credenciais)

### Caso: credencial com campos `null` explicitos

O frontend usa `totpSecret: null` com significado **"o usuario removeu o TOTP"** -- diferente de "campo nunca setado".

Web produz:

```json
[{"id":"fixed-id-0001","itemType":"credential","title":"Example","username":"user@example.com","encryptedPassword":"test-login-secret","website":"https://example.com","notes":null,"totpSecret":null}]
```

### iOS correto

- Preservar `null` literal nos campos `notes` e `totpSecret`
- Nao trocar por `""`
- Nao omitir a chave

Estrategia recomendada: **passthrough do dicionario original** quando a credencial nao foi editada.

```swift
// Ao carregar do servidor:
let plaintext: Data = ... // saida do AES.GCM.open
let root = try JSONSerialization.jsonObject(with: plaintext, options: []) as! [[String: Any]]
// root[i]["totpSecret"] pode ser NSNull() -- preservar

// Se usuario NAO editou, re-serializar o mesmo root:
let output = try JSONSerialization.data(withJSONObject: root, options: [])
// O output e byte-identico ao plaintext original na maioria dos casos
// (JSONSerialization mantem ordem de chaves do dicionario fornecido em Swift 5+
//  quando usando NSMutableDictionary / [String: Any] vindos de parse).
```

### Caso: credencial editada ou nova

Usar `JSONEncoder` com ordem das chaves definida explicitamente via `CodingKeys`:

```swift
struct Credential: Codable {
    let id: String
    let itemType: String
    let title: String?
    let username: String?
    let password: String?
    let website: String?
    let notes: String?
    let totpSecret: String?
    let cardHolderName: String?
    let cardNumber: String?
    let cardBrand: String?
    let cardExpMonth: String?
    let cardExpYear: String?
    let cardCvv: String?

    // Ordem canonica decidida aqui. Web nao garante ordem para edits,
    // entao iOS adota essa ordem como padrao estavel.
    enum CodingKeys: String, CodingKey {
        case id
        case itemType
        case title
        case username
        case password
        case website
        case notes
        case totpSecret
        case cardHolderName
        case cardNumber
        case cardBrand
        case cardExpMonth
        case cardExpYear
        case cardCvv
    }

    // CRITICO: encode manual para distinguir null de omitido
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(itemType, forKey: .itemType)

        // Regra: campos SEMPRE presentes no schema web -> encode com null se nil
        //        campos de tipo-especifico -> encodeIfPresent para omitir quando nil
        //
        // Aqui, "notes" e "totpSecret" sao comuns a credenciais e tem
        // semantica de "null explicito". Encodar com encode(), nao encodeIfPresent.
        try c.encode(title, forKey: .title)
        try c.encode(username, forKey: .username)
        try c.encode(password, forKey: .password)
        try c.encode(website, forKey: .website)
        try c.encode(notes, forKey: .notes)
        try c.encode(totpSecret, forKey: .totpSecret)

        // Campos exclusivos de cartao: omitir quando nao for cartao (itemType != "card")
        try c.encodeIfPresent(cardHolderName, forKey: .cardHolderName)
        try c.encodeIfPresent(cardNumber, forKey: .cardNumber)
        try c.encodeIfPresent(cardBrand, forKey: .cardBrand)
        try c.encodeIfPresent(cardExpMonth, forKey: .cardExpMonth)
        try c.encodeIfPresent(cardExpYear, forKey: .cardExpYear)
        try c.encodeIfPresent(cardCvv, forKey: .cardCvv)
    }
}
```

**Nota**: o `Encoder` keyed container do Swift, quando se chama `encode(nil as String?, forKey:)`, emite `null` no JSON. Isso e o comportamento desejado.

### Erros comuns de serializacao

```json
// ERRO: null virou ""
[{"id":"...","notes":"","totpSecret":""}]
```

```json
// ERRO: campo null foi omitido
[{"id":"..."}]
```

```json
// ERRO: campos exclusivos de cartao serializados como null em credencial
[{"id":"...","itemType":"credential","title":"X","cardHolderName":null,"cardNumber":null,...}]
```

## 3. Checklist de validacao de serializacao

Antes de considerar o serializador iOS pronto:

- [ ] Round-trip: vault baixado do web -> descriptografado no iOS -> re-criptografado sem edicao -> comparar byte-a-byte com plaintext original (deve ser identico)
- [ ] Vetor `aead-envelope-v2` passa: dataHash do envelope serializado = `9a5fcdd85e01f3c382d81f7373b99102a4d9e9b0dcaa917f9eb6ada7c1229095`
- [ ] Credencial com `totpSecret: null` permanece `null` apos round-trip
- [ ] Credencial tipo `credential` nao vaza campos de cartao (`cardNumber` etc) como null
- [ ] Credencial tipo `card` preserva todos os campos de cartao, incluindo `null` onde aplicavel
- [ ] Tipo de item desconhecido (ex: futuro `itemType: "secure-note-v2"`) passa por passthrough sem perder campos

## 4. Base64: casos de borda

Web usa `btoa(String.fromCharCode(...))` que **sempre** retorna base64 com:
- alfabeto padrao (`A-Z a-z 0-9 + /`)
- padding `=` quando necessario
- sem quebras de linha

Swift `Data.base64EncodedString(options:)` com opcoes default (`.init(rawValue: 0)`) produz exatamente isso.

**Erro comum no iOS**: passar `.lineLength64Characters` inserindo `\r\n` a cada 64 caracteres. NAO fazer.

## 5. Referencia cruzada

- `test-vectors.json` -- vetores gerados deste documento
- `frontend/src/services/cryptoService.ts` -- pipeline original
- `frontend/src/services/credentialsService.ts` -- construcao do envelope
- `backend/src/domain/vault/VaultSnapshotService.ts` -- validacao do dataHash
