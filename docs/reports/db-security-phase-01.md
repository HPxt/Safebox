# Relatorio - Fase 1: Inventario de seguranca do banco

> Preenchido a partir de consultas reais no projeto Supabase de staging vinculado.

## 1. Problema

O ambiente real de staging diverge do estado assumido pelas migrations de endurecimento:

- `two_factor_attempts` ainda nao existe
- ha grants amplos demais para `authenticated` em praticamente todas as tabelas sensiveis
- as funcoes assumidas em `005_functions_hardening.sql` (`log_audit_event`, `update_user_last_login`, `get_user_vault`, `cleanup_*`) nao apareceram no inventario com esses nomes/assinaturas
- `users_update_own` esta sem `WITH CHECK`, entao o ambiente atual ainda nao reflete a migration 002

## 2. Ameaca

- grants excessivos ampliam blast radius caso alguma policy fique incompleta ou alguma tabela auxiliar seja acessada por engano
- assumir funcoes erradas no `005` pode gerar migration parcialmente aplicada ou falha operacional
- ausencia de `two_factor_attempts` impede alinhar o banco ao fluxo endurecido de 2FA
- `audit_logs_insert_system` com `WITH CHECK true` merece revisao, porque abre um caminho de insert amplo no contexto RLS

## 3. Mudanca necessaria

- revisar grants por tabela antes de aplicar `001`
- aplicar `002` para corrigir `users_update_own` com `WITH CHECK`
- aplicar `004` para criar `two_factor_attempts`
- reescrever `005` para consultar `pg_proc` e atuar apenas sobre funcoes realmente existentes
- revisar `audit_logs` para decidir se `authenticated` deve inserir diretamente ou se isso deve ficar apenas no backend privilegiado

## 4. Alteracao aplicada

Nenhuma no banco nesta fase. Apenas leitura e consolidacao do inventario.

## 5. Teste executado

- inventario executado via `npx supabase@latest db query --linked`
- consultas executadas:
  - tabelas + RLS
  - policies RLS
  - funcoes `SECURITY DEFINER`
  - grants de `authenticated`
  - `EXECUTE` em rotinas
  - existencia de `two_factor_attempts`

## 6. Risco residual

- alto para grants excessivos em `authenticated`
- medio para isolamento incompleto em tabelas auxiliares
- medio para a migration `005` se aplicada sem ajuste ao `pg_proc` real
- medio para 2FA ate `two_factor_attempts` existir no banco

---

## Matriz

| Tabela | RLS? | Politica atual (resumo) | Risco | Recomendacao |
|--------|------|-------------------------|-------|--------------|
| credentials | Sim | SELECT/INSERT/UPDATE/DELETE por `auth.uid() = user_id` | Medio | Manter RLS; reduzir grants excessivos de `authenticated` |
| vaults | Sim | SELECT/INSERT/UPDATE/DELETE por `auth.uid() = user_id` | Medio | Manter RLS; reduzir grants excessivos de `authenticated` |
| user_settings | Sim | `settings_rw_own` com ALL por `auth.uid() = user_id` | Medio | Manter RLS; revisar grants amplos |
| folders | Sim | `folders_rw_own` com ALL por `auth.uid() = user_id` | Medio | Manter RLS; revisar grants amplos |
| categories | Sim | `categories_rw_own` com ALL por `auth.uid() = user_id` | Medio | Manter RLS; revisar grants amplos |
| vault_backups | Sim | `vault_backups_rw_own` com ALL por `auth.uid() = user_id` | Medio | Rever grants e decidir se INSERT/DELETE devem ficar mais restritos |
| credential_backups | Sim | apenas SELECT proprio | Medio | Completar politica se o produto precisar INSERT controlado; revisar grants amplos |
| audit_logs | Sim | SELECT proprio + `audit_logs_insert_system` com `WITH CHECK true` | Alto | Rever insert direto de `authenticated`; preferir backend privilegiado |
| user_sessions | Sim | `user_sessions_rw_own` com ALL por `auth.uid() = user_id` | Alto | Reduzir grants perigosos e revisar se CRUD total e mesmo necessario ao cliente |
| users | Sim | SELECT proprio; UPDATE proprio sem `WITH CHECK` no ambiente atual | Alto | Aplicar migration 002 |
| two_factor_attempts | Nao existe | sem tabela/policies | Medio | Aplicar migration 004 |

## Fatos observados no inventario

### RLS

- RLS ativo em: `audit_logs`, `categories`, `credential_backups`, `credentials`, `folders`, `user_sessions`, `user_settings`, `users`, `vault_backups`, `vaults`
- `two_factor_attempts` nao existe no staging
- nenhuma dessas tabelas esta com `FORCE ROW LEVEL SECURITY`

### SECURITY DEFINER

Encontradas:

- `create_credential_backup()`
- `create_default_user_settings()`

Nao apareceram no ambiente real:

- `log_audit_event(...)`
- `update_user_last_login(...)`
- `get_user_vault(...)`
- `cleanup_old_audit_logs()`
- `cleanup_expired_sessions()`
- `cleanup_old_backups()`

### Grants de `authenticated`

As tabelas sensiveis inventariadas estao com privilegios amplos incluindo:

- `SELECT`
- `INSERT`
- `UPDATE`
- `DELETE`
- `REFERENCES`
- `TRIGGER`
- `TRUNCATE`

Esse e o principal ponto a corrigir antes de considerar a camada de banco endurecida.
