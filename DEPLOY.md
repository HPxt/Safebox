# 🚀 SafeBox - Guia de Deploy

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase
- Conta no Vercel (ou outra plataforma de hospedagem)

## 🔧 Preparação

### 1. Configurar Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL do arquivo `database-optimized.sql` no SQL Editor
3. Anote suas credenciais:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configurar Variáveis de Ambiente

#### Frontend (.env)
```bash
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend (.env)
```bash
# Copie o arquivo env.example e configure todas as variáveis
cp backend/env.example backend/.env
```

## 🚀 Deploy Frontend (Vercel)

### Opção 1: Deploy via GitHub

1. Faça push do código para o GitHub
2. Acesse [Vercel](https://vercel.com/new)
3. Importe o repositório
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Adicione as variáveis de ambiente
6. Deploy!

### Opção 2: Deploy via CLI

```bash
cd frontend
npm install -g vercel
vercel
```

## 🔧 Deploy Backend

### Opção 1: Railway.app

1. Crie conta no [Railway](https://railway.app)
2. Conecte o repositório
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Adicione todas as variáveis de ambiente
5. Deploy!

### Opção 2: Render.com

1. Crie conta no [Render](https://render.com)
2. Crie um novo Web Service
3. Conecte o repositório
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Adicione variáveis de ambiente
6. Deploy!

### Opção 3: VPS (Manual)

```bash
# No servidor
git clone your-repo
cd your-repo/backend
npm install
npm run build
npm install -g pm2
pm2 start dist/index.js --name safebox-backend
```

## 🔐 Segurança Pós-Deploy

1. **Atualize CORS** no backend para aceitar apenas seu domínio
2. **Configure Rate Limiting** adequado
3. **Ative HTTPS** em ambos os serviços
4. **Configure backups** automáticos no Supabase
5. **Monitore logs** regularmente

## 📊 Monitoramento

### Recomendações:
- **Frontend**: Vercel Analytics
- **Backend**: LogRocket ou Sentry
- **Banco de dados**: Supabase Dashboard
- **Uptime**: UptimeRobot

## 🆘 Troubleshooting

### Erro de CORS
- Verifique as configurações de CORS no backend
- Certifique-se que o domínio do frontend está na lista permitida

### Erro de conexão com Supabase
- Verifique as variáveis de ambiente
- Confirme que o projeto Supabase está ativo

### Build falha
- Verifique versão do Node.js (deve ser 18+)
- Limpe cache: `npm cache clean --force`
- Delete node_modules e reinstale

## 📞 Suporte

Para problemas ou dúvidas, abra uma issue no GitHub. 