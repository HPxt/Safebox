# SafeBox AppSec Offensive Test Plan

Data: 2026-04-28  
Escopo: web e iOS contra backend local ou staging  
Regra: nunca executar contra producao, nunca usar dados reais, nunca executar ataques destrutivos.

## Ambiente Autorizado

- Local backend: `http://localhost:3001`
- Local web: `http://localhost:3000`
- Staging: usar somente URL de staging aprovada.
- Usuarios sinteticos:
  - `userA@appsec.test`
  - `userB@appsec.test`
  - `admin@appsec.test`
- Tokens nos testes automatizados:
  - `token-userA`
  - `token-userB`
  - `token-admin`
  - `invalid-token`
  - `expired-token`

No manual em Burp, crie as contas `userA`, `userB` e `admin` no Supabase local/staging. A conta `admin` deve ser usada apenas para validar que o cliente nao consegue se autoautorizar como admin quando o backend nao confia no frontend.

## Rotas Sensiveis Encontradas

### Auth

| Metodo | Rota | Risco principal |
|---|---|---|
| `POST` | `/api/auth/register` | abuso de cadastro, mass assignment, rate limit |
| `POST` | `/api/auth/login` | brute force, rate limit, erro excessivo |
| `POST` | `/api/auth/logout` | token ausente/invalido |
| `GET` | `/api/auth/profile` | vazamento de perfil |
| `PUT` | `/api/auth/profile` | mass assignment de `role`, `isAdmin`, `status`, `emailVerified` |
| `GET` | `/api/auth/crypto-profile` | vazamento de parametros sensiveis do usuario autenticado |
| `PUT` | `/api/auth/crypto-profile` | alteracao indevida de perfil criptografico |
| `POST` | `/api/auth/change-password` | troca indevida de senha, rate limit |
| `POST` | `/api/auth/refresh-token` | abuso de sessao |
| `GET` | `/api/auth/2fa/status` | enumeracao de estado 2FA |
| `POST` | `/api/auth/2fa/enable` | ativacao 2FA indevida |
| `POST` | `/api/auth/2fa/verify` | brute force de codigo 2FA, rate limit |
| `POST` | `/api/auth/2fa/disable` | desativacao 2FA indevida |
| `DELETE` | `/api/auth/account` | acao destrutiva; testar somente bloqueio/autorizacao em ambiente descartavel |

### Vault

| Metodo | Rota | Risco principal |
|---|---|---|
| `GET` | `/api/vault` | acesso sem token, IDOR por token |
| `POST` | `/api/vault` | `userId`/`ownerId`/`tenantId` adulterado, payload grande |
| `PUT` | `/api/vault` | alteracao indevida, optimistic lock bypass |
| `DELETE` | `/api/vault` | acao destrutiva; testar somente bloqueio/autorizacao em ambiente descartavel |
| `GET` | `/api/vault/stats` | vazamento de metadata |
| `POST` | `/api/vault/backup` | criacao indevida de backup |
| `GET` | `/api/vault/backups` | IDOR/listagem de backups |
| `POST` | `/api/vault/restore/:backupId` | IDOR entre backups |
| `GET` | `/api/vault/export` | vazamento integral do cofre |

### Settings

| Metodo | Rota | Risco principal |
|---|---|---|
| `GET` | `/api/settings` | vazamento de preferencias |
| `PUT` | `/api/settings` | campos extras aninhados, mass assignment |
| `GET` | `/api/settings/categories` | IDOR/listagem cross-user |
| `POST` | `/api/settings/categories` | alteracao de ownership no body |
| `PUT` | `/api/settings/categories/:id` | IDOR entre `userA` e `userB` |
| `DELETE` | `/api/settings/categories/:id` | IDOR/destruicao de recurso alheio |
| `GET` | `/api/settings/audit-logs` | vazamento de logs |
| `GET` | `/api/settings/sessions` | vazamento de sessoes |
| `DELETE` | `/api/settings/sessions/:id` | revogacao indevida de sessao |

### iOS / Supabase Direct

O iOS tambem usa rotas diretas do Supabase protegidas por RLS:

