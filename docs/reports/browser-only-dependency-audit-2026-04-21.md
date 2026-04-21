# Browser-only Dependency Audit (Etapa 2)

Date: 2026-04-21  
Scope:
- `backend/package.json`
- `frontend/package.json`
- `backend/src/**` runtime API usage checks

## Objective

Prevent accidental coupling between:
- backend runtime (Node.js)
- iOS runtime (Swift / Foundation / CryptoKit)
- browser-only APIs (DOM/Web Storage/Window-only globals)

This audit supports Etapa 2 requirement: "auditar dependencias browser-only".

## 1) Backend runtime check

### 1.1 Browser globals in backend source

Search performed over `backend/src`:
- `window.`
- `document.`
- `localStorage`
- `sessionStorage`
- `atob(`
- `btoa(`

Result: **no matches found**.

Conclusion: backend runtime code is not using browser-only globals.

### 1.2 Backend dependencies review (`backend/package.json`)

All runtime dependencies are server-compatible (`express`, `zod`, `helmet`, `ioredis`, `@supabase/supabase-js`, etc.).

No obvious browser-only package found in backend dependencies.

## 2) Frontend-only crypto/runtime packages (expected, not backend-safe)

From `frontend/package.json`, these are expected browser/web-app dependencies:

| Package | Classification | Notes |
|---|---|---|
| `react`, `react-dom`, `react-router-dom` | Browser/web UI | Not reusable in backend/iOS native runtime |
| `framer-motion` | Browser UI animation | Web-only |
| `qrcode.react` | Browser React component | Web-only |
| `hash-wasm` | Cross-runtime but currently web pipeline dependency | iOS must use native equivalent (Argon2id lib in Swift) |
| `otpauth` | JS runtime utility | iOS should use native TOTP implementation or audited Swift lib |
| `dompurify` | DOM sanitizer | Browser-specific behavior |

This is expected for frontend; do **not** import these packages in backend.

## 3) iOS impact and guardrails

### Required guardrails

1. Keep protocol parity by vectors/spec, not by sharing browser packages.
2. iOS implementation MUST NOT depend on browser semantics (`btoa`, `atob`, DOM APIs).
3. Add CI/PR guard for backend to reject browser globals in `backend/src` (recommended next step).

### Recommended follow-up guard (CI)

Add a lightweight check script that fails if `backend/src` contains:
- `window`
- `document`
- `localStorage`
- `sessionStorage`

## 4) Decision

Current state is acceptable:
- backend has no browser-only runtime dependency usage;
- frontend browser-only dependencies are isolated to frontend workspace.

No blocking issue found for iOS implementation start.

