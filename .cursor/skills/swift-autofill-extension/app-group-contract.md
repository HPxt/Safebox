# App Group Contract (SafeBox iOS)

Define exatamente quais arquivos e valores ficam no container compartilhado entre o host app e o AutoFill extension, alem de regras de atomicidade, protecao e migracao.

## 1. Identificadores

| Tipo                       | Valor                                                   |
|----------------------------|---------------------------------------------------------|
| App Group container        | `group.app.safebox.ios.shared`                          |
| Keychain Access Group      | `$(AppIdentifierPrefix)app.safebox.ios.shared`          |
| Host bundle ID             | `app.safebox.ios`                                       |
| Extension bundle ID        | `app.safebox.ios.AutoFill`                              |

## 2. Arquivos no container (`FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`)

### Obrigatorios

| Path relativo              | Conteudo                             | File Protection                | Owner (escrita)   | Reader             |
|----------------------------|--------------------------------------|--------------------------------|--------------------|--------------------|
| `autofill/index.enc`       | AES-GCM ciphertext+tag do index JSON | `NSFileProtectionComplete`     | host app            | host + extension   |
| `autofill/index.nonce`     | Nonce 12 bytes em base64             | `NSFileProtectionComplete`     | host app            | host + extension   |
| `autofill/meta.json`       | `{ "version": 1, "updatedAt": ISO }` | `NSFileProtectionComplete`     | host app            | host + extension   |

### Opcionais (Etapa 6+)

| Path relativo                         | Conteudo                                         | File Protection             |
|---------------------------------------|--------------------------------------------------|-----------------------------|
| `autofill/per-credential/<id>.enc`    | Senha completa encriptada (para offline AutoFill)| `NSFileProtectionComplete`  |
| `diagnostics/last-error.txt`          | Log de ultimo erro (sem dados sensiveis)         | `NSFileProtectionComplete`  |

## 3. Atomicidade na escrita

Escrever em arquivos compartilhados exige:

1. Gravar em arquivo temp: `autofill/index.enc.tmp`
2. `FileManager.default.replaceItem(at: dest, withItemAt: src, ...)` para atomicidade
3. Nao existe transacao cross-files do lado do iOS; portanto gravar `meta.json` **por ultimo** (o extension le meta primeiro para saber se pode confiar no resto)

```swift
func atomicWriteIndex(cipher: Data, nonce: Data, updatedAt: Date) throws {
    let base = containerURL.appendingPathComponent("autofill", isDirectory: true)
    try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    
    let tmpCipher = base.appendingPathComponent("index.enc.tmp")
    let tmpNonce = base.appendingPathComponent("index.nonce.tmp")
    let tmpMeta = base.appendingPathComponent("meta.json.tmp")

    try cipher.write(to: tmpCipher, options: [.atomic, .completeFileProtection])
    try nonce.write(to: tmpNonce, options: [.atomic, .completeFileProtection])
    let meta = try JSONEncoder().encode(AutoFillMeta(version: 1, updatedAt: updatedAt))
    try meta.write(to: tmpMeta, options: [.atomic, .completeFileProtection])

    let destCipher = base.appendingPathComponent("index.enc")
    let destNonce  = base.appendingPathComponent("index.nonce")
    let destMeta   = base.appendingPathComponent("meta.json")

    _ = try FileManager.default.replaceItemAt(destCipher, withItemAt: tmpCipher)
    _ = try FileManager.default.replaceItemAt(destNonce,  withItemAt: tmpNonce)
    // meta por ultimo: se algum passo acima falhar, extension continua usando versao anterior
    _ = try FileManager.default.replaceItemAt(destMeta,   withItemAt: tmpMeta)
}
```

## 4. Keychain compartilhado (nao e arquivo)

Itens com `kSecAttrAccessGroup = "$(AppIdentifierPrefix)app.safebox.ios.shared"`:

- `autofill_shared_index_key` (32 bytes, accessibility `AfterFirstUnlockThisDeviceOnly`, access control `.biometryCurrentSet`)

Nenhum outro item do host app fica compartilhado. Tokens do Supabase e chave AES principal **ficam isolados** no access group default do host (o prefix automatico do bundle id), inacessiveis pela extension.

## 5. Permissao de leitura

A extensao precisa **ler** (nunca escrever) estes arquivos e este item do Keychain. Por design:

- Host app escreve tudo durante login/sync/CRUD
- Extension so le, decripta, responde ao iOS

Se o extension precisar "anotar" algo (ex: diagnostics), escrever em `diagnostics/last-error.txt` (file protection `Complete`) que host app pode ler posteriormente.

## 6. Versionamento

### meta.json

```json
{
  "version": 1,
  "updatedAt": "2026-04-20T12:00:00Z"
}
```

### Regras de evolucao

- Adicionar campos opcionais: bump **minor** implicito (version continua igual; extension ignora campos desconhecidos)
- Mudar formato incompativel (ex: estrutura do index.enc): bump `version` para 2; extension antigo detecta e ignora, solicita abrir host app
- Nunca apagar um campo; sempre deprecar via documentacao e deixar presente por 2 releases

### Handshake no extension

```swift
func loadIndex() async throws -> AutoFillIndex {
    let meta = try loadMeta()
    guard meta.version == 1 else {
        // Versao desconhecida => nao usar
        throw AutoFillError.incompatibleIndexVersion
    }
    // ... prosseguir
}
```

## 7. Limpeza (wipe)

Deletar **todos** os artefatos em:

- Logout manual
- Account deletion
- Rotacao de senha-mestra (sera regenerado no proximo sync)

```swift
func wipeAppGroupAutoFillArtifacts() throws {
    let base = containerURL.appendingPathComponent("autofill", isDirectory: true)
    if FileManager.default.fileExists(atPath: base.path) {
        try FileManager.default.removeItem(at: base)
    }
    // Keychain e tratado separado por swift-keychain-secure
}
```

## 8. Nao fazer

- NAO gravar senha/notes/totpSecret em claro em nenhum arquivo do container
- NAO gravar a chave AES principal (so a derivada HKDF do index)
- NAO usar `UserDefaults(suiteName: "group.app.safebox.ios.shared")` para guardar nada sensivel; so pode guardar flags booleanas de UI
- NAO assumir que o extension sempre tem acesso: em alguns estados (device trancado logo apos boot), `AfterFirstUnlock` pode nao estar satisfeito => tratar `errSecInteractionNotAllowed`
- NAO sobrescrever arquivo sem escrever em temp + replace: leitor simultaneo (extension) pode pegar arquivo no meio
