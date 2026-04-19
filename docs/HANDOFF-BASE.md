# SafeBox Handoff Base

Este arquivo e a base de handoff para quando o limite semanal estiver perto de acabar.
Atualize este documento quando restarem cerca de `2%` de uso, para que o trabalho possa
continuar no Cursor ou em outra conta do Codex sem perda de contexto.

## Regras de seguranca e continuidade

- Nao fazer `db reset`, `migration` destrutiva, limpeza de dados ou qualquer operacao com risco de perda do banco.
- Tratar o cofre como sensivel: preservar sempre o snapshot atual, o controle de versao do vault e os formatos de backup/import/export.
- Antes de qualquer alteracao relevante:
  - revisar `git status`
  - revisar arquivos tocados recentemente
  - validar se a mudanca nao reabre risco de `service_role`, `secret exposure` ou `tenant isolation`
- Depois de cada subetapa:
  - rodar os testes relevantes
  - confirmar se nao quebrou alteracoes anteriores

## Estado arquitetural atual

### Fronteira oficial do sistema

- Frontend:
  - manipula o ciphertext do vault
  - serializa/deserializa o snapshot cifrado
  - nunca deve enviar senha mestra em claro ao backend
- Backend:
  - centraliza auth, sessao, audit, validacao, hardening e regras do vault
  - usa cliente user-scoped com token do Supabase nas rotas migradas
- Banco:
  - sem alteracoes destrutivas nesta trilha
  - RLS ja existente e aproveitada nas rotas migradas

### Componentes importantes

- Vault domain:
  - [VaultSnapshotService.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/domain/vault/VaultSnapshotService.ts)
  - [VaultSnapshotRepository.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/domain/vault/VaultSnapshotRepository.ts)
  - [VaultBackupRepository.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/domain/vault/VaultBackupRepository.ts)
- Shared security layer:
  - [validation.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/security/validation.ts)
  - [authorization.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/security/authorization.ts)
  - [redaction.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/security/redaction.ts)
  - [outboundHttp.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/security/outboundHttp.ts)
  - [errors.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/backend/src/security/errors.ts)
- Frontend bridge:
  - [backendApi.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/frontend/src/services/backendApi.ts)
  - [credentialsService.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/frontend/src/services/credentialsService.ts)
  - [settingsService.ts](C:/Users/KABUM/Documents/SafeBox/Safebox-3/frontend/src/services/settingsService.ts)

## Correcoes ja concluidas

- Historico vulneravel do GitHub reescrito e `main` saneada.
- 2FA movido para verificacao server-side com segredo criptografado.
- Import/export/backup corrigidos para usar o snapshot atual do vault.
- `expectedVersion` exigido em mutacoes sensiveis do vault.
- `settings` migrado para backend com cliente user-scoped.
- `express-slow-down` warning corrigido no `npm run dev`.
- Backend sem vulnerabilidades no `npm audit`.
- Frontend com `0` vulnerabilidades em `npm audit --omit=dev`.
- Workflow de deploy da Vercel atualizado para CLI atual em:
  - [.github/workflows/deploy.yml](C:/Users/KABUM/Documents/SafeBox/Safebox-3/.github/workflows/deploy.yml)

## Pendencias estruturais ainda abertas

### P0

- Confirmar se o novo workflow da Vercel executou com sucesso apos o proximo push.
- Se falhar, capturar:
  - job do GitHub Actions
  - etapa exata
  - log final
  - URL do deploy na Vercel, se existir

### P1

- Continuar reduzindo superficies legadas que ainda dependem de `service_role`.
- Revisar fluxos de auth legados ainda baseados em JWT proprio onde houver duplicidade com o token do Supabase.
- Consolidar verificacoes de tenant isolation em rotas nao migradas.

### P2

- Avaliar migracao do frontend de `create-react-app` para `Vite`.
  - motivo: reduzir risco residual do toolchain
  - observacao: nao mexer no banco para isso
- Limpar warnings antigos do frontend:
  - imports nao usados
  - anchors invalidos
  - dependencias faltantes de hooks

### P3

- Expandir testes de arquitetura:
  - round-trip real `export -> import -> backup -> restore`
  - multi-user / tenant isolation
  - conflitos entre abas/sessoes

## Checklist rapido para preencher quando restar 2%

### Snapshot da sessao

- Branch atual:
- Commit atual:
- `git status`:
- Ultimo objetivo em andamento:
- Ultimo bloqueio encontrado:

### Arquivos tocados recentemente

- Backend:
- Frontend:
- Infra/CI:
- Docs/relatorios:

### Validacoes mais recentes

- Backend `lint`:
- Backend `type-check`:
- Backend `test`:
- Frontend `test`:
- Frontend `build`:
- Frontend `audit:prod`:
- Deploy Vercel:

### Proximos passos imediatos

1. 
2. 
3. 

## Comandos de validacao

### Backend

```powershell
cd C:\Users\KABUM\Documents\SafeBox\Safebox-3\backend
npm run lint
npm run type-check
npm test -- --runInBand
npm run dev
```

### Frontend

```powershell
cd C:\Users\KABUM\Documents\SafeBox\Safebox-3\frontend
npm test -- --watchAll=false
npm run build
npm run audit:prod
```

### Workspace

```powershell
cd C:\Users\KABUM\Documents\SafeBox\Safebox-3
git status --short
git log --oneline --decorate -n 5
```

## Como verificar deploy apos commit

1. Conferir o workflow:
   - [.github/workflows/deploy.yml](C:/Users/KABUM/Documents/SafeBox/Safebox-3/.github/workflows/deploy.yml)
2. Verificar o GitHub Actions da branch/commit.
3. Se houver erro:
   - capturar o trecho final do log
   - identificar se falhou em `build`, `vercel deploy`, secrets ou projeto Vercel
4. Se houver sucesso:
   - registrar a URL do deploy
   - validar se o ambiente carregou sem erro critico

## Risco residual conhecido

- O runtime atual ficou endurecido, mas ainda ha superficie legada a migrar.
- O frontend ainda depende de `react-scripts`, o que deixa risco residual no toolchain de build/dev.
- O projeto e de teste e o usuario decidiu nao rotacionar chaves historicamente expostas.
