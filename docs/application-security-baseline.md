# SafeBox - Baseline de seguranca para revisao de aplicacoes

Data de referencia: 2026-04-28

Este documento consolida as protecoes de seguranca ja existentes no SafeBox, as melhorias recentes aplicadas no backend/banco/frontend e um checklist para revisar se outras aplicacoes do ecossistema estao no mesmo nivel.

Use este arquivo como baseline de AppSec. Para cada app, marque o status como:

- `OK`: controle implementado e validado.
- `Parcial`: existe algo implementado, mas falta cobertura, migracao, evidencia ou padronizacao.
- `Pendente`: controle ausente.
- `N/A`: nao se aplica aquele app.

## Fontes usadas

- `docs/database-security-plan.md`
- `docs/sql/migrations/README.md`
- `docs/sql/migrations/001_grants_minimal.sql` ate `008_business_rule_hardening.sql`
- `docs/sql/post-checks.sql`
- `docs/reports/db-security-phase-02.md`
- `docs/reports/db-security-phase-03-staging.md`
- `docs/reports/security-executive-summary-2026-04-20.md`
- `docs/vault-protocol-spec.md`
- `docs/QUALITY-GATE.md`
- `docs/reports/browser-only-dependency-audit-2026-04-21.md`
- Codigo atual em `backend/src/security`, `backend/src/middleware`, `backend/src/routes`, `backend/src/domain/vault` e `frontend/src/services`

## Melhorias recentes que viraram requisito baseline

Estas melhorias foram feitas na ultima rodada e devem existir em qualquer app que manipule cofre, dados por usuario ou tabelas multi-tenant.

| Controle | Implementacao SafeBox | Por que importa | Evidencia |
|---|---|---|---|
| Criacao atomica de vault | Indice unico parcial `credentials_single_active_vault_per_user_idx` para um vault ativo por usuario | Fecha race condition em criacao concorrente e evita inflar banco com snapshots paralelos | `docs/sql/migrations/008_business_rule_hardening.sql` |
| Conflito atomico tratado no backend | `23505` vira `ConflictError('Vault already exists')` | Retorna erro controlado em corrida real, sem stack/erro bruto | `backend/src/domain/vault/VaultSnapshotRepository.ts` |
| Fallback de escrita direta removido | Frontend nao faz mais `insert/update` direto em `credentials` quando o backend falha | Impede bypass de validacao central, rate limit, auditoria e limite de payload | `frontend/src/services/credentialsService.ts` |
| Mass assignment reduzido em `users` | `REVOKE UPDATE ON public.users` e grant apenas em `full_name`, `avatar_url` | Cliente com anon key nao pode alterar `status`, `email`, `two_factor_*`, `kdf_*`, `key_hash` | `008_business_rule_hardening.sql` |
| Perfil criptografico via backend | `GET/PUT /api/auth/crypto-profile` para `kdf_salt`, `kdf_params`, `key_hash` | Campos sensiveis passam por allow-list server-side e validacao | `backend/src/routes/auth.routes.ts`, `frontend/src/services/cryptoProfileService.ts` |
| Anti-IDOR cross-tenant no banco | Triggers validam `credentials.folder_id` e `folders.parent_id` contra `user_id` | Mesmo com UUID vazado, nao permite vinculo com pasta de outro usuario | `008_business_rule_hardening.sql` |
| Limites de payload no banco | Checks de tamanho para `enc_blob`, `encrypted_data`, backups, campos e settings | Protege contra abuso da anon key para lotar banco ou gravar payload fora do contrato | `008_business_rule_hardening.sql` |
| Escrita direta bloqueada em auxiliares sensiveis | Revoga `INSERT/UPDATE/DELETE` em backups e `two_factor_attempts` para `authenticated` | Cliente nao manipula trilhas auxiliares diretamente | `008_business_rule_hardening.sql` |
| Dependencias produtivas auditadas | Backend atualizado para `@supabase/supabase-js@2.78.0` e `uuid@14` | Remove advisories produtivos sem quebrar contrato Node 18 | `backend/package.json`, `package-lock.json` |

## Baseline obrigatorio por camada

### 1. Identidade, autenticacao e sessao

| Controle | Requisito minimo | Status SafeBox | Evidencia / teste |
|---|---|---|---|
| Identidade principal | Usar Supabase Auth nas rotas principais, com Bearer token validado server-side | OK | `authenticateSupabaseAccessToken` |
| Auth legada | Desabilitada por padrao ou isolada em caminhos explicitamente legacy | Parcial | `auth.service.ts`; risco residual documentado em `db-security-phase-02.md` |
| Sessao | Invalidacao de sessoes e logout via backend; sem confiar apenas no cliente | OK | `auth.service.ts`, `auth.routes.ts` |
| Admin | Nao liberar admin placeholder sem autorizacao real | OK | `requireAdmin` retorna 403 quando nao configurado |
| 2FA | Segredo 2FA criptografado, backup codes hashados, verificacao server-side | OK | `backend/src/security/twoFactor.ts`, `auth.routes.ts` |
| Tentativas 2FA | Registrar tentativas em tabela protegida, sem escrita direta pelo cliente | OK apos migration 008 | `two_factor_attempts`, `008_business_rule_hardening.sql` |
| Rate limit auth | Login, registro e troca de senha com limites especificos | OK | `rateLimiting.middleware.ts` |

Checklist para outros apps:

- [ ] Todas as rotas sensiveis exigem token validado no servidor.
- [ ] Nenhuma rota aceita `userId` do body/query como fonte de verdade para ownership.
- [ ] Fluxos legacy estao desabilitados por padrao ou claramente isolados.
- [ ] 2FA, se existir, nao expoe segredo no cliente depois da configuracao.
- [ ] Backup codes sao armazenados hashados e consumidos de forma atomica.
- [ ] Login, registro, troca de senha e recuperacao possuem rate limit.

### 2. Isolamento multi-tenant, IDOR e ownership

| Controle | Requisito minimo | Status SafeBox | Evidencia / teste |
|---|---|---|---|
| RLS por usuario | Politicas `auth.uid() = user_id` para dados do tenant | OK | migrations `002`, `003`, `post-checks.sql` |
| Cliente user-scoped | Preferir anon key + JWT do usuario para CRUD comum | OK | `createSupabaseUserClient(accessToken)` |
| Service role | Usar somente em helpers privilegiados auditaveis | OK | `backend/src/config/privilegedDb.ts` |
| Ownership por recurso | Validar `id + user_id` em recursos acessados por ID | OK | `requireOwnedResource` |
| Cross-tenant references | Banco impede `folder_id`/`parent_id` de outro usuario | OK apos migration 008 | triggers em `008_business_rule_hardening.sql` |
| Teste multi-tenant | Suite real com usuario A/B em staging | Parcial | cobre `credentials` e `audit_logs`; ampliar |

Checklist para outros apps:

- [ ] Cada tabela multi-tenant tem `user_id` ou owner equivalente.
- [ ] RLS esta ativo para tabelas por usuario.
- [ ] Quando aplicavel, `FORCE ROW LEVEL SECURITY` esta ativo.
- [ ] Toda query por ID filtra tambem pelo usuario autenticado.
- [ ] FKs logicas entre recursos do tenant sao validadas por constraint, trigger ou policy.
- [ ] Existem testes tentando acessar dados de outro usuario.