| Origem | Recurso | Risco principal |
|---|---|---|
| Supabase REST | `users?id=eq.<userId>&select=kdf_salt,kdf_params,key_hash` | IDOR/RLS no perfil KDF |
| Supabase REST | `credentials?user_id=eq.<userId>` | IDOR/RLS no cofre |
| Supabase REST | `vaults?user_id=eq.<userId>` | IDOR/RLS no cofre legado |
| Supabase REST | `folders?user_id=eq.<userId>` | IDOR/RLS em pastas |

## Roteiro Manual no Burp Suite

### 1. Preparar proxy

1. Rode backend e frontend em local ou staging autorizado.
2. Configure Burp Proxy em `127.0.0.1:8080`.
3. No navegador web, configure proxy HTTP/HTTPS para `127.0.0.1:8080`.
4. No iOS Simulator ou device de teste:
   - configure proxy Wi-Fi para o host do Burp;
   - instale o certificado CA do Burp;
   - aponte `backendURL`/Supabase para local ou staging.
5. Autentique como `userA`, `userB` e `admin`.
6. Envie requests reais para Repeater. Nao rode Intruder agressivo.

### 2. Acesso sem token

Para cada rota sensivel, remova o header:

```http
Authorization: Bearer <token>
```

Resultado esperado: `401` com `code: "UNAUTHORIZED"`.

### 3. Token invalido ou expirado

Substitua o token:

```http
Authorization: Bearer invalid-token
Authorization: Bearer expired-token
```

Resultado esperado: `403` com `code: "FORBIDDEN"` ou `401` se a sessao tiver expirado antes de chegar ao backend. A resposta nao deve revelar stack trace, SQL, path local ou segredo.

### 4. IDOR entre userA e userB

1. Como `userB`, crie uma categoria e capture o `id`.
2. Como `userA`, tente:

```http
PUT /api/settings/categories/<id-userB>
Authorization: Bearer <token-userA>
Content-Type: application/json

{"name":"takeover","color":"#112233"}
```

Resultado esperado: `404 NOT_FOUND` ou `403 FORBIDDEN`; nunca `200`.

Repita para:

- `/api/settings/sessions/:id`
- `/api/vault/restore/:backupId`
- `/api/vault/backups`
- `/api/vault/export`
- Supabase REST direto usado pelo iOS, trocando `user_id=eq.userA` por `user_id=eq.userB`.

### 5. Alteracao indevida de ownership

Em bodies validos, injete campos:

```json
{
  "userId": "user-b",
  "ownerId": "user-b",
  "tenantId": "tenant-b"
}
```

Alvos principais:

- `POST /api/vault`
- `PUT /api/vault`
- `PUT /api/settings`
- `POST /api/settings/categories`
- `PUT /api/settings/categories/:id`

Resultado esperado: `400 VALIDATION_ERROR` ou campo ignorado com ownership derivado do token. O backend nunca deve usar ownership vindo do cliente.

### 6. Mass assignment

Adicione campos proibidos:

```json
{
  "role": "admin",
  "isAdmin": true,
  "status": "active",
  "emailVerified": true
}
```

Alvos:

- `PUT /api/auth/profile`
- `PUT /api/settings`
- `POST /api/settings/categories`
- `PUT /api/auth/crypto-profile`

Resultado esperado: `400 VALIDATION_ERROR`; nenhum dado privilegiado alterado.

### 7. Campos extras em rotas criticas

Adicione campos extras no topo e dentro de objetos aninhados:

```json
{
  "security": {
    "sessionTimeout": 15,
    "isAdmin": true
  },
  "unexpected": true
}
```

Resultado esperado: `400 VALIDATION_ERROR`.

### 7.1. URL limpa e beacon/tracking

Objetivo: validar que campos de URL nao aceitam valores que possam virar tracking pixel/web beacon, recurso remoto ou alvo local caso sejam renderizados por engano no frontend.

No Burp, intercepte criacao/edicao de credencial ou perfil e troque campos como `website`, `uris[]` e `avatarUrl` por:

```json
{
  "website": "https://attacker.example/pixel.png",
  "uris": [
    "https://example.com/login?tracking=userA",
    "https://127.0.0.1/admin"
  ],
  "avatarUrl": "javascript:alert(1)"
}
```

Resultado esperado:

