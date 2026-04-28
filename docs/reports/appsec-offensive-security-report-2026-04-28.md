# SafeBox Offensive AppSec Security Report

Data: 2026-04-28  
Escopo executado nesta sessao: backend local com Express real e dependencias externas mockadas.  
Escopo preparado para execucao manual: web e iOS via Burp Suite contra local ou staging autorizado.

## Resumo Executivo

Foi criada e executada uma bateria ofensiva controlada para validar que o frontend web e o app iOS nao sao camadas confiaveis. Os testes simulam adulteracoes tipicas feitas em Burp Suite: remover token, trocar token, tentar IDOR, injetar ownership no body, fazer mass assignment, enviar payload grande, falsificar MIME, provocar erro interno e forcar rate limit.

Resultado local:

```text
npm run test:appsec
PASS src/__tests__/appsec.offensive.test.ts
Tests: 48 passed, 48 total
```

Tambem foram executados:

```text
npm --prefix backend test -- --runInBand
PASS
Test Suites: 10 passed, 1 skipped, 11 total
Tests: 85 passed, 2 skipped, 87 total
```

```text
npm --prefix backend run test:db-security-integration
Test Suites: 1 skipped
Tests: 2 skipped
Motivo: variaveis de staging ausentes nesta maquina.
```

```text
npm --prefix backend test -- --runInBand src/security/errors.test.ts src/security/validation.test.ts
PASS
```

```text
npm --prefix backend run type-check
PASS
```

## O Que Foi Testado

| Classe de vulnerabilidade | Status nesta bateria | Evidencia |
|---|---|---|
| Broken authentication: acesso sem token | Coberto | 30 rotas sensiveis retornam `401 UNAUTHORIZED` |
| Token invalido ou expirado | Coberto | `invalid-token` e `expired-token` retornam `403 FORBIDDEN` |
| IDOR / Broken Object Level Authorization | Coberto | `userA` nao atualiza categoria de `userB` |
| Tenant/user ownership tampering | Coberto | `userId`, `ownerId`, `tenantId` sao rejeitados/ignorados |
| Mass assignment | Coberto | `role`, `isAdmin`, `status`, `emailVerified` rejeitados |
| Campos extras em rotas criticas | Coberto | Zod `.strict()` em objetos top-level e aninhados |
| JSON malformado | Coberto | `400 BAD_REQUEST` sem stack/path |
| Payload grande | Coberto | `413 PAYLOAD_TOO_LARGE` sem vazamento |
| MIME falso / upload inexistente | Coberto parcialmente | endpoint JSON-only nao processa `image/png` como upload |
| Pagination abuse | Coberto | `limit=9999` retorna `400 VALIDATION_ERROR` |
| Falha de autorizacao por perfil | Coberto | token com aparencia de admin nao bypassa ownership |
| Admin fail-closed | Coberto | admin middleware retorna `403` enquanto RBAC nao esta configurado |
| Vazamento de erro | Coberto | sem stack trace, SQL, path local, token ou segredo |
| Rate limit em login | Coberto | `429 TOO_MANY_REQUESTS` apos limite |
| Rate limit em 2FA verify | Coberto e hardening aplicado | `429 TOO_MANY_REQUESTS` apos limite |
| RLS/Supabase real staging | Preparado, nao executado nesta sessao | suite existe, mas credenciais staging nao estavam no ambiente |

## O Que Mudou no Codigo

- `backend/src/__tests__/appsec.offensive.test.ts`: nova bateria ofensiva automatizada.
- `backend/src/routes/settings.routes.ts`: objetos aninhados de settings agora rejeitam campos extras.
- `backend/src/security/errors.ts`: erros 4xx do parser HTTP sao normalizados sem vazar detalhes internos.
- `backend/src/middleware/rateLimiting.middleware.ts`: novo rate limit dedicado para 2FA verify.
- `backend/src/routes/auth.routes.ts`: `/api/auth/2fa/verify` usa o rate limit dedicado.
- `backend/src/middleware/security.middleware.ts`: timer de limpeza usa `unref()` para nao prender Jest.
- `package.json` e `backend/package.json`: novo comando `test:appsec`.

## O Que Podemos Afirmar Com Base Nesta Execucao

O backend demonstrou protecao contra as classes testadas na camada HTTP/API local. Em especial, as rotas sensiveis nao aceitaram confiar em valores vindos do frontend para autenticacao, ownership, tenant, perfil ou permissoes.

Esta execucao nao prova seguranca absoluta contra todas as variantes possiveis. Ela prova que os cenarios ofensivos documentados aqui estao cobertos por testes automatizados e que passaram em ambiente local controlado.

## Limites e Proximos Passos

1. Executar `RUN_DB_SECURITY_INTEGRATION=1 npm --prefix backend run test:db-security-integration` contra staging autorizado para validar RLS real com `userA` e `userB`.
2. Rodar o roteiro Burp em `docs/reports/appsec-offensive-test-plan-2026-04-28.md` contra staging, com usuarios reais de teste.
3. Quando existir rota de upload backend, adicionar testes reais de arquivo invalido, MIME falso, tamanho excessivo e filename malicioso.
4. Ampliar testes iOS de rede para garantir que erros `401`, `403`, `409`, `413` e `429` geram UX segura e nao logs sensiveis.
