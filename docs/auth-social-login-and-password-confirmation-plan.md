# Plano - Login Social e Remocao de Confirmacao de Email

## Objetivo

Atualizar web e iOS para suportar:

- login normal por email/senha;
- login com Google;
- login com Apple;
- cadastro email/senha sem exigir confirmacao por link de email.

## Decisoes normativas

### Providers suportados

| Plataforma | Email/senha | Google | Apple |
|---|---:|---:|---:|
| Web | sim | sim | sim |
| iOS | sim | sim | sim |

Regras:

- manter login normal por email/senha;
- adicionar Google e Apple via Supabase Auth OAuth;
- se Google estiver disponivel, Apple tambem deve estar disponivel para evitar risco de rejeicao Apple;
- nao criar contas duplicadas quando o mesmo email vier de providers diferentes;
- tratar conflito de identidade com mensagem clara e fluxo de link/merge de conta quando Supabase exigir.

## Web

Fluxos:

1. Tela de login mostra tres opcoes:
   - entrar com email/senha;
   - continuar com Google;
   - continuar com Apple.
2. Tela de cadastro tambem mostra as tres opcoes.
3. O fluxo email/senha deve criar sessao utilizavel sem exigir clique em email de confirmacao.
4. OAuth usa redirect publico canonico:
   - `REACT_APP_PUBLIC_APP_URL/auth/callback`.
5. Se o usuario logar via Google/Apple e ainda nao tiver senha-mestra configurada, seguir para setup de senha-mestra.

Configuracao Supabase:

- habilitar Google provider;
- habilitar Apple provider;
- configurar redirect URLs de producao e desenvolvimento;
- desabilitar confirmacao obrigatoria de email para cadastro email/senha, se essa for a decisao final de produto;
- manter emails transacionais para recuperacao/seguranca quando aplicavel;
- OAuth nao deve depender de link de confirmacao por email.

## iOS

Fluxos:

1. Login por email/senha continua existindo.
2. Google/Apple devem usar fluxo nativo seguro:
   - preferencia: Supabase Swift OAuth com PKCE/ASWebAuthenticationSession;
   - callbacks via URL scheme ou Universal Links configurados no Supabase.
3. Apple Sign In deve usar capability correta no target iOS se for implementado nativamente.
4. Apos login OAuth, o app ainda precisa fazer unlock do vault com senha-mestra ou biometria previamente configurada.

Importante:

- Google/Apple autenticam a conta SafeBox;
- eles nao substituem a senha-mestra do cofre;
- Face ID/Touch ID desbloqueiam segredo local protegido, nao fazem login social.

## Confirmacao por email no cadastro

Decisao de produto:

- remover a exigencia de confirmar conta por email antes do primeiro login;
- email/senha deve funcionar imediatamente apos cadastro;
- Google/Apple ja validam identidade pelo provider OAuth;
- continuar permitindo recuperar senha por email.

Mitigacoes:

- rate limit forte para signup/login;
- mensagens neutras contra enumeracao de email;
- monitoramento de abuso;
- opcional futuro: marcar `emailVerified`/`providerVerified` para recursos sensiveis sem bloquear o cofre v1.

### Senha da conta

- UI deve ter toggle para revelar/ocultar senha.
- Erros devem ser claros e recuperaveis.

### Senha-mestra do vault

Decisao de produto: manter confirmacao obrigatoria da senha-mestra.

Mitigacoes obrigatorias:

- toggle "mostrar senha" visivel durante setup/alteracao;
- strength meter com bloqueio abaixo de score 7;
- recomendacao visual de score 8+;
- texto claro: "Nao temos como recuperar sua senha-mestra se voce esquecer ou digitar errado.";
- campo de confirmacao da senha-mestra deve bater exatamente;
- acao primaria deve deixar claro que esta senha protege o cofre;
- teste UI deve garantir que existe confirmacao no fluxo de senha-mestra.

Nao permitido:

- salvar senha-mestra;
- enviar senha-mestra ao backend;
- usar Google/Apple como substituto da senha-mestra;
- resetar cofre automaticamente se o usuario esquecer a senha-mestra.

## App Store / Apple Review

- Como Google sera oferecido, Apple Sign In deve estar disponivel tambem.
- App Review demo account deve preferir email/senha para facilitar teste.
- Notas de review devem explicar que Google/Apple sao login de conta, mas vault continua zero-knowledge.
- Privacy labels devem declarar providers/auth corretamente, sem afirmar que o app coleta conteudo do vault em plaintext.

## Criterios de aceite

- Web: login email/senha continua funcionando.
- Web: login Google funciona e retorna para `/auth/callback` publico.
- Web: login Apple funciona e retorna para `/auth/callback` publico.
- Web: cadastro email/senha nao exige clique em email de confirmacao para primeiro acesso.
- iOS: login email/senha continua funcionando.
- iOS: Google e Apple funcionam em device real/TestFlight.
- iOS: Apple Sign In esta visivel sempre que Google estiver visivel.
- Vault: login social nao pula unlock da senha-mestra.
- Vault: setup/alteracao de senha-mestra mantem campo confirmar senha, mostrar senha + aviso de nao recuperacao.
- QA: conta criada por OAuth sem vault configurado entra no fluxo correto de setup de senha-mestra.