- frontend nao renderiza link clicavel para URL suja salva anteriormente;
- backend rejeita `avatarUrl` sujo com `400 VALIDATION_ERROR`;
- Supabase staging rejeita writes diretos em `credentials.website` e `credentials.uris`;
- CSP nao permite `img-src https:` arbitrario.

### 8. Payload grande

Envie body JSON acima de 2 MB em:

- `POST /api/vault`
- `PUT /api/vault`
- `PUT /api/settings`

Resultado esperado: `413 PAYLOAD_TOO_LARGE` sem stack trace.

### 9. Upload / MIME falso

Nao foi encontrada rota de upload dedicada no backend atual. Enquanto ela nao existir, valide rotas JSON-only com MIME falso:

```http
Content-Type: image/png

not-a-json-vault
```

Resultado esperado: `400 VALIDATION_ERROR` ou `415 UNSUPPORTED_MEDIA_TYPE`; nunca processar como upload valido.

Quando uma rota de upload existir, testar:

- extensao permitida com MIME falso;
- arquivo real de tipo proibido;
- arquivo acima do limite;
- conteudo poliglota;
- filename com path traversal.

### 10. Falha de autorizacao por perfil/permissao

Use `admin@appsec.test` e injete `role=admin` em token/body/local storage. Resultado esperado: sem backend admin configurado, acesso admin deve falhar fechado com `403` ou a rota deve permanecer inexistente.

### 11. Vazamento em erros

Force erro com body invalido, UUID invalido, payload grande e token invalido. Confirmar que a resposta nao contem:

- `stack`
- `C:\Users\`
- `backend/src`
- SQL bruto
- `service_role`
- JWT/token
- secrets ou senhas

### 12. Rate limit

Repetir tentativas de login com senha invalida em baixa frequencia controlada:

```http
POST /api/auth/login
Content-Type: application/json

