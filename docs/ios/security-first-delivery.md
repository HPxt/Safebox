# iOS: entrega com gates de seguranca

Atualizado em 2026-10-24. Status abaixo distingue codigo de validacao executada.

Atualizacao de staging: banco provisionado e 17 testes conectados passaram.
Detalhes e pendencia de acesso Vercel em `staging-connected-validation.md`.

## Arquitetura

- SafeBoxCore preserva o protocolo criptografico web/iOS e as regras de dominio.
- App SwiftUI injeta adapters de rede; segredo do cofre nao vai ao servidor.
- Sessao Supabase fica apenas em memoria nesta primeira versao. Encerrar o app
  exige login novamente. Persistencia futura exige Keychain ThisDeviceOnly,
  segregacao por usuario/ambiente, testes de reinstalacao e politica de revogacao.
- Refresh concorrente usa um unico intercambio por refresh token no processo.
  Uma geracao local impede que respostas anteriores ao logout restaurem a sessao.
- Backend permanece horizontalmente escalavel; nenhum grant distribuido deve
  depender de memoria de uma instancia. Se houver step-up, usar estado partilhado
  com expiracao e vinculo ao session_id, tambem aplicado no banco/RLS.
- HTTP usa sessao efemera, sem cookies/cache, timeouts e rejeicao de redirects.
  TLS usa a validacao de confianca do sistema; nao desabilitar ATS.

## Gate A: implementado nesta entrega, validacao Apple pendente

- Configuracao explicita staging por xcconfig/Info.plist.
- Chave publishable publica; rejeicao de legacy JWT/service-role/secret.
- Projeto fornecido anteriormente bloqueado para nao assumir que seja staging.
- Renovacao de access/refresh tokens, logout remoto local-scope, limpeza local.
- Senhas de login/desbloqueio removidas do estado apos uso bem-sucedido.
- Extensao embutida no app pelo projeto XcodeGen.
- Target XCTest para transporte/sessao/configuracao.
- CI macOS: core, builds Debug/Release, testes no simulador e artifact xcresult.

O gate estatico nao substitui compilacao, teste conectado ou pentest.

## Gate B: configuracao e teste conectado

O usuario informou que existe apenas producao. Pode ser criado outro projeto
Supabase independente para staging; branches de banco nao sao requisito.
Nao existe `supabase/migrations` consolidado no repositorio: os SQL legados e
as 14 migrations em `docs/sql/migrations` devem ser inventariados e revisados
antes de aplicar no projeto vazio. Ver `staging-setup.md`.
Nao assumir que um projeto novo ja tenha schema, RLS, grants, RPCs, buckets,
Auth providers, redirects ou configuracao de email iguais aos de producao.
Comparar estrutura/configuracao, sem clonar usuarios, dados ou secrets.

Necessario: Supabase staging separado, publishable key desse projeto e backend
staging HTTPS confirmado. Nao reutilizar dados nem projeto de producao.

Criar localmente `ios/SafeBoxApp/Config/Local.xcconfig` (ignorado pelo Git), com:

```xcconfig
SAFEBOX_ENVIRONMENT = staging
SAFEBOX_SUPABASE_URL = https:/$()/PROJECT_REF.supabase.co
SAFEBOX_PUBLISHABLE_KEY = sb_publishable_PUBLIC_KEY
SAFEBOX_BACKEND_URL = https:/$()/BACKEND_STAGING_HOST
```

O escape `$()` preserva `//` no parser xcconfig. Backend URL e a raiz do
servidor; o adapter acrescenta `api/vault`. O rotulo staging e a lista de
bloqueio evitam enganos conhecidos, mas nao provam isolamento: confirmar o
projeto e o backend antes de qualquer teste conectado.

Criar contas sinteticas A/B com cofre conhecido e testar login, expiracao,
refresh, logout, leitura e escrita cruzadas web/iOS, conflito 409, adulteracao
de ciphertext e tentativas entre usuarios. Nunca tratar erros de autorizacao
como motivo para bypass por service_role ou para afrouxar RLS.

## Gate C: MFA, AiTM e AutoFill

Pendente. O 2FA customizado web nao fornece automaticamente AAL2 Supabase.
Antes de liberar distribuicao, alinhar MFA no emissor, backend E RLS, incluindo
acessos REST diretos. Uma verificacao de senha-mestra no frontend nao e prova
de step-up no servidor. Nao enviar a senha-mestra ao backend para obter grants.

TOTP/refresh rotation/HttpOnly nao tornam uma sessao bearer resistente a AiTM.
Passkeys vinculadas ao dominio mitigam phishing de autenticacao; nao impedem
por si so o uso de um bearer token ja roubado. IP/UA sao sinais, nao provas
de posse. Nao prometer bloqueio de replay com estas mudancas.

AutoFill continua bloqueado: falta UI protegida e resolucao de segredo.
Definir snapshot cifrado compartilhado, chave de aparelho com biometria,
isolamento por conta e invalidacao/limpeza. Nenhuma senha em texto claro no
App Group. O grant do host atual e revogado no background; nao remover essa
protecao para simular AutoFill funcional. Testar o fluxo inteiro em device.

## Gate D: Mac, aparelho e TestFlight

1. Executar workflow iOS e corrigir build/testes antes de promover o branch.
2. Team Apple real, Bundle IDs, App Groups e Keychain sharing provisionados.
3. Dominios/AASA e capabilities conferidos com a titularidade real.
4. iPhone: Face ID, alteracao de biometria, background, app switcher,
   expiracao, rede intermitente, logout, sincronizacao e AutoFill no Safari.
5. Conferir Privacy Manifest, privacidade, suporte, export compliance,
   conta demo sintetica e notas de review.
6. Archive assinado, upload App Store Connect, teste interno TestFlight.

Assinatura, upload e teste fisico dependem de acesso ao Mac/Apple Developer.
Nao registrar como concluidos sem evidencia. Publicar TestFlight somente
apos gates B/C/D; build unsigned no CI nao e archive distribuivel.

## Fontes

## Evidencia local desta entrega

- `node scripts/ios-static-gate.mjs`: passou.
- Parse de sintaxe Swift dos 17 arquivos iniciais do host/testes: passou.
- `swift test --package-path ios/SafeBoxCore -v` fora do sandbox: 74 testes,
  1 ignorado (vetor lento opt-in), 0 falhas, Windows Swift 6.3.1.
- Testes novos do host e builds Apple: verificar workflow iOS no PR; nao
  confundir os 74 testes do core com execucao dos testes novos de sessao.

## Fontes oficiais

- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/reference/javascript/auth-signout

Logout revoga refresh tokens; access tokens ja emitidos podem continuar validos
ate expirar. Revogacao imediata requer validacao de sessao no servidor/banco.
