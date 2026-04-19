# Quality Gate

Esta e a bateria oficial que deve passar antes de continuar qualquer alteracao no projeto.

## Regra de trabalho

- Sempre rodar a bateria completa apos cada subetapa.
- So continuar quando todos os comandos passarem.
- Nao mascarar falhas com `|| true`, `--passWithNoTests` ou equivalentes.
- Se um teste falhar, corrigir primeiro e rerodar a bateria inteira.

## Execucao local

No ambiente atual do Windows, o frontend compila de forma confiavel apenas quando o comando
e executado diretamente dentro da pasta `frontend`. Por isso, a bateria local oficial deve
ser rodada nesta ordem:

```powershell
cd C:\Users\KABUM\Documents\SafeBox\Safebox-3\frontend
npm test -- --watchAll=false
npm run build

cd C:\Users\KABUM\Documents\SafeBox\Safebox-3\backend
npm run lint
npm run type-check
npm test -- --runInBand
npm run build
```

## Execucao automatizada

- O reposit�rio deve ter um workflow de CI para rodar esta mesma bateria em `push` e `pull_request`.
- Localmente, continuamos tratando os comandos acima como gate obrigatorio antes de seguir.

## O que a bateria roda

### Frontend

- `npm run test:frontend`
- `npm run build:frontend`

Cobertura atual relevante:

- `settingsService.test.ts`
  - compatibilidade de preferencias no schema legado e no fallback
- `importExportUtils.test.ts`
  - round-trip de export/import/backup do snapshot atual
- `TwoFactorVerification.test.tsx`
  - fluxo de verificacao 2FA no frontend

### Backend

- `npm run lint:backend`
- `npm run typecheck:backend`
- `npm run test:backend`
- `npm run build:backend`

Observacao:

- O gate atual compila a API principal do backend.
- A camada `src/ai` foi separada como trilha propria e ainda precisa de saneamento de build
  antes de entrar no gate principal.

Cobertura atual relevante:

- `VaultSnapshotService.test.ts`
  - versao esperada e conflitos no vault
- `validation.test.ts`
  - validacao compartilhada
- `redaction.test.ts`
  - redaction de logs
- `outboundHttp.test.ts`
  - allowlist e hardening de HTTP outbound
- `twoFactor.test.ts`
  - criptografia/verificacao de 2FA

## Quando usar comandos isolados

Pode usar comandos isolados durante diagnostico rapido, mas eles nao substituem a bateria final:

```powershell
npm run test:frontend
npm run build:frontend
npm run lint:backend
npm run typecheck:backend
npm run test:backend
npm run build:backend
```

## Proxima expansao recomendada

- adicionar testes de fallback do vault no frontend
- adicionar testes de criar/editar credencial
- adicionar testes de preferencias via componente/contexto
- adicionar testes de regressao para deploy estatico da Vercel
