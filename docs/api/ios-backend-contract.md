# SafeBox Backend API Contract for iOS

Version: 2026-04-21  
Scope: `backend/src/routes/auth.routes.ts`, `vault.routes.ts`, `settings.routes.ts`  
Audience: iOS client (`safebox-ios`) and backend maintainers

## 1) Global response shape

### Success

```json
{
  "success": true,
  "data": {},
  "message": "optional",
  "...extra": {}
}
```

- Produced by `sendSuccess()` in `backend/src/security/http.ts`
- `data` and `message` are optional

### Error

```json
{
  "success": false,
  "error": "human readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

- Produced by `toClientErrorResponse()` in `backend/src/security/errors.ts`
- `details`:
  - present for exposed errors with details (`ValidationError` etc.)
  - present only in development for internal errors (`details.debug`)
  - omitted in production for internal errors

## 2) Stable error code catalog

| HTTP | `code` | Meaning | iOS expected handling |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request body/query/path or invalid 2FA code | show field/message, keep user in current flow |
| 401 | `UNAUTHORIZED` | Missing/invalid auth token, expired session | force re-auth session |
| 403 | `FORBIDDEN` | Authenticated but not allowed | show permission message |
| 404 | `NOT_FOUND` | Route/resource not found | show empty/not-found state |
| 409 | `CONFLICT` | Optimistic lock conflict / unique constraint business conflict | force refresh + retry flow |
| 429 | `TOO_MANY_REQUESTS` | Rate limiting | backoff/retry with UX feedback |
| 5xx | `INTERNAL_ERROR` | Internal backend failure | generic error + retry |
| 502 | `EXTERNAL_SERVICE_ERROR` | Upstream service failure | retry / degraded mode |
| 410 | `LEGACY_BACKEND_AUTH_DISABLED` | Legacy `/auth/register` and `/auth/login` disabled | iOS must use Supabase-native auth |

### Route not found consistency

Non-existent routes return:

```json
{
  "success": false,
  "error": "Route not found",
  "code": "NOT_FOUND"
}
```

## 3) Endpoint contract for iOS critical path

### 3.1 Vault (`/api/vault`)

#### `GET /api/vault`

- 200 success:
  - `data` is either `null` or:
    - `id`, `encryptedData`, `dataHash`, `version`, `createdAt`, `updatedAt`, `storageMode`

#### `POST /api/vault`

- Body:
  - `encryptedData: string`
  - `dataHash: string` (hex64)
- 201 success: created vault payload in `data`
- Errors:
  - `VALIDATION_ERROR` invalid schema/hash
  - `CONFLICT` vault already exists

#### `PUT /api/vault`

- Body:
  - `encryptedData: string`
  - `dataHash: string` (hex64)
  - `expectedVersion: number` (int >= 1)
- 200 success: updated vault payload in `data`
- Errors:
  - `VALIDATION_ERROR` invalid body/hash mismatch
  - `NOT_FOUND` no vault
  - `CONFLICT` optimistic lock

#### `DELETE /api/vault`

- Body:
  - `expectedVersion: number`
- 200 success with message
- Errors:
  - `VALIDATION_ERROR`
  - `NOT_FOUND`
  - `CONFLICT`

### 3.2 2FA (`/api/auth/2fa/*`)

#### `GET /api/auth/2fa/status`

- 200 success: `data.enabled: boolean`

#### `POST /api/auth/2fa/enable`

- Body:
  - `secret: string`
  - `verificationCode: string` (`^\d{6}$`)
  - `backupCodes: string[]` (4..20)
- 200 success with message
- Error:
  - `VALIDATION_ERROR` for invalid activation code or schema

#### `POST /api/auth/2fa/verify`

- Body:
  - `code: string` (6..32)
- 200 success:
  - `data.verified: boolean`
  - `data.usedBackupCode: boolean`

#### `POST /api/auth/2fa/disable`

- 200 success with message

### 3.3 Settings (`/api/settings`)

#### `GET /api/settings`

- 200 success: `data` is `null` or settings object

#### `PUT /api/settings`

- Body fields under `security`, `generator`, `ui`
- 200 success: normalized settings in `data`
- Errors:
  - `VALIDATION_ERROR` (schema/range)

### 3.4 Account deletion (`DELETE /api/auth/account`)

- 200 success with message
- iOS caller must execute local wipe after success:
  - keychain
  - app group artifacts
  - donated autofill identities
  - memory key state

## 4) Mapping rules for iOS networking layer

- Parse `success` first.
- If `success === false`, trust `code` for machine flow; use `error` for UX text.
- Keep a fallback branch for old errors with missing `code` (treat as `INTERNAL_ERROR`).
- For `CONFLICT` on vault update, iOS must fetch latest vault and ask user to retry merge/save.

## 5) Security notes

- Never show raw `details.debug` in production UI.
- Never log full `error.details` without redaction on mobile telemetry.
- Do not branch logic on `error` message strings; always prefer `code`.