### 3. Mass assignment e allow-lists

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Schemas strict | Bodies de rotas usam schemas com campos permitidos explicitamente | OK | Zod `.strict()` em `vault.routes.ts`, `auth.routes.ts` |
| Users protegido | Cliente nao recebe `UPDATE` amplo em `users` | OK apos migration 008 | column grant apenas `full_name`, `avatar_url` |
| Campos sensiveis | `status`, `email`, `two_factor_*`, `kdf_*`, `key_hash` nao sao alteraveis por payload livre | OK | `crypto-profile` e rotas 2FA server-side |
| Updates parciais | Updates no backend montam objetos permitidos explicitamente | OK | `auth.routes.ts`, `vault.routes.ts` |

Checklist para outros apps:

- [ ] Toda rota de update tem allow-list.
- [ ] Nenhum `req.body` e repassado inteiro para `.update()`/ORM.
- [ ] Grants de banco nao permitem update amplo em tabelas de identidade.
- [ ] Campos de seguranca so mudam por endpoints dedicados e auditados.

### 4. Validacao, sanitizacao e limites de payload

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Validacao server-side | Zod/Joi/validator antes de usar dados do request | OK | `validateWithSchema`, rotas |
| Rejeicao de campos extras | Schemas `.strict()` em rotas criticas | OK | `vault.routes.ts`, `auth.routes.ts` |
| Limite de payload | Limite no backend e no banco para campos grandes | OK | `encryptedData` max 1.5 MB; checks em `008` |
| Hash format | `dataHash` deve ser SHA-256 hex de 64 chars | OK | rotas + constraints |
| Prototype pollution | Sanitizacao remove `__proto__`, `prototype`, `constructor` | OK | `sanitizeInput` |
| XSS frontend | Sanitizacao de HTML/URL quando renderizar conteudo nao confiavel | OK/Parcial | `frontend/src/utils/xssProtection.ts`; revisar uso por componente |
| AI/data pipeline | Sanitizador bloqueia dados proibidos antes de analise por IA | OK/Parcial | `backend/src/ai/sanitizer/DataSanitizer.ts`; `src/ai` fora do gate principal |

Checklist para outros apps:

- [ ] Bodies, params e query strings sao validados.
- [ ] Campos desconhecidos sao rejeitados em rotas criticas.
- [ ] Payloads cifrados, anexos, imports e backups tem limite de tamanho.
- [ ] Hashes, UUIDs e enum values tem formato validado.
- [ ] Sanitizacao remove chaves de prototype pollution.
- [ ] Conteudo renderizado como HTML passa por sanitizador.
- [ ] Dados enviados para IA/telemetria passam por redaction/sanitizacao.

### 5. Cofre, criptografia e integridade

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Zero-knowledge | Servidor armazena ciphertext opaco; descriptografia so no cliente | OK | `docs/vault-protocol-spec.md` |
| KDF | PBKDF2-HMAC-SHA256 pre-hash + Argon2id conforme spec | OK | `frontend/src/services/cryptoService.ts` |
| Cifra | AES-256-GCM com nonce aleatorio de 12 bytes | OK | `cryptoService.ts`, `vault-protocol-spec.md` |
| Integridade | Backend confere `dataHash == SHA-256(encryptedData)` | OK | `VaultSnapshotService.ensureHashMatches` |
| Concorrencia | Updates/deletes/restores exigem `expectedVersion` | OK | `VaultSnapshotService`, `vault.routes.ts` |
| Criacao atomica | Banco garante unico vault ativo por usuario | OK apos migration 008 | indice unico parcial |
| Compatibilidade clients | Formato do vault documentado para Web e iOS | OK | `vault-protocol-spec.md` |
| Chaves no cliente | Chaves sensiveis nao ficam em localStorage/sessionStorage | OK/Parcial | comentarios e implementacao em `cryptoService.ts`; revisar todos os clients |

Checklist para outros apps:

- [ ] O servidor nunca recebe plaintext de senha/cofre quando o dominio exige zero-knowledge.
- [ ] Existe spec canonica de criptografia para todos os clients.
- [ ] Existem test vectors e testes de paridade por client.
- [ ] Cada write sensivel usa versao esperada ou outra forma de optimistic locking.
- [ ] Criacao concorrente e protegida por constraint/index no banco.
- [ ] Hash/integridade e validado no servidor e, quando possivel, no cliente.

### 6. Banco, grants, RLS e funcoes

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Grants minimos | `authenticated` recebe grants explicitos por tabela, nao CRUD global | OK | migration `001`, `007`, `008` |
| Audit read-only | Cliente autenticado nao insere diretamente em `audit_logs` | OK | migrations `001`, `003` |
| Backups protegidos | Backups seguem isolamento por usuario e nao sao manipulados livremente | OK apos migration 008 | `vault_backups`, `credential_backups` |
| Functions hardening | `SECURITY DEFINER` com `search_path` fixo e execute restrito | OK/Parcial | migration `005`, `post-checks.sql` |
| Views | Views usam `security_invoker` quando suportado | OK | migration `006` |
| Pos-checks | Existe script de validacao read-only apos migrations | OK | `docs/sql/post-checks.sql` |
| Default privileges | Objetos futuros nao devem herdar grants amplos | Parcial | residual `supabase_admin` em `db-security-phase-03-staging.md` |

Checklist para outros apps:

- [ ] Rodar inventario de grants antes de mexer.
- [ ] Aplicar migrations de hardening em ordem.
- [ ] Rodar `post-checks.sql` ou equivalente depois.
- [ ] Nao usar `GRANT ALL ON ALL TABLES` para app clients.
- [ ] Revisar default privileges dos owners reais do schema.
- [ ] Revisar toda function `SECURITY DEFINER` por `search_path`, owner e `EXECUTE`.

### 7. Auditoria, logs e redaction

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Audit via backend | Escrita de audit log por RPC/helper privilegiado | OK | `logPrivilegedAuditEvent`, `privilegedRpcLogAuditEvent` |
| Redaction | Logs nao incluem tokens, cookies, secrets, ciphertext, keys, IP bruto quando sensivel | OK | `backend/src/security/redaction.ts` |
| Eventos criticos | Vault create/update/delete/export/backup/restore auditados | OK | `vault.routes.ts` |
| Erros ao cliente | Erros sensiveis nao vazam detalhes internos | OK | `backend/src/security/errors.ts`, `http.ts` |
| Frontend logger | Redaction antes de console/monitoring | OK/Parcial | `frontend/src/utils/securityLogger.ts`; confirmar uso consistente |

Checklist para outros apps:

- [ ] Definir eventos auditaveis por feature critica.
- [ ] Nunca logar senha, segredo 2FA, token, ciphertext completo, service role ou chave.
- [ ] Logs de seguranca tem userId/evento/contexto minimo.
- [ ] Erros externos sao genericos; detalhes ficam apenas em log redigido.
- [ ] Logs sao protegidos por RLS/grants quando ficam no banco.

### 8. Rate limiting, abuso e disponibilidade

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Geral | Limite global por IP | OK | `generalRateLimit` |
| Login | Limite forte por IP/User-Agent | OK | `loginRateLimit` |
| Registro | Limite por IP/hora | OK | `registerRateLimit` |
| Troca de senha | Limite por usuario/IP | OK | `passwordChangeRateLimit` |
| Vault | Limite especifico para operacoes do cofre | OK | `vaultRateLimit` |
| Brute force | Lock temporario apos tentativas falhas | OK | `bruteForcePrevention` |
| Redis | Store distribuido quando `REDIS_URL` existe, fallback memory local | OK/Parcial | `rateLimiting.middleware.ts` |

Checklist para outros apps:

- [ ] Cada endpoint caro ou sensivel tem rate limit especifico.
- [ ] Login e recuperacao tem limite mais restritivo que API geral.
- [ ] Em ambiente multi-instancia, rate limit usa Redis ou storage distribuido.
- [ ] Eventos de bloqueio sao auditados sem dados sensiveis.

### 9. Headers, CORS e HTTP outbound

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Headers | CSP, frame deny, nosniff, permissions policy, HSTS em prod | OK | `advancedSecurityHeaders`, `helmet` |
| CORS | Allowlist de origins, sem wildcard permissivo em prod | OK/Parcial | `backend/src/index.ts`, config |
| Outbound HTTP | Allowlist de host, bloqueio de credenciais em URL, no redirect, timeout, retry controlado | OK | `backend/src/security/outboundHttp.ts` |
| SSRF | Bloqueio de IP privado exceto localhost permitido explicitamente | OK | `outboundHttp.ts` |
| Browser-only deps | Backend sem `window`, `document`, local/session storage | OK | `browser-only-dependency-audit-2026-04-21.md` |

Checklist para outros apps:

- [ ] CSP existe e nao e aberta com `*` sem motivo.
- [ ] CORS so permite origins conhecidos.
- [ ] APIs outbound usam cliente seguro centralizado.
- [ ] Redirect automatico fica desabilitado para chamadas sensiveis.
- [ ] Backend nao importa dependencia browser-only.

### 10. Dependencias, CI e quality gate

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Quality gate | Testes, build, lint e typecheck antes de seguir | OK | `docs/QUALITY-GATE.md`, `npm run quality:gate` |
| Audit produtivo | `npm audit --omit=dev` zerado para root/backend/frontend | OK em 2026-04-28 | commits recentes |
| Audit completo | Dev deps revisadas separadamente | Parcial | residual em `react-scripts`/Jest/Webpack |
| Lockfiles | Lock raiz e package locks sincronizados | OK | `package-lock.json`, `backend/package-lock.json` |
| Browser-only audit | Separacao frontend/backend/iOS documentada | OK | `browser-only-dependency-audit-2026-04-21.md` |

Checklist para outros apps:

- [ ] Existe comando unico de quality gate.
- [ ] `audit --omit=dev` passa sem vulnerabilidades produtivas.
- [ ] Vulnerabilidades dev estao documentadas, aceitas temporariamente ou em plano de migracao.
- [ ] CI roda em `push` e `pull_request`.
- [ ] Dependencias de runtime sao compativeis com o runtime declarado.

## Matriz rapida para revisar cada aplicacao

Preencha uma copia desta tabela por aplicacao.

| Area | Backend API | Frontend Web | iOS App | Extensao iOS | AI/Jobs | Evidencia |
|---|---|---|---|---|---|---|
| Auth server-side |  |  |  |  |  |  |
| Sem `userId` confiado do cliente |  |  |  |  |  |  |
| RLS/grants minimos |  |  |  |  |  |  |
| Service role isolado |  |  |  |  |  |  |
| IDOR/multi-tenant testado |  |  |  |  |  |  |
| Mass assignment bloqueado |  |  |  |  |  |  |
| Payload size limit |  |  |  |  |  |  |
| Sanitizacao/redaction |  |  |  |  |  |  |
| Rate limit em rotas criticas |  |  |  |  |  |  |
| Vault/version/hash quando aplicavel |  |  |  |  |  |  |
| Zero-knowledge preservado |  |  |  |  |  |  |
| Backups/auditoria protegidos |  |  |  |  |  |  |
| Headers/CORS/outbound seguro |  |  |  |  |  |  |
| Dependencias auditadas |  |  |  |  |  |  |
| Quality gate verde |  |  |  |  |  |  |

## Evidencias minimas antes de considerar um app no mesmo nivel

Para fechar uma revisao, anexe ou referencie:

1. Resultado do quality gate do app.
2. Resultado de audit de dependencias produtivas.
3. Resultado de post-checks de banco, se o app usa Supabase/Postgres.
4. Evidencia de teste multi-tenant, se existe dado por usuario.
5. Lista de rotas sensiveis e seus schemas de validacao.
6. Lista de tabelas com grants/RLS.
7. Lista de usos de service role/admin key.
8. Evidencia de redaction em logs.
9. Evidencia de protecao contra payload grande/import/backups.
10. Para clients de vault: teste de paridade com `docs/vault-protocol-spec.md`.

## Riscos residuais conhecidos

Estes pontos nao devem ser esquecidos em revisoes futuras:

- `008_business_rule_hardening.sql` precisa estar aplicado no ambiente alvo para as protecoes de banco ficarem ativas fora do codigo.
- Default privileges de `supabase_admin` ainda foram reportados como residual em staging; exige permissao administrativa maior para fechar totalmente.
- `FORCE RLS` ainda pode ser ampliado para tabelas core multi-tenant, conforme `db-security-phase-03-staging.md`.
- Suite multi-tenant real ainda deve ser expandida para `vaults`, `user_settings`, `vault_backups`, `credential_backups` e `user_sessions`.
- `src/ai` ainda nao esta no gate principal de build; manter sanitizacao/redaction, mas tratar como trilha propria ate entrar no quality gate.
- Audit completo ainda aponta vulnerabilidades de dev toolchain ligadas a `react-scripts`/Jest/Webpack; producao esta limpa com `--omit=dev`.

## Comandos recomendados por revisao

```powershell
npm run quality:gate
npm audit --omit=dev --json
npm --prefix backend audit --omit=dev --workspaces=false --json
npm --prefix frontend audit --omit=dev --workspaces=false --json
```

Para banco:

```text
1. Executar docs/sql/db-security-inventory.sql
2. Aplicar docs/sql/migrations/001-008 em ordem
3. Executar docs/sql/post-checks.sql
4. Rodar npm run test:db-security-integration em staging com dois usuarios
```

## Criterio de aprovacao

Um app so deve ser considerado no mesmo nivel de protecao do SafeBox atual quando:

- nao ha escrita direta do cliente em tabelas sensiveis que burle backend, auditoria ou rate limit;
- RLS/grants protegem dados mesmo se a anon key for usada diretamente;
- updates usam allow-list e nao aceitam mass assignment;
- relacoes entre tenants sao bloqueadas tambem no banco quando possivel;
- operacoes concorrentes sensiveis usam versao esperada ou constraint atomica;
- logs, auditoria e integracoes externas nao recebem segredo, token, ciphertext bruto ou chave;
- testes, build, lint/typecheck e audit produtivo passam antes de release.

---

## Adicoes - areas nao cobertas nas secoes anteriores

### 11. Gestao de segredos e variaveis de ambiente

Esta area nao estava coberta nas secoes anteriores. Vazamentos de secrets de ambiente sao uma das causas mais frequentes de comprometimento de producao.

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Secrets fora do repositorio | `.env` e arquivos de segredo no `.gitignore`; nenhuma chave real em historico de commits | Pendente de verificacao | Verificar `git log` e `.gitignore` |
| Variaveis de ambiente separadas por ambiente | `dev`, `staging` e `prod` com segredos distintos; nunca reutilizar chave de prod em dev | Pendente de verificacao | Documentar por ambiente |
| Rotacao de segredos | `JWT_SECRET`, `SERVICE_ROLE_KEY`, chaves de API externas tem processo de rotacao documentado | Pendente de verificacao | Documentar frequencia e procedimento |
| Secrets nao logados | Variaveis de ambiente sensiveis nunca aparecem em logs, traces ou respostas de healthcheck | Pendente de verificacao | Revisar `/health`, startup logs |
| Versoes de secrets | Quando possivel, usar secret manager com versionamento (ex: Vault, AWS Secrets Manager, Doppler) em vez de `.env` puro em producao | N/A ou Pendente | Avaliar por app |
| Checklist de exposicao | Antes de publicar repositorio ou PR, verificar se nenhuma chave real esta em codigo, fixture, teste ou comentario | Pendente de verificacao | Adicionar ao quality gate |

Checklist para outros apps:

- [ ] Nenhuma chave, token ou senha real existe no historico de commits (`git log -S 'palavra-chave'`).
- [ ] `.env`, `.env.local`, `.env.production` estao no `.gitignore`.
- [ ] Existe `.env.example` com valores ficticio documentando quais variaveis sao necessarias.
- [ ] Segredos de producao sao diferentes dos de staging e desenvolvimento.
- [ ] Existe processo documentado para rotacao de cada segredo critico.
- [ ] Endpoints de healthcheck e status nao expoe variaveis de ambiente, versoes internas ou paths de sistema.
- [ ] CI/CD usa secrets do proprio sistema (GitHub Actions secrets, etc.) e nao valores hardcoded em YAML.

### 12. Supply chain e integridade de pacotes

O documento ja cobre `npm audit` e lockfiles (secao 10), mas nao aborda vetores de ataque a cadeia de suprimentos que vao alem de vulnerabilidades conhecidas.

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Versoes pinadas | `package.json` usa versoes exatas ou ranges minimos (`^` controlado); evitar `*` | Pendente de verificacao | Revisar `package.json` de cada workspace |
| Lockfile como barreira | `package-lock.json` ou `yarn.lock` commitado e sincronizado; CI instala com `npm ci` e nao `npm install` | OK/Parcial | Verificar comando de install no CI |
| Scripts de ciclo de vida | `postinstall`, `prepare`, `preinstall` de dependencias transitivas revisados antes de adicionar pacote novo | Pendente de verificacao | Processo manual a documentar |
| Typosquatting | Ao adicionar dependencia nova, confirmar nome exato no registry antes de instalar | Pendente de verificacao | Processo manual a documentar |
| Dependencias de desenvolvimento nao chegam a producao | Build de producao nao inclui `devDependencies` no bundle ou imagem Docker | OK/Parcial | Verificar Dockerfile e build scripts |
| Subresource Integrity (SRI) | Scripts e estilos carregados de CDN externo no frontend usam atributo `integrity` | Pendente de verificacao | Revisar `index.html` e loaders |

Checklist para outros apps:

- [ ] CI usa `npm ci` (ou equivalente) para garantir instalacao reproduzivel a partir do lockfile.
- [ ] Nenhuma dependencia de producao usa versao `*` ou range aberto sem justificativa.
- [ ] Antes de adicionar pacote novo, verificar: nome correto no registry, data do ultimo publish, numero de mantenedores, presenca de scripts de ciclo de vida suspeitos.
- [ ] Scripts `postinstall` de dependencias diretas sao revisados e conhecidos.
- [ ] Build de producao exclui `devDependencies` do artefato final.
- [ ] Recursos de CDN externo carregados no HTML tem atributo `integrity` (SRI).

### 13. Timing attacks e enumeracao de usuarios

Esta area nao estava coberta. Respostas de tempo diferenciado e mensagens de erro distintas permitem descobrir se um usuario existe no sistema, o que facilita ataques direcionados.

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Resposta uniforme em login | Usuario inexistente e senha errada retornam o mesmo status HTTP, mesma mensagem e tempo de resposta similar | Pendente de verificacao | Revisar `auth.routes.ts` |
| Resposta uniforme em recuperacao de senha | Endpoint de reset/recuperacao retorna sempre a mesma mensagem independente de o email existir ou nao | Pendente de verificacao | Revisar fluxo de recuperacao |
| Resposta uniforme em registro | Registro com email ja existente nao deve indicar isso de forma diferente de outros erros de validacao, ou deve ser intencional e documentado | Pendente de verificacao | Decisao de produto a documentar |
| Comparacao de hash em tempo constante | Comparacoes de tokens, HMAC e backup codes usam funcao de tempo constante (`timingSafeEqual` ou equivalente) | Pendente de verificacao | Revisar `twoFactor.ts` e helpers de token |
| Enumeracao via canal lateral | Endpoints que consultam existencia de recurso por identificador publico (email, username, slug) nao diferenciam "nao existe" de "nao autorizado" para recursos privados | Pendente de verificacao | Revisar rotas que retornam 404 vs 403 |

Checklist para outros apps:

- [ ] Login retorna a mesma mensagem e status para "usuario nao existe" e "senha errada".
- [ ] Recuperacao de senha retorna a mesma resposta para emails cadastrados e nao cadastrados.
- [ ] Comparacoes de segredos, tokens e MACs usam comparacao de tempo constante.
- [ ] Rotas que retornam 404 vs 403 nao permitem inferir existencia de recurso privado de outro usuario.
- [ ] Testes cobrem os cenarios acima com usuario existente e inexistente e comparam respostas.

### 14. Ciclo de vida de dados sensiveis, retencao e delecao

Esta area nao estava coberta. Dados retidos alem do necessario aumentam superficie de exposicao em caso de vazamento.

| Controle | Requisito minimo | Status SafeBox | Evidencia |
|---|---|---|---|
| Expiracao de tokens | Tokens de acesso, refresh tokens e tokens de reset tem TTL definido e sao invalidados apos uso ou expiracao | OK/Parcial | Verificar configuracao de JWT e reset tokens |
| Sessoes antigas | Sessoes inativas por periodo configuravel sao encerradas; usuario pode encerrar todas as sessoes | Pendente de verificacao | Revisar `user_sessions` e logica de cleanup |
| Dados de usuario deletado | Ao deletar conta, definir o que e anonimizado, o que e removido e o que e retido por obrigacao legal; documentar | Pendente de verificacao | Nao ha evidencia de politica documentada |
| Backups com TTL | Backups de vault e credentials tem tempo de vida maximo definido; backups antigos sao purgados | Pendente de verificacao | Revisar `vault_backups`, `credential_backups` |
| Logs com retencao definida | Audit logs e logs de acesso tem periodo de retencao definido; logs alem do periodo sao arquivados ou removidos | Pendente de verificacao | Nao ha evidencia de politica documentada |
| Dados temporarios | Dados de sessao, cache e filas nao persistem informacao sensivel alem do necessario para a operacao | Pendente de verificacao | Revisar uso de Redis/cache |
| Direito de acesso e portabilidade | Se aplicavel (LGPD/GDPR), existe mecanismo para o usuario exportar seus dados e solicitar remocao | Pendente de verificacao | Avaliar obrigacao regulatoria por app |

Checklist para outros apps:

- [ ] Todo token tem TTL explicito; tokens de reset sao de uso unico.
- [ ] Ha mecanismo para encerrar todas as sessoes ativas de um usuario (ex: troca de senha, suspeita de comprometimento).
- [ ] A politica de retencao de audit logs esta documentada (ex: 90 dias, 1 ano).
- [ ] Backups tem TTL e rotina de purga documentada.
- [ ] O fluxo de delecao de conta define claramente o que acontece com cada categoria de dado.
- [ ] Dados sensiveis em cache/Redis tem TTL e nao sao persistidos alem da sessao.
- [ ] Se o app esta sujeito a LGPD ou GDPR, existe mapeamento de dados pessoais e procedimento de atendimento a solicitacoes de titulares.

### 15. Seguranca especifica para clientes mobile (iOS e Android)

A matriz de revisao inclui "iOS App" e "Extensao iOS" mas nao havia checklist dedicado para vetores especificos de plataforma mobile.

| Controle | Requisito minimo | Observacao |
|---|---|---|
| Armazenamento de segredos | Usar Keychain (iOS) ou Keystore (Android) para chaves, tokens e dados sensiveis; nunca `UserDefaults`/`SharedPreferences` para segredos | Padrao minimo para qualquer app com autenticacao |
| Dados em backup do dispositivo | Marcar dados sensiveis como excluidos de backup (`NSURLIsExcludedFromBackupKey` no iOS; `android:allowBackup="false"` ou exclusao seletiva no Android) | Evita vazamento via backup de iCloud/Google |
| Logs de depuracao | `NSLog`, `print`, `Log.d` e equivalentes nao devem incluir tokens, chaves ou dados de usuario em builds de producao; usar flag de compilacao ou wrapper que desativa em release | Logs aparecem em dispositivos conectados a Xcode/ADB |
| Certificate pinning | Para apps que se comunicam com backend proprio, avaliar pinning de certificado ou public key; documentar processo de rotacao do pin | Mitiga ataques de MitM em redes nao confiadas |
| Jailbreak / root detection | Avaliar deteccao de ambiente comprometido para apps que manipulam dados muito sensiveis; documentar decisao (implementar ou aceitar risco) | Nao e obrigatorio para todos os apps; decisao deve ser explicita |
| Dados em memoria | Chaves criptograficas sao zeradas da memoria apos uso quando a plataforma permitir; evitar copias desnecessarias em Strings imutaveis | Reduz janela de exposicao em dumps de memoria |
| Extensoes e app groups | Dados compartilhados entre app principal e extensao (widget, share extension, etc.) via app group usam Keychain compartilhado, nao arquivos em diretorio compartilhado | Evita que extensao acesse mais do que o necessario |
| Permissoes declaradas | `Info.plist` / `AndroidManifest.xml` declara apenas permissoes efetivamente usadas; revisao a cada release | Principio do menor privilegio no nivel de SO |
| Ofuscacao de codigo | Para apps com logica sensivel no cliente, avaliar ofuscacao (ex: SwiftShield, ProGuard/R8); documentar decisao | Eleva custo de engenharia reversa |
| Atualizacao forcada | Existe mecanismo para forcar atualizacao de versoes com vulnerabilidades criticas sem depender do usuario aceitar | Permite fechar janela de exposicao em versoes antigas |

Checklist para outros apps mobile:

- [ ] Nenhum segredo, token ou chave esta armazenado em `UserDefaults` / `SharedPreferences` / arquivos nao protegidos.
- [ ] Dados sensiveis estao marcados como excluidos de backup do dispositivo.
- [ ] Builds de producao nao emitem logs com dados de usuario ou tokens.
- [ ] A decisao sobre certificate pinning esta documentada (implementado ou risco aceito com justificativa).
- [ ] A decisao sobre jailbreak/root detection esta documentada.
- [ ] Permissoes declaradas no manifesto foram revisadas e correspondem ao uso real.
- [ ] Existe processo de atualizacao forcada para versoes com vulnerabilidades criticas.
- [ ] Para extensoes: o escopo de dados acessiveis pela extensao e o minimo necessario.


### 16. Governanca AppSec, deploy e superficies variaveis por aplicacao

Esta secao complementa o baseline com controles que dependem do tipo de aplicacao, do fluxo de entrega e das entradas externas usadas por cada app. Ela deve ser usada como camada adicional para evitar que um app esteja seguro no codigo, mas fraco em processo, deploy, integracoes ou operacao.

| Controle | Requisito minimo | Quando aplicar | Evidencia |
|---|---|---|---|
| Threat modeling por feature critica | Antes de implementar feature sensivel, mapear ativos, atores, trust boundaries, fluxos de dados, cenarios de abuso e mitigacoes | Auth, pagamentos, cofres, documentos, IA, dados pessoais, admin, webhooks, uploads | Documento curto por feature ou item no PR |
| Requisitos de seguranca por historia | Historias sensiveis devem ter criterios de aceitacao negativos, como "nao permite acessar recurso de outro usuario" e "nao aceita campo extra no payload" | Qualquer feature que manipule dados de usuario, permissoes ou integracoes | Card/Jira/issue com criterios de seguranca |
| Inventario de superficie de ataque | Manter lista atualizada de rotas, jobs, filas, webhooks, buckets, funcoes serverless, endpoints admin e integracoes externas | Todos os apps com backend ou automacoes | `docs/security/attack-surface.md` ou equivalente |
| Autorizacao por funcao/acao | Alem de validar ownership, validar se o usuario pode executar aquela acao especifica; admin, suporte e usuario comum nao devem compartilhar regra implicita | Apps com perfis, roles, backoffice ou area admin | Matriz de permissoes e testes 403 |
| CSRF quando usar cookies | Se a autenticacao usa cookie de sessao, endpoints mutaveis exigem token CSRF, SameSite adequado e validacao de Origin/Referer quando aplicavel | Web apps com cookie auth | Teste tentando POST cross-site sem token |
| Webhooks seguros | Webhooks recebidos validam assinatura HMAC/secret, timestamp, janela anti-replay, idempotencia e origem esperada | Pagamentos, automacoes, notificacoes, providers externos | Teste com assinatura invalida, replay e evento duplicado |
| Uploads e imports | Arquivos usam allow-list de tipo/extensao, limite de tamanho, nome seguro, armazenamento privado, URL assinada com TTL curto e, quando possivel, varredura de malware | Imagens, PDFs, CSV, audio, video, anexos, backups, importacao | Testes com extensao falsa, MIME errado e arquivo acima do limite |
| Processamento de arquivos isolado | Conversao, preview, OCR, FFmpeg, unzip e parsers rodam com timeout, limite de memoria/CPU e sem acesso amplo ao filesystem | Apps que processam midia, documentos ou arquivos compactados | Job sandboxado, limites documentados e logs redigidos |
| Protecao contra zip bomb e path traversal em arquivos | Extracao de arquivos compactados valida tamanho total, quantidade de arquivos, profundidade e impede caminhos `../` | Imports, backups, restore, anexos compactados | Testes negativos de traversal e archive bomb |
| Buckets e objetos privados | Buckets que armazenam dados de usuario nao ficam publicos; acesso ocorre por backend ou signed URLs com escopo e expiracao | Supabase Storage, S3, Firebase Storage, GCS | Policy do bucket e teste anonimo sem acesso |
| CI/CD com protecao de branch | Branch principal exige PR, review, quality gate, audit produtivo, secret scan e bloqueio de push direto | Todos os repositorios de producao | Config do GitHub/GitLab e historico de checks |
| Segredos no CI/CD | Pipelines usam secrets do provedor, menor privilegio, ambientes separados e approvals para deploy em producao | Apps com deploy automatizado | Config de environments/secrets sem valores hardcoded |
| Artefato de build confiavel | Deploy usa build reproduzivel a partir do lockfile, sem instalar dependencias fora do pipeline aprovado | Web, backend, jobs, mobile | Log de `npm ci`/build e hash/tag do artefato |
| Containers e runtime hardening | Imagens rodam como usuario nao-root quando possivel, usam base minima, nao carregam ferramentas desnecessarias e passam por scan | Docker, Kubernetes, ECS, Cloud Run, Render, Fly.io | Dockerfile, scan de imagem e configuracao runtime |
| Infraestrutura como codigo | Recursos de cloud, policies, buckets, filas e redes devem ser versionados ou documentados; mudancas manuais criticas precisam de registro | AWS, GCP, Azure, Supabase, Firebase | Terraform/Pulumi/CDK ou documento de configuracao |
| Menor privilegio em cloud | Chaves e roles de deploy/runtime so possuem permissoes necessarias; service accounts separadas por ambiente e por app | Apps com cloud ou storage externo | IAM policy revisada e teste de permissao negada |
| Observabilidade de seguranca | Criar alertas para picos de 401/403/429, falhas de login, uso de service role, exportacoes, resets e erros incomuns | Apps em producao | Dashboards, alertas e runbook associado |
| Resposta a incidentes | Existe procedimento para revogar sessoes, rotacionar secrets, bloquear usuario, pausar integracao e comunicar impacto | Qualquer app em producao | `docs/security/incident-response.md` ou checklist operacional |
| Backup e restore testado | Backup criptografado nao basta; restore deve ser testado periodicamente em ambiente seguro | Banco, storage, configs e secrets | Evidencia de teste de restore e data do ultimo teste |
| Terceiros e privacidade | Analytics, IA, email, SMS, storage e observabilidade devem ter base legal/contratual, minimizacao de dados e redaction | Apps com dados pessoais ou integracoes externas | Inventario de terceiros e dados enviados |
| Licencas de dependencias | Alem de vulnerabilidades, revisar licencas de dependencias para evitar risco juridico em produto distribuido | Apps comerciais, mobile e SaaS | Relatorio de licencas ou aprovacao manual |

Checklist para outros apps:

- [ ] Existe threat model simples para features criticas ou de maior risco.
- [ ] Historias sensiveis possuem criterios de aceitacao de seguranca, incluindo casos negativos.
- [ ] Existe inventario de rotas, webhooks, jobs, buckets, filas e integracoes externas.
- [ ] Autorizacao valida acao/perfil, nao apenas autenticacao e ownership.
- [ ] Se usar cookie de sessao, existe protecao contra CSRF.
- [ ] Webhooks validam assinatura, timestamp, replay e idempotencia.
- [ ] Uploads/imports usam allow-list, limite de tamanho, bucket privado e signed URL com expiracao.
- [ ] Processamento de midia/documentos roda com timeout, limite de recursos e sem acesso amplo ao filesystem.
- [ ] Arquivos compactados sao protegidos contra zip bomb e path traversal.
- [ ] Branch principal exige PR, review e checks obrigatorios antes de merge.
- [ ] CI/CD roda secret scan, audit produtivo, lint/typecheck/testes e build reproduzivel.
- [ ] Deploy de producao usa approval ou protecao de ambiente.
- [ ] Containers/imagens passam por hardening e scan antes de producao.
- [ ] Roles, service accounts e chaves de cloud seguem menor privilegio.
- [ ] Alertas de seguranca estao configurados para eventos criticos e anomalias.
- [ ] Existe runbook de incidente com passos para rotacao de secrets e revogacao de sessoes.
- [ ] Backups possuem teste real de restore, nao apenas rotina de criacao.
- [ ] Integracoes de terceiros foram revisadas quanto a dados enviados, retencao e finalidade.
- [ ] Licencas de dependencias foram revisadas quando o app for comercial ou distribuido.

### 17. Gates obrigatorios, testes ofensivos e ferramentas recomendadas

Esta secao transforma os pontos pendentes em verificacoes praticas. A ideia e manter o minimo de ferramentas necessario para cobrir seguranca por camadas sem criar burocracia excessiva. Cada app pode adaptar as ferramentas, mas nao deve remover o objetivo do controle.

| Etapa | Objetivo minimo | Ferramentas recomendadas | Evidencia esperada |
|---|---|---|---|
| Secret scanning | Impedir commit de tokens, chaves, `.env` e credenciais reais | Gitleaks ou TruffleHog | Relatorio limpo no PR/CI |
| Dependencias produtivas | Bloquear vulnerabilidades em dependencias de runtime | `npm audit --omit=dev`, OSV-Scanner, Dependabot ou Renovate | Audit sem vulnerabilidade produtiva critica/alta sem justificativa |
| SAST | Encontrar falhas comuns no codigo antes do deploy | Semgrep e/ou GitHub CodeQL | Check obrigatorio no PR |
| Typecheck, lint e testes | Evitar regressao funcional e erros basicos de implementacao | `npm run quality:gate`, ESLint, TypeScript, Jest/Vitest | Pipeline verde antes do merge |
| Testes de autorizacao | Provar que o frontend nao decide acesso e que ownership e roles sao validados no backend/banco | Testes de integracao com dois usuarios reais, Playwright ou Jest/Supertest | Testes A/B cobrindo 401, 403 e isolamento multi-tenant |
| Post-checks de banco | Confirmar RLS, grants, policies, functions e default privileges | `psql`, `docs/sql/post-checks.sql`, scripts SQL proprios | Resultado salvo por ambiente |
| DAST leve | Testar a aplicacao rodando contra falhas HTTP comuns | OWASP ZAP Baseline Scan | Relatorio revisado antes de release |
| Headers e TLS | Validar headers, HTTPS, HSTS, CSP, CORS e configuracoes HTTP | SecurityHeaders.com, Mozilla Observatory, OWASP ZAP | Evidencia de avaliacao em staging/prod |
| Container e imagem | Encontrar vulnerabilidades no artefato de deploy | Trivy ou Grype | Scan limpo ou riscos documentados |
| IaC e cloud config | Revisar configuracao de cloud, buckets, IAM e infraestrutura | Checkov, tfsec ou revisao manual documentada | Relatorio ou checklist de configuracao |
| Licencas e SBOM | Mapear dependencias e evitar risco juridico/comercial | Syft, CycloneDX, license-checker ou equivalente | SBOM/relatorio de licencas quando aplicavel |
| Mobile security | Revisar armazenamento local, logs, permissoes, backup e binario mobile | MobSF, revisao de manifesto/Info.plist, testes manuais | Relatorio por release mobile |

Checklist minimo de gates para PR/release:

- [ ] PR nao contem secrets, `.env` real, token, chave privada ou service role.
- [ ] `npm run quality:gate` ou equivalente passou.
- [ ] `npm audit --omit=dev` passou sem vulnerabilidades produtivas criticas/altas sem justificativa.
- [ ] SAST passou ou os achados foram triados e documentados.
- [ ] Rotas sensiveis possuem testes negativos de autorizacao.
- [ ] Teste multi-tenant com usuario A/B passou quando o app possui dados por usuario.
- [ ] Post-checks de banco passaram quando o app usa Supabase/Postgres.
- [ ] DAST leve foi executado em staging antes de release relevante.
- [ ] Buckets, filas, webhooks e jobs novos foram adicionados ao inventario de superficie de ataque.
- [ ] Alteracoes em secrets, IAM, buckets ou CI/CD foram revisadas com criterio de menor privilegio.

Testes ofensivos minimos por app com backend:

- [ ] Chamar rota sensivel sem token e esperar `401`.
- [ ] Chamar rota sensivel com token valido, mas recurso de outro usuario, e esperar `403` ou `404` sem vazar existencia indevida.
- [ ] Enviar `userId`, `role`, `status`, `isAdmin` ou campos sensiveis no body e confirmar que sao ignorados ou rejeitados.
- [ ] Enviar campo extra em rota critica e confirmar rejeicao por schema strict.
- [ ] Tentar atualizar campo fora da allow-list e confirmar bloqueio.
- [ ] Tentar payload acima do limite e confirmar erro controlado.
- [ ] Tentar UUID valido de outro tenant em relacionamento cruzado e confirmar bloqueio no backend e/ou banco.
- [ ] Simular duas escritas concorrentes em recurso sensivel e confirmar uso de versao esperada, constraint ou conflito controlado.
- [ ] Testar resposta uniforme para login/recuperacao quando usuario existe e quando nao existe.
- [ ] Confirmar que logs do fluxo testado nao registram senha, token, segredo, ciphertext completo ou chave.

Roteiro para IA/revisor AppSec executar testes ofensivos controlados:

```text
Atue como um revisor AppSec autorizado do projeto.

Objetivo:
Criar e executar uma bateria de testes ofensivos controlados simulando uma pessoa usando Burp Suite para modificar requests e tentar encontrar falhas de autenticacao, autorizacao, validacao, mass assignment, IDOR, abuso de payload, upload e vazamento de erro.

Regras obrigatorias:
- Nao testar producao.
- Usar apenas ambiente local ou staging explicitamente autorizado.
- Nao executar ataques destrutivos, volumetricos ou de exfiltracao.
- Nao usar dados reais.
- Criar usuarios de teste `userA`, `userB` e `admin`, se aplicavel.
- Usar dados descartaveis e limpar tudo ao final.
- O objetivo e validar que frontend nunca e camada confiavel.
- Se um teste exigir permissao perigosa ou ambiente nao confirmado, parar e registrar como bloqueado.

Entregaveis obrigatorios:
1. Lista de rotas sensiveis encontradas.
2. Roteiro manual para executar no Burp Suite.
3. Testes automatizados equivalentes usando a stack do projeto.
4. Comando para rodar os testes.
5. Tabela final com risco testado, resultado esperado, resultado obtido e evidencia.
```

1. Inventariar rotas sensiveis:

- [ ] Listar rotas de auth: login, register, logout, refresh, reset, change password, 2FA, crypto profile.
- [ ] Listar rotas de dados por usuario: vault, credentials, folders, settings, backups, exports/imports.
- [ ] Listar rotas admin/backoffice, se existirem.
- [ ] Listar webhooks, uploads, imports, jobs manuais e endpoints internos.
- [ ] Para cada rota, registrar metodo, path, auth exigida, body esperado, recurso acessado, owner field e permissao requerida.

Tabela sugerida:

| Rota | Metodo | Sensibilidade | Auth esperada | Recurso/owner | Campos criticos | Testes obrigatorios |
|---|---|---|---|---|---|---|
| `/api/vault` | `GET` | Cofre | Bearer Supabase | `user_id` do token | n/a | sem token, token invalido, userA/userB |
| `/api/vault` | `POST/PUT/DELETE` | Cofre | Bearer Supabase | `user_id` do token | `encryptedData`, `dataHash`, `expectedVersion` | payload grande, campo extra, conflito, hash invalido |
| `/api/auth/crypto-profile` | `GET/PUT` | Identidade/cripto | Bearer Supabase | `user_id` do token | `kdfSalt`, `kdfParams`, `keyHash` | mass assignment, campos extras, token invalido |

Comandos uteis para inventario no projeto:

```powershell
rg -n "router\\.(get|post|put|patch|delete)" backend/src/routes
rg -n "app\\.(get|post|put|patch|delete)|router\\.(get|post|put|patch|delete)" backend/src
rg -n "backendRequest<|fetch\\(|axios\\." frontend/src
```

2. Preparar ambiente e dados de teste:

- [ ] Confirmar URL local/staging e registrar no relatorio.
- [ ] Confirmar que nao e producao.
- [ ] Criar `userA`, `userB` e `admin` apenas no ambiente de teste.
- [ ] Obter tokens validos de `userA` e `userB`.
- [ ] Criar recurso pertencente a `userA` e recurso equivalente pertencente a `userB`.
- [ ] Criar dados descartaveis de vault/folder/settings/backups, se aplicavel.
- [ ] Ativar log detalhado apenas no ambiente de teste, com redaction.
- [ ] Definir plano de limpeza dos usuarios e recursos criados.

3. Roteiro manual no Burp Suite:

- [ ] Configurar proxy do browser para Burp e importar certificado apenas no ambiente de teste.
- [ ] Fazer login com `userA` e capturar requests autenticados.
- [ ] Enviar requests sensiveis para Repeater.
- [ ] Repetir cada request removendo o header `Authorization`; esperado: `401`.
- [ ] Repetir com token aleatorio, expirado ou truncado; esperado: `401` ou `403`, sem stack trace.
- [ ] Trocar token de `userA` por token de `userB` mantendo IDs de recursos de `userA`; esperado: `403` ou `404` sem indicar se recurso existe.
- [ ] Alterar `userId`, `ownerId`, `tenantId`, `organizationId` no body, query e path; esperado: ignorado ou rejeitado, nunca troca ownership.
- [ ] Injetar campos extras como `role`, `roles`, `isAdmin`, `status`, `emailVerified`, `two_factor_enabled`, `kdf_salt`, `key_hash`, `plan`, `limits`; esperado: `400` por schema strict ou campos ignorados sem efeito.
- [ ] Remover campos obrigatorios; esperado: `400` controlado.
- [ ] Alterar tipos de campos: string onde deveria ser number, array onde deveria ser string, objeto aninhado inesperado; esperado: `400`.
- [ ] Enviar payload acima do limite por rota critica; esperado: `400`, `413` ou erro controlado sem queda do processo.
- [ ] Testar `Content-Type` errado (`text/plain`, `multipart/form-data`, JSON invalido); esperado: rejeicao controlada.
- [ ] Trocar metodo HTTP (`GET` para `POST`, `POST` para `PATCH`, `DELETE` sem body esperado); esperado: `404`, `405` ou rejeicao controlada.
- [ ] Duplicar parametros em query/body com valores conflitantes; esperado: regra server-side clara, sem preferir valor manipulavel.
- [ ] Se houver upload/import: enviar extensao falsa, MIME falso, arquivo vazio, arquivo acima do limite, nome com `../`, arquivo compactado suspeito; esperado: rejeicao controlada.
- [ ] Se houver webhook: remover assinatura, alterar timestamp, repetir evento antigo, alterar payload sem recalcular assinatura; esperado: rejeicao e idempotencia.
- [ ] Se houver cookie auth: tentar request mutavel sem CSRF token e com Origin/Referer externo; esperado: bloqueio.
- [ ] Forcar erro com UUID invalido, hash invalido, version conflito, JSON malformado; esperado: sem stack trace, SQL, path interno, token ou segredo.
- [ ] Repetir chamadas sensiveis ate atingir rate limit moderado; esperado: `429`, `Retry-After` e log redigido.
- [ ] Conferir logs apos cada grupo: nenhum token, segredo, senha, ciphertext completo, service role ou stack sensivel.

