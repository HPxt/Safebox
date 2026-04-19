# Configuração de Ambiente - Frontend

## Variáveis de Ambiente Necessárias

Para que a aplicação funcione corretamente, você precisa configurar as seguintes variáveis de ambiente:

### 1. Crie o arquivo `.env` na pasta `frontend/`

```bash
# Copie o conteúdo abaixo para frontend/.env
```

### 2. Configure as Variáveis do Supabase

```env
# Supabase Configuration (React requires REACT_APP_ prefix)
REACT_APP_SUPABASE_URL=https://yourprojectid.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

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

### 3. Obtenha suas Credenciais do Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → `REACT_APP_SUPABASE_URL`
   - **anon public** key → `REACT_APP_SUPABASE_ANON_KEY`

### 4. Para Deploy em Produção

Configure as mesmas variáveis no seu provedor de hospedagem:

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Environment Variables
- **GitHub Pages**: Repository Settings → Secrets and Variables → Actions

## Notas Importantes

- ⚠️ **Nunca commite o arquivo `.env`** - ele está no `.gitignore`
- 🔒 As chaves `anon` são seguras para uso no frontend
- 🚫 **NUNCA** use `service_role` keys no frontend
- 📝 O prefixo `REACT_APP_` é obrigatório para React

## Troubleshooting

### Erro: "supabaseUrl is required"

- Verifique se o arquivo `.env` existe em `frontend/.env`
- Confirme que as variáveis têm o prefixo `REACT_APP_`
- Reinicie o servidor de desenvolvimento após criar/alterar o `.env`

### Build/Deploy Falhando

- Configure as variáveis de ambiente no seu provedor de hospedagem
- Certifique-se de que todas as variáveis necessárias estão definidas
- Verifique os logs de build para mensagens de erro específicas 