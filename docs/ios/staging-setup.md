# Staging em projeto Supabase separado

Status 2026-10-24: provisionamento e testes conectados executados. Evidencias em
`staging-connected-validation.md`; o restante deste guia descreve o processo.

Nao depende de branches de banco. Um projeto independente tem URL, chaves,
usuarios, Auth e Storage proprios. Deve reproduzir o contrato da aplicacao,
sem copiar dados de producao.

## Provisionamento

1. Criar projeto com nome `safebox-staging`, na regiao apropriada.
2. Guardar a senha administrativa no gerenciador de senhas.
3. Informar URL do projeto e publishable key publica. Nao enviar senha do banco
   nem service_role pelo chat. Secrets de backend ficam no ambiente do servidor.
4. Criar backend staging separado, configurado exclusivamente para esse projeto.
5. Confirmar as duas URLs antes de executar testes de integracao.

## Estrutura

O repositorio tem SQL legados na raiz e 15 migrations de hardening em
`docs/sql/migrations`. As migrations de hardening nao criam necessariamente
todas as tabelas de um projeto vazio.

- Escolher e revisar uma baseline unica antes de executar: nao executar tanto
  `database-fixed.sql` quanto `database-optimized.sql` sem reconciliar diferencas.
- Os legados incluem `GRANT ALL` e operacoes de recriacao: nao sao um bootstrap
  endurecido pronto para copiar cegamente no SQL Editor.
- Revisar adicoes de crypto, tipos de credencial e 2FA contra a baseline.
- Aplicar todas as migrations de hardening 001-015 na ordem, revisando requisitos.
- Executar `docs/sql/db-security-inventory.sql` e `docs/sql/post-checks.sql`.
- Comparar tipos, defaults, constraints, policies, grants, views, RPCs e triggers
  com o contrato do backend e do iOS. Ausencia de erro SQL nao comprova paridade.
- Configurar separadamente Auth, redirects, email, buckets e Edge Functions;
  schema public nao inclui essas configuracoes.

## Dados e validacao

Criar apenas contas sinteticas A/B e cofre demo. Validar isolamento REST e API,
mass assignment, payloads, leitura/escrita web/iOS, 409 e recuperacao de sessao.
URLs e chaves de producao nao entram em `Local.xcconfig`.

O backend dedicado https://safebox-backend-staging.vercel.app passou em seis
testes HTTP reais conectados ao banco. A configuracao local do iOS aponta para
essa URL. Testar o app nativo no Mac/iPhone ainda e uma etapa distinta.
O CI macOS com mocks nao precisa deste projeto. TestFlight continua bloqueado
ate validar o fluxo nativo e concluir MFA/AutoFill, assinatura e testes fisicos.
