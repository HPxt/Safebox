# SafeBox Backend

Backend API para o SafeBox - Gerenciador de senhas zero-knowledge.

## 🚀 Tecnologias

- **Node.js** 18+ com TypeScript
- **Express.js** - Framework web
- **Supabase** - Banco de dados PostgreSQL e autenticação
- **JWT** - Autenticação e autorização
- **Winston** - Sistema de logs
- **Zod** - Validação de dados
- **Helmet** - Segurança HTTP

## 📋 Pré-requisitos

- Node.js 18.0.0 ou superior
- npm ou yarn
- Conta no Supabase
- PostgreSQL (via Supabase)

## 🛠️ Instalação

1. **Clone o repositório e navegue para o backend:**
```bash
cd backend
```

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp env.example .env
```

4. **Configure o arquivo `.env` com suas credenciais:**
```env
# Servidor
NODE_ENV=development
PORT=3001
HOST=localhost

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

# JWT
JWT_SECRET=sua-chave-secreta-super-segura-de-pelo-menos-32-caracteres
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3000
```

5. **Configure o banco de dados no Supabase:**
   - Acesse o painel do Supabase
   - Vá para SQL Editor
   - Cole e execute o conteúdo do arquivo `../database.sql`

## 🚀 Execução

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

### Testes
```bash
npm test
npm run test:watch
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/          # Configurações (DB, env)
│   ├── middleware/      # Middlewares Express
│   ├── routes/          # Rotas da API
│   ├── services/        # Lógica de negócio
│   ├── types/           # Tipos TypeScript
│   ├── utils/           # Utilitários
│   └── index.ts         # Arquivo principal
├── logs/                # Arquivos de log
├── dist/                # Build de produção
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Endpoints

### Autenticação (`/api/auth`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/register` | Registrar usuário | ❌ |
| POST | `/login` | Login | ❌ |
| POST | `/logout` | Logout | ✅ |
| GET | `/profile` | Obter perfil | ✅ |
| PUT | `/profile` | Atualizar perfil | ✅ |
| POST | `/change-password` | Alterar senha | ✅ |
| POST | `/refresh-token` | Renovar token | ✅ |
| DELETE | `/account` | Deletar conta | ✅ |

### Vault (`/api/vault`)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/` | Obter vault | ✅ |
| POST | `/` | Criar vault | ✅ |
| PUT | `/` | Atualizar vault | ✅ |
| DELETE | `/` | Deletar vault | ✅ |
| GET | `/stats` | Estatísticas | ✅ |
| POST | `/backup` | Criar backup | ✅ |
| GET | `/backups` | Listar backups | ✅ |
| POST | `/restore/:id` | Restaurar backup | ✅ |
| GET | `/export` | Exportar dados | ✅ |

### Health Check

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| GET | `/health` | Status da API | ❌ |

## 🔒 Segurança

### Arquitetura Zero-Knowledge
- Dados são criptografados no cliente antes de serem enviados
- Servidor nunca tem acesso às senhas descriptografadas
- Chave mestra nunca é transmitida ou armazenada no servidor

### Medidas de Segurança
- **Helmet.js** - Headers de segurança HTTP
- **CORS** - Controle de origem cruzada
- **Rate Limiting** - Proteção contra ataques de força bruta
- **JWT** - Tokens seguros com expiração
- **Validação** - Validação rigorosa de entrada com Zod
- **Logs de Auditoria** - Rastreamento de todas as ações

### Headers de Segurança
```javascript
Content-Security-Policy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

## 📊 Monitoramento

### Logs
- **Console** - Desenvolvimento
- **Arquivo** - Produção (`logs/combined.log`, `logs/error.log`)
- **Auditoria** - Eventos de segurança (`logs/audit.log`)

### Health Check
```bash
curl http://localhost:3001/health
```

Resposta:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

## 🗃️ Banco de Dados

### Tabelas Principais
- `users` - Perfis de usuário
- `vaults` - Dados criptografados
- `user_settings` - Configurações
- `audit_logs` - Logs de auditoria
- `user_sessions` - Sessões ativas
- `vault_backups` - Backups automáticos

### Funções PostgreSQL
- `log_audit_event()` - Registrar eventos
- `cleanup_old_audit_logs()` - Limpeza automática
- `get_user_vault()` - Obter vault do usuário
- `update_user_last_login()` - Atualizar último login

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Servidor com hot reload
npm run build           # Build para produção
npm start              # Executar build de produção

# Qualidade de código
npm run lint           # Verificar código
npm run lint:fix       # Corrigir problemas automaticamente
npm run type-check     # Verificar tipos TypeScript

# Testes
npm test              # Executar testes
npm run test:watch    # Testes em modo watch

# Banco de dados
npm run db:generate   # Gerar tipos TypeScript do DB
npm run db:migrate    # Executar migrações
npm run db:reset      # Resetar banco local
```

## 🌍 Variáveis de Ambiente

### Obrigatórias
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_ANON_KEY` - Chave anônima do Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de service role
- `JWT_SECRET` - Chave secreta para JWT (mín. 32 chars)

### Opcionais
- `NODE_ENV` - Ambiente (development/production)
- `PORT` - Porta do servidor (padrão: 3001)
- `HOST` - Host do servidor (padrão: localhost)
- `CORS_ORIGIN` - Origem permitida para CORS
- `LOG_LEVEL` - Nível de log (error/warn/info/debug)

## 🚨 Troubleshooting

### Erro de Conexão com Banco
```bash
# Verificar variáveis de ambiente
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Testar conexão
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$SUPABASE_URL/rest/v1/users?select=count"
```

### Erro de JWT
```bash
# Verificar se JWT_SECRET tem pelo menos 32 caracteres
echo $JWT_SECRET | wc -c
```

### Erro de CORS
```bash
# Verificar se CORS_ORIGIN está correto
echo $CORS_ORIGIN
```

## 📝 Logs

### Localização
- Desenvolvimento: Console
- Produção: `logs/combined.log`, `logs/error.log`
- Auditoria: `logs/audit.log`

### Níveis de Log
- `error` - Erros críticos
- `warn` - Avisos importantes
- `info` - Informações gerais
- `debug` - Informações de debug

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

- 📧 Email: suporte@safebox.com
- 📖 Documentação: [docs.safebox.com](https://docs.safebox.com)
- 🐛 Issues: [GitHub Issues](https://github.com/safebox/safebox/issues) 