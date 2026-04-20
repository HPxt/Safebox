# Relatorio - Fase 3: Aplicacao em staging e validacao

## 1. Problema

O plano de endurecimento do banco precisava sair do papel e ser validado contra o ambiente real de staging, com especial atencao para:

- grants excessivos em tabelas sensiveis
- ausencia de `two_factor_attempts`
- RLS incompleto em tabelas auxiliares
- functions hardening baseado em assinaturas assumidas
- possibilidade de default privileges continuarem abrindo superficie futura

## 2. Ameaca

- acesso mais amplo do que o necessario para `authenticated`
- tenant isolation enfraquecido em tabelas auxiliares
- drift entre a documentacao e o schema real
- novas tabelas/funcoes herdando grants demasiadamente permissivos

## 3. Mudanca necessaria

- aplicar as migrations revisadas em staging
- rodar pos-checks reais
- corrigir os grants residuais que sobrevivessem ao lote inicial
- materializar o estado real do ambiente em relatorio

## 4. Alteracao aplicada

Aplicadas em staging, via `npx supabase@latest db query --linked`:

1. `001_grants_minimal.sql`
2. `002_rls_core_users.sql`
3. `003_rls_audit_backups_sessions.sql`
4. `004_two_factor_attempts.sql`
5. `005_functions_hardening.sql`
6. `006_views_security_invoker.sql`

Como follow-up, tambem foi criada e aplicada:

7. `007_grants_followup_hardening.sql`

Objetivo do `007`:

- remover grants residuais em `audit_logs`, `credential_backups`, `vault_backups`, `user_sessions`, `users`, `two_factor_attempts`
- endurecer default privileges para objetos futuros em `public`

## 5. Teste executado

Consultas reais via `supabase db query --linked` para validar:

- RLS ativo e `FORCE RLS`
- policies por tabela
- grants de `authenticated`
- funcoes sensiveis e `SECURITY DEFINER`
- configuracao de `search_path`
- default privileges em `pg_default_acl`

Tambem foi executado:

- `RUN_DB_SECURITY_INTEGRATION=1 npm run test:db-security-integration`
- a suite provisionou dois utilizadores temporarios em staging usando `SUPABASE_SERVICE_ROLE_KEY`
- semeou dados temporarios do utilizador B em `credentials` e `audit_logs`
- validou que o utilizador A nao consegue ler os dados do utilizador B
- limpou os dados e os utilizadores temporarios ao final

## 6. Resultado

### Resultado positivo

- `two_factor_attempts` passou a existir
- `two_factor_attempts` ficou com `RLS` e `FORCE RLS`
- `audit_logs`, `credential_backups`, `vault_backups` e `user_sessions` ficaram com `FORCE RLS`
- `audit_logs` ficou apenas com `SELECT` para `authenticated`
- `credential_backups` ficou com `SELECT, INSERT`
- `vault_backups` ficou com `SELECT, INSERT`
- `user_sessions` ficou com `SELECT, INSERT, UPDATE`
- `users` ficou com `SELECT, UPDATE`
- `two_factor_attempts` ficou com `SELECT, INSERT`
- `EXECUTE` em funcoes sensiveis para `authenticated` ficou vazio no pos-check
- `create_credential_backup()` e `create_default_user_settings()` ficaram com `search_path=public, pg_temp`
- testes multi-tenant reais passaram no staging:
  - `user A cannot list credentials owned by user B`
  - `user A cannot read audit logs owned by user B`

### Evidencias principais observadas

- grants pos-follow-up:
  - `audit_logs`: `SELECT`
  - `credential_backups`: `SELECT, INSERT`
  - `vault_backups`: `SELECT, INSERT`
  - `user_sessions`: `SELECT, INSERT, UPDATE`
  - `users`: `SELECT, UPDATE`
  - `two_factor_attempts`: `SELECT, INSERT`

## 7. Risco residual

### Residual 1 - default privileges de `supabase_admin`

O follow-up melhorou os default privileges do owner `postgres`, mas o inventario ainda mostra ACL ampla para `supabase_admin` em:

- tabelas
- funcoes
- sequencias

Exemplo observado:

- `authenticated=arwdDxtm/supabase_admin`
- `anon=arwdDxtm/supabase_admin`

Isso significa que ainda existe risco de objetos futuros herdarem grants amplos dependendo do owner que criar o objeto.

Tentativa de endurecimento direto via `SET ROLE supabase_admin` falhou no ambiente com:

- `permission denied to set role "supabase_admin"`

Portanto, este residual permanece e precisa ser tratado por um caminho com privilégio administrativo maior no projeto Supabase.

### Residual 2 - FORCE RLS nao esta ativo nas tabelas core

As tabelas abaixo continuam com `rls_forced = false`:

- `credentials`
- `vaults`
- `user_settings`
- `folders`
- `categories`
- `users`

Nao e uma falha critica imediata para o produto atual, mas permanece como endurecimento adicional desejavel.

### Residual 3 - cobertura multi-tenant ainda basica

Os testes reais de staging agora existem e passaram, mas ainda cobrem apenas:

- `credentials`
- `audit_logs`

Ainda vale ampliar depois para:

- `vaults`
- `user_settings`
- `vault_backups`
- `credential_backups`
- `user_sessions`

## Proximo passo recomendado

1. criar um novo ajuste para default privileges do owner `supabase_admin`, se o ambiente permitir
2. considerar `FORCE RLS` tambem nas tabelas core multi-tenant
3. ampliar a suite `test:db-security-integration` para mais tabelas multi-tenant
4. rerodar `docs/sql/post-checks.sql` sempre que novas migrations de banco entrarem
