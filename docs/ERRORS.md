# SafeBox Error Log

Este arquivo e o primeiro lugar a consultar antes de corrigir qualquer bug no SafeBox.
Quando um erro for resolvido, registre aqui a causa, a correcao e as validacoes usadas.

## Regra operacional

1. Quando o usuario enviar um erro novo, a primeira acao e ler/pesquisar este arquivo antes de propor ou aplicar correcao.
2. Antes de investigar um bug, procurar neste arquivo por:
   - mensagem exata do erro;
   - tela/fluxo afetado;
   - arquivos citados em correcoes anteriores;
   - decisoes de seguranca relacionadas.
3. Depois de corrigir um bug, adicionar uma entrada nova com:
   - data;
   - sintoma;
   - causa raiz;
   - arquivos alterados;
   - validacoes executadas;
   - riscos ou pendencias restantes.
4. Nao reabrir fallback inseguro sem registrar explicitamente o motivo e o limite da excecao.

## 2026-07-04 - `Erro ao salvar credencial: Resposta invalida do backend`

**Sintoma:** ao editar uma credencial no dashboard, o frontend mostrava `Erro ao salvar credencial: Resposta invalida do backend`.

**Causa raiz:** `credentialsService.updateCredential()` grava o snapshot do cofre via `backendRequest('/vault')`. Em deploy estatico ou ambiente sem `REACT_APP_BACKEND_URL`, `/api/vault` pode nao apontar para o backend Express e retornar HTML/404 em vez do envelope JSON esperado. A leitura ja tinha fallback direto para Supabase, mas a escrita nao tinha fallback equivalente.

**Correcao:** `frontend/src/services/credentialsService.ts` agora:

- guarda `id`, `version` e `storageMode` do vault carregado;
- tenta salvar pelo backend primeiro;
- se o backend estiver indisponivel ou responder conteudo invalido, salva diretamente no Supabase com cliente autenticado;
- preserva controle otimista de versao usando `eq('version', currentVaultVersion)`;
- converte ausencia de linha atualizada em conflito de versao amigavel.

**Arquivos alterados:**

- `frontend/src/services/credentialsService.ts`
- `docs/ERRORS.md`
- `docs/HANDOFF-BASE.md`

**Validacoes:**

```text
npm test -- --watchAll=false --runInBand src/services/backendApi.test.ts
npm run build
```

**Observacao de seguranca:** o fallback usa apenas a sessao Supabase do usuario e RLS. Nao usa `service_role`, nao grava dados de outro usuario e nao remove o caminho preferencial via backend.