{"email":"userA@appsec.test","password":"WrongPassword123!"}
```

Resultado esperado: depois do limite configurado, `429 TOO_MANY_REQUESTS` com `retryAfter`.

## Testes Automatizados Equivalentes

Arquivo:

```text
backend/src/__tests__/appsec.offensive.test.ts
```

Caracteristicas:

- sobe o Express app local em porta efemera;
- nao chama Supabase real;
- mocka `userA`, `userB`, `admin`, token invalido e token expirado;
- cobre 30 rotas protegidas sem token;
- valida token invalido/expirado;
- valida IDOR em categorias;
- valida ownership derivado do token;
- valida mass assignment;
- valida campos extras aninhados;
- valida JSON malformado;
- valida abuso de `limit` em listagens sensiveis;
- valida payload grande;
- valida MIME falso em endpoint JSON-only;
- valida ausencia de vazamento de erro;
- valida rate limit de login e 2FA verify;
- valida fail-closed para admin.

Comando:

```bash
npm run test:appsec
```

Resultado local em 2026-04-28:

```text
PASS src/__tests__/appsec.offensive.test.ts
Test Suites: 1 passed, 1 total
Tests: 48 passed, 48 total
```

Teste RLS/Supabase staging:

```bash
npm --prefix backend run test:db-security-integration
```

Para executar contra staging com variaveis locais ignoradas pelo Git:

```powershell
Get-Content .env.appsec.local | ForEach-Object { if ($_ -match '^\s*([^#][^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2], 'Process') } }; npm.cmd --prefix backend run test:db-security-integration
```

Resultado nesta sessao contra staging autorizado:

```text
PASS src/__tests__/db-security.integration.test.ts
Tests: 11 passed, 11 total
```

A suite provisionou usuarios temporarios, semeou dados de `userA` e `userB`, validou isolamento e regras de negocio, e executou limpeza ao final.

Cobertura real de staging:

- `SELECT` cross-tenant bloqueado em `credentials`, `audit_logs`, `user_settings`, `categories`, `folders`, `user_sessions`, `credential_backups`, `vaults` e `vault_backups`.
- `UPDATE` cross-tenant bloqueado em `credentials`, `user_settings`, `categories`, `folders`, `user_sessions` e `vaults`.
- `DELETE` cross-tenant bloqueado em `credentials`, `user_settings`, `categories`, `folders` e `vaults`.
- `INSERT` cross-tenant bloqueado em `credentials`, `categories`, `folders`, `user_settings`, `vaults` e `user_sessions`.
- IDOR por relacionamento interno bloqueado em `credentials.folder_id` e `folders.parent_id`.
- Mass assignment bloqueado em colunas sensiveis de `public.users`.
- Escrita direta client-side bloqueada em `audit_logs`, `user_sessions`, `credential_backups`, `vault_backups` e `two_factor_attempts`.
- Duplicidade de vault ativo bloqueada em `credentials` e `vaults`.
- Payload/formato invalido bloqueado para hashes, titulo vazio, campos gigantes e payload grande de vault.
- Campos estendidos de `credentials` bloqueados contra payload excessivo: `totp_secret`, `uris` e campos de cartao.
- RPC/funcoes internas nao chamaveis por `anon`/`authenticated`.
- Edge Functions: nenhuma exposta no staging.
- Storage buckets: nenhum bucket no staging.
- Views publicas: nenhuma view em `public` no staging.

Migrations de hardening aplicadas no Supabase staging:

```bash
npx supabase db query --linked --file docs/sql/migrations/008_business_rule_hardening.sql
npx supabase db query --linked --file docs/sql/migrations/009_rls_business_rule_extra_hardening.sql
npx supabase db query --linked --file docs/sql/migrations/010_revoke_trigger_function_execute.sql
npx supabase db query --linked --file docs/sql/migrations/011_credentials_extended_field_bounds.sql
```

Teste estatico web/CSP/XSS:

```bash
npm run test:appsec:static
```

Resultado:

```text
AppSec static checks passed
```

## Evidencias

| Risco testado | Resultado esperado | Evidencia |
|---|---|---|
| Acesso sem token | `401 UNAUTHORIZED` em rotas sensiveis | `blocks unauthenticated access to ...`, 30 casos |
| Token invalido | `403 FORBIDDEN` sem segredo | `blocks invalid-token on protected routes` |
| Token expirado | `403 FORBIDDEN` ou `401 UNAUTHORIZED` sem segredo | `blocks expired-token on protected routes` |
| Header `Authorization` com esquema incorreto | `401 UNAUTHORIZED`, sem chamar Supabase | `rejects non-Bearer authorization schemes without calling Supabase` |
| Header `Bearer` malformado | `401 UNAUTHORIZED`, sem aceitar token ambigue | `rejects malformed Bearer headers with extra tokens` |
| IDOR userA/userB em categoria | `404 NOT_FOUND` ou `403 FORBIDDEN` | `prevents userA from updating userB category by IDOR` |
| Query/body tentando trocar usuario | Ownership continua vindo do token | `keeps category reads scoped to userA even when query params ask for userB` |
| `userId`/`ownerId`/`tenantId` em vault | `400 VALIDATION_ERROR` | `rejects client-supplied userId, ownerId and tenantId on vault writes` |
| Mass assignment em perfil | `400 VALIDATION_ERROR` | `rejects mass assignment on profile updates` |
| Campos extras aninhados em settings | `400 VALIDATION_ERROR` | `rejects extra nested fields in settings updates` |
| Mass assignment em crypto-profile | `400 VALIDATION_ERROR` | `rejects mass assignment on crypto profile updates` |
| Ownership em categoria criada | `400 VALIDATION_ERROR` | `rejects ownership fields on category creation` |
| JSON malformado | `400 BAD_REQUEST` sem parser internals | `rejects malformed JSON bodies without leaking parser internals` |
| Payload grande | `413 PAYLOAD_TOO_LARGE` sem path/stack | `returns a controlled 413 for oversized JSON payloads` |
| MIME falso / upload inexistente | Request nao e processado como valido | `rejects fake MIME uploads sent to JSON-only critical endpoints` |
| Abuso de `limit` em listagens | `400 VALIDATION_ERROR` | `rejects out-of-range limit controls on sensitive list endpoints` |
| Falha de autorizacao por perfil | Admin client-side nao bypassa ownership | `does not let an admin-looking client token bypass resource ownership` |
| Admin nao configurado | Falha fechada com `403` | `keeps admin middleware fail-closed until explicit admin authorization is configured` |
| Vazamento de stack/SQL/path/token/segredo | Resposta generica `INTERNAL_ERROR` | `does not leak stack traces, SQL, paths, tokens or secrets on internal errors` |
| Debug de erro em development/staging | Sem `details.debug` em resposta para cliente | `non-exposed AppError never includes debug details in client responses` |
| Rate limit em login | `429 TOO_MANY_REQUESTS` apos limite | `rate limits repeated login attempts before backend auth logic is trusted` |
| Rate limit em 2FA verify | `429 TOO_MANY_REQUESTS` apos limite | `rate limits repeated 2FA verification attempts` |
| Override de token no helper web | `Authorization` da sessao Supabase prevalece | `does not allow callers to override the Supabase Authorization header` |
| RLS real em SELECT cross-tenant | `userA` recebe lista vazia ao consultar dados de `userB` | `user A cannot read rows owned by user B across multi-tenant tables` |
| RLS real em UPDATE cross-tenant | `userA` recebe lista vazia e nao altera dados de `userB` | `user A cannot update rows owned by user B across mutable multi-tenant tables` |
| RLS real em DELETE cross-tenant | `userA` recebe lista vazia e nao apaga dados de `userB` | `user A cannot delete rows owned by user B across mutable multi-tenant tables` |
| RLS real em INSERT cross-tenant | Supabase rejeita insert com `user_id` de outro usuario | `user A cannot insert rows for user B in tenant-owned tables` |
| IDOR por relacionamento interno no banco | Supabase rejeita `folder_id`/`parent_id` de outro usuario | `rejects user and tenant tampering inside relationships, not only top-level ownership` |
| Mass assignment direto em `users` | Supabase rejeita update de `email`, `status`, `login_count`, `key_hash`, `two_factor_enabled` | `blocks mass assignment of sensitive profile and auth columns` |
| Escrita direta em tabelas server-owned | Supabase rejeita insert de cliente autenticado | `rejects direct writes to audit, backup, session and 2FA auxiliary tables` |
| Duplicidade de vault ativo | Supabase rejeita segundo vault ativo por usuario | `enforces business rules for one active vault snapshot per user` |
| Payload/formato invalido direto no banco | Supabase rejeita hash invalido, titulo vazio e campos grandes | `enforces payload size and data format constraints against direct API writes` |
| Campos estendidos em `credentials` | Supabase rejeita payload excessivo em TOTP/URI/cartao | `enforces bounds on extended credential, folder, category and settings fields` |
| RPC/funcoes internas | Supabase nao expoe/chama funcoes internas por cliente | `rejects direct RPC calls to internal trigger functions` |
| Backup/restore/export | Ownership derivado do token; body adulterado falha | `scopes backup, restore and export flows to the authenticated user` |
| Headers defensivos backend | CSP, nosniff, frame deny, referrer e permissions presentes | `sets defensive API security headers` |
| Headers defensivos Vercel | `vercel.json` e `frontend/vercel.json` declaram CSP/HSTS/permissions | `npm run test:appsec:static` |
| Fallback de API em deploy estatico | `/api/*` nao deve ser reescrito para HTML SPA | `npm run test:appsec:static` valida exclusao de `/api/*`; revalidar apos deploy |

## Observacoes de Hardening Aplicadas

- `settingsSchema` agora rejeita campos extras tambem dentro de `security`, `generator` e `ui`.
- Erros 4xx gerados pelo parser HTTP, como payload acima do limite, agora sao normalizados sem vazar mensagem interna.
- Erros internos nao expostos nao retornam mais `details.debug` para clientes, mesmo em `NODE_ENV=development`.
- O backend agora exige header `Authorization: Bearer <token>` estrito.
- O helper web de API aplica o token Supabase da sessao por ultimo, impedindo override acidental por `init.headers`.
- `/api/auth/2fa/verify` agora tem rate limit dedicado para reduzir brute force de codigo 2FA.
- O timer de limpeza de seguranca usa `unref()` para nao prender a suite Jest.
- Supabase staging recebeu hardening SQL 008/009 para reforcar RLS, grants, triggers de ownership, indices unicos e constraints de payload.
- Supabase staging recebeu hardening SQL 010/011 para revogar RPC de funcoes internas e limitar campos estendidos de credentials.
- Deploy estatico Vercel recebeu headers defensivos em `vercel.json` e `frontend/vercel.json`.
- Fallback SPA da Vercel agora exclui `/api/*` para evitar `200 text/html` em rotas API inexistentes.
