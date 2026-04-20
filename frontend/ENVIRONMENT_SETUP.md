# Configuracao de Ambiente - Frontend

## Variaveis de Ambiente Necessarias

Para que a aplicacao funcione corretamente, crie o arquivo `frontend/.env` com estas variaveis:

```env
# Supabase Configuration (React requires REACT_APP_ prefix)
REACT_APP_SUPABASE_URL=https://yourprojectid.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# Public URL used in confirmation and password reset emails
REACT_APP_PUBLIC_APP_URL=https://your-public-domain.com

# Application Configuration
REACT_APP_NAME=SafeBox
REACT_APP_VERSION=1.0.0

# Security Configuration
REACT_APP_MASTER_PASSWORD_MIN_LENGTH=12
REACT_APP_PASSWORD_ITERATIONS=100000

# Development Configuration
REACT_APP_DEBUG=true
GENERATE_SOURCEMAP=false
```

## Como obter as credenciais

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Va em **Settings -> API**
4. Copie:
   - **Project URL** -> `REACT_APP_SUPABASE_URL`
   - **anon public key** -> `REACT_APP_SUPABASE_ANON_KEY`

## Deploy em producao

Configure as mesmas variaveis no provedor de hospedagem:

- **Vercel**: Project Settings -> Environment Variables
- **Netlify**: Site Settings -> Environment Variables
- **GitHub Pages**: Repository Settings -> Secrets and Variables -> Actions

`REACT_APP_PUBLIC_APP_URL` deve apontar para a URL publica real do app. Ela sera usada em todos os emails de confirmacao de conta e redefinicao de senha. Em producao, nao deixe esse valor vazio.

## Redirect URLs no Supabase

No Supabase Dashboard, configure as Redirect URLs permitidas para incluir:

- `https://your-public-domain.com/auth/callback`
- `http://localhost:3000/auth/callback` apenas para desenvolvimento local

## Notas importantes

- Nunca commite o arquivo `.env`
- As chaves `anon` sao seguras para uso no frontend
- Nunca use `service_role` keys no frontend
- O prefixo `REACT_APP_` e obrigatorio para React

## Troubleshooting

### Erro: "Supabase credentials are not configured"

- Verifique se o arquivo `.env` existe em `frontend/.env`
- Confirme que as variaveis usam o prefixo `REACT_APP_`
- Reinicie o servidor de desenvolvimento apos alterar o `.env`

### Emails abrindo localhost

- Verifique se `REACT_APP_PUBLIC_APP_URL` esta configurada no ambiente de producao
- Confirme se o Supabase tem a URL publica correta cadastrada em Redirect URLs
- Nao crie contas em ambiente de producao usando um frontend apontando para `localhost`