4. Testes automatizados equivalentes:

Use a stack do projeto em vez de scripts soltos. Preferencia:

- Backend Node/Express: Jest + Supertest ou testes de integracao existentes.
- Frontend: Playwright apenas para fluxos que precisam capturar requests do browser.
- Banco Supabase/Postgres: suite multi-tenant com dois usuarios reais em staging.
- Upload/webhook: testes de integracao com fixtures pequenas e descartaveis.

Arquivo sugerido para backend:

```text
backend/src/__tests__/offensive-security.integration.test.ts
```

Cenarios automatizados minimos:

- [ ] `401` sem token em todas as rotas sensiveis.
- [ ] `401/403` com token invalido.
- [ ] `userB` nao le, altera, exporta, restaura ou deleta recurso de `userA`.
- [ ] Body com `userId`/`ownerId`/`tenantId` divergente nao altera ownership.
- [ ] Mass assignment com `role`, `isAdmin`, `status`, `emailVerified`, `two_factor_*`, `kdf_*`, `key_hash` e rejeitado ou nao tem efeito.
- [ ] Campos extras em rotas `.strict()` retornam `400`.
- [ ] Payload acima do limite retorna erro controlado.
- [ ] `dataHash` invalido ou divergente retorna erro controlado.
- [ ] `expectedVersion` ausente ou antigo em update/delete/restore retorna erro/conflito.
- [ ] Duas escritas concorrentes no mesmo recurso produzem apenas uma escrita valida e a outra conflito controlado.
- [ ] UUID de pasta/recurso de outro tenant e bloqueado no backend e/ou banco.
- [ ] Respostas de erro nao contem padroes sensiveis: `stack`, `SELECT`, `INSERT`, `UPDATE`, `service_role`, `Bearer`, `JWT`, path local, segredo ou token.
- [ ] Rate limit de endpoint sensivel retorna `429` sem derrubar o processo.
- [ ] Se upload existir: MIME falso, extensao falsa, tamanho excessivo e path traversal sao bloqueados.
- [ ] Se webhook existir: assinatura invalida, replay e evento duplicado sao bloqueados ou tratados idempotentemente.

Comando sugerido:

```powershell
cd C:\Users\KABUM\Documents\SafeBox\Safebox-3
npm --prefix backend test -- --runInBand src/__tests__/offensive-security.integration.test.ts
```

Se o teste depender de staging/Supabase real:

```powershell
set RUN_OFFENSIVE_SECURITY_INTEGRATION=1
set SUPABASE_URL=https://xxx.supabase.co
set SUPABASE_ANON_KEY=...
set SUPABASE_SERVICE_ROLE_KEY=...
npm --prefix backend test -- --runInBand src/__tests__/offensive-security.integration.test.ts
```

5. Evidencia e relatorio final:

| Risco testado | Rota/caso | Metodo manual Burp | Teste automatizado | Resultado esperado | Resultado obtido | Evidencia | Status |
|---|---|---|---|---|---|---|---|
| Acesso sem token | `/api/vault` | Remover `Authorization` | `rejects request without token` | `401` |  | print/log/test output |  |
| Token invalido | rota sensivel | Token aleatorio/truncado | `rejects invalid token` | `401/403` sem stack |  |  |  |
| IDOR userA/userB | recurso de `userA` com token `userB` | Trocar Bearer token | `userB cannot access userA resource` | `403/404` |  |  |  |
| Mass assignment | update de perfil/crypto/settings | Inserir `role/isAdmin/status` | `rejects extra privileged fields` | `400` ou sem efeito |  |  |  |
| Payload grande | vault/import/upload | Aumentar body | `rejects oversized payload` | `400/413` |  |  |  |
| Erro sem vazamento | inputs invalidos | Forcar erro | `error response is redacted` | sem stack/SQL/path/token |  |  |  |
| Rate limit | login/vault | Repetir chamadas | `rate limit returns 429` | `429` + `Retry-After` |  |  |  |

Ao final, classificar:

- `OK`: controle resistiu no manual e no automatizado.
- `Falhou`: comportamento exploravel ou ausencia de controle.
- `Parcial`: bloqueia em uma camada, mas falta banco/teste/evidencia.
- `Bloqueado`: ambiente, token ou fixture nao disponivel.
- `N/A`: rota/caso nao existe no app.

Matriz minima de autorizacao:

| Recurso | Acao | Quem pode | Condicao obrigatoria | Onde validar | Teste esperado |
|---|---|---|---|---|---|
| Exemplo: `vault` | `read` | Usuario autenticado | `vault.user_id = auth.user.id` | Backend + RLS | Usuario B nao le vault do Usuario A |
| Exemplo: `vault` | `update` | Dono do recurso | `expectedVersion` valido e ownership confirmado | Backend + banco | Update concorrente retorna conflito controlado |
| Exemplo: `admin/users` | `list` | Admin real | Role/permissao server-side, nunca flag vinda do cliente | Backend | Usuario comum recebe 403 |

Ferramentas por prioridade:

1. Obrigatorias para quase todo app: `npm audit --omit=dev`, Gitleaks, Semgrep ou CodeQL, quality gate, testes multi-tenant quando houver usuario/dono de dado.
2. Obrigatorias quando houver banco multi-tenant: `post-checks.sql`, inventario de grants/RLS e teste com dois usuarios reais.
3. Obrigatorias quando houver upload/import: testes de limite, MIME/extensao, bucket privado, signed URL e processamento com timeout.
4. Obrigatorias quando houver Docker/cloud: Trivy/Grype, revisao de IAM, secrets por ambiente e branch protection.
5. Obrigatorias quando houver mobile: MobSF ou checklist manual equivalente, Keychain/Keystore, permissoes minimas e logs desativados em release.

Criterio extra de aprovacao:

Um app nao deve ser considerado forte em seguranca por camadas apenas por ter validacao no frontend. Para passar nesta baseline, as decisoes criticas de autenticacao, autorizacao, ownership, limite de payload, auditoria, integridade e escrita sensivel precisam ser validadas no backend e, quando aplicavel, reforcadas tambem no banco, storage, CI/CD e infraestrutura.
