# 🚀 SafeBox Backend - Setup Rápido

## 1. Configurar Ambiente

1. **Copie a configuração pronta:**
   ```bash
   cp env-ready.txt .env
   ```
   
   ✅ **Todas as configurações já estão prontas:**
   - Supabase URL e chaves configuradas
   - JWT Secret gerada e configurada
   - Todas as variáveis de ambiente definidas

## 2. Instalar Dependências

```bash
npm install
```

## 3. Configurar Banco de Dados

1. **Abra o Supabase SQL Editor**
2. **Execute o SQL do arquivo `database-optimized.sql`**
3. **Verifique se todas as tabelas foram criadas**

## 4. Testar Integração

```bash
# Testar conexão com Supabase
npm run test:supabase

# Se tudo estiver OK, iniciar o servidor
npm run dev
```

## 5. Verificar Funcionamento

O servidor estará rodando em `http://localhost:3001`

### Endpoints disponíveis:

**Autenticação:**
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Perfil do usuário

**Vault (Credenciais):**
- `GET /api/vault` - Obter vault
- `POST /api/vault` - Criar vault
- `PUT /api/vault` - Atualizar vault
- `DELETE /api/vault` - Deletar vault
- `GET /api/vault/stats` - Estatísticas
- `POST /api/vault/backup` - Criar backup
- `GET /api/vault/backups` - Listar backups

**Configurações:**
- `GET /api/settings` - Obter configurações
- `PUT /api/settings` - Atualizar configurações
- `GET /api/settings/categories` - Listar categorias
- `POST /api/settings/categories` - Criar categoria
- `GET /api/settings/audit-logs` - Logs de auditoria
- `GET /api/settings/sessions` - Sessões ativas

## 6. Próximos Passos

Após o backend estar funcionando:
1. ✅ Backend integrado com Supabase
2. 🔄 Criar frontend React
3. 🔐 Implementar criptografia zero-knowledge
4. 🎨 Design da interface
5. 🧪 Testes end-to-end

## 🆘 Problemas Comuns

**Erro de conexão:**
- Verifique se as chaves do Supabase estão corretas
- Confirme se o banco de dados foi configurado

**Erro de autenticação:**
- Verifique se o `JWT_SECRET` está configurado
- Confirme se as políticas RLS estão ativas

**Erro de tabelas:**
- Execute novamente o SQL `database-optimized.sql`
- Verifique se todas as funções foram criadas 