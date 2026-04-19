# 📧 Configuração de Notificações por Email

> **Receba relatórios em PDF diretamente no seu email automaticamente**

---

## ✅ O Que Foi Implementado

Sistema completo de notificações por email com:
- ✅ Relatórios em **PDF** automaticamente anexados
- ✅ Email **HTML formatado** com resumo visual
- ✅ **Alertas críticos imediatos** se houver problemas graves
- ✅ Envio automático após cada análise
- ✅ Seu email já configurado: **hppeixoto14@gmail.com**

---

## 🔧 Configuração do Gmail

### **Passo 1: Ativar "Senhas de App" no Gmail**

Para que o SafeBox possa enviar emails, você precisa criar uma senha de app do Gmail.

#### **1.1 Ativar Verificação em 2 Etapas:**

1. Acesse: https://myaccount.google.com/security
2. Clique em **"Verificação em duas etapas"**
3. Clique em **"Começar"**
4. Siga os passos para configurar (SMS ou app Google Authenticator)

#### **1.2 Criar Senha de App:**

1. Acesse: https://myaccount.google.com/apppasswords
2. Na seção **"Nome do app"**, digite: `SafeBox AI`
3. Clique em **"Criar"**
4. **Copie a senha de 16 caracteres gerada** (exemplo: `abcd efgh ijkl mnop`)
5. Guarde essa senha - você vai precisar dela!

---

### **Passo 2: Configurar no SafeBox**

Edite o arquivo `backend/.env` e adicione:

```bash
# ===== CONFIGURAÇÃO DE EMAIL =====

# Ativar notificações por email
EMAIL_NOTIFICATIONS=true

# SMTP Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

# Suas credenciais
SMTP_USER=hppeixoto14@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop  # <- Cole a senha de app aqui (sem espaços)

# Remetente (seu email)
EMAIL_FROM=SafeBox Security AI <hppeixoto14@gmail.com>

# Destinatário (seu email)
EMAIL_TO=hppeixoto14@gmail.com

# Enviar apenas se houver descobertas (true/false)
EMAIL_ONLY_ON_FINDINGS=true

# Enviar alertas críticos imediatamente (true/false)
EMAIL_CRITICAL_IMMEDIATE=true
```

---

## 📧 Como Funciona

### **Fluxo Automático:**

```
1. Agente executa análise (domingo 02:00)
           ↓
2. Relatório gerado (Markdown + HTML + JSON)
           ↓
3. HTML convertido para PDF
           ↓
4. Email enviado automaticamente
           ↓
5. Você recebe no hppeixoto14@gmail.com
```

### **Tipos de Email:**

#### **1. Relatório Normal (sem findings críticos):**
```
Assunto: ✅ Análise de Auditoria - Tudo Normal
Anexo: relatorio-Analise-de-Auditoria-a1b2c3d4.pdf
```

#### **2. Relatório com Descobertas:**
```
Assunto: ⚠️ ✅ Análise de Auditoria - 3 Descoberta(s)
Anexo: relatorio-Analise-de-Auditoria-a1b2c3d4.pdf
```

#### **3. Alerta Crítico (2 emails):**
```
Email 1 (IMEDIATO):
Assunto: 🚨 ALERTA CRÍTICO - Análise de Auditoria
Corpo: Lista dos problemas críticos
Sem anexo (prioridade na velocidade)

Email 2 (alguns minutos depois):
Assunto: 🚨 ✅ Análise de Auditoria - 2 Crítico(s) Detectado(s)
Anexo: relatorio-Analise-de-Auditoria-a1b2c3d4.pdf
```

---

## 📄 Conteúdo do Email

### **Cabeçalho:**
- Nome do agente (ex: Análise de Auditoria)
- Status (✅ Sucesso ou ❌ Falha)
- ID da execução
- Data e hora

### **Métricas Visuais:**
- Anomalias detectadas
- Ações executadas
- Findings críticos
- Findings altos

### **Principais Descobertas:**
- Top 3 findings críticos (se houver)
- Top 2 findings altos (se houver)
- Título e descrição de cada um

### **Anexo:**
- PDF completo com TODAS as descobertas
- Evidências detalhadas
- Recomendações específicas
- Gráficos e formatação profissional

---

## 🎯 Exemplo de Email que Você Vai Receber

```
De: SafeBox Security AI <hppeixoto14@gmail.com>
Para: hppeixoto14@gmail.com
Assunto: ⚠️ ✅ Análise de Auditoria - 3 Descoberta(s)
Anexo: relatorio-Analise-de-Auditoria-a1b2c3d4.pdf (245 KB)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Análise de Auditoria

Status: Sucesso
ID: a1b2c3d4
Data: domingo, 6 de janeiro de 2025 14:32:15

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Resumo:
┌──────────────┬──────┐
│ Anomalias    │  3   │
│ Ações        │  2   │
│ Críticos     │  1   │
│ Altos        │  2   │
└──────────────┴──────┘

🔍 Principais Descobertas:

━━ CRÍTICO ━━
Múltiplas Tentativas de Login Falhadas

Detectadas 15 tentativas de login falhadas 
do IP 192.168.xxx.xxx em 5 minutos.

━━ ALTO ━━
Acesso Fora do Horário Normal

Usuário acessou sistema às 03:47 AM
(horário incomum para este usuário).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📎 Relatório completo em PDF anexado

Abra o arquivo PDF para ver todas as 
descobertas, evidências e recomendações 
detalhadas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SafeBox Security AI v1.2
Sistema Inteligente de Análise de Segurança
```

---

## ⚙️ Opções de Configuração

### **Enviar Sempre vs Apenas com Findings:**

```bash
# Enviar sempre (mesmo sem problemas)
EMAIL_ONLY_ON_FINDINGS=false

# Enviar apenas se houver descobertas
EMAIL_ONLY_ON_FINDINGS=true  # <- Recomendado
```

### **Alertas Críticos Imediatos:**

```bash
# Enviar 2 emails se crítico (alerta + relatório)
EMAIL_CRITICAL_IMMEDIATE=true  # <- Recomendado

# Enviar apenas relatório completo
EMAIL_CRITICAL_IMMEDIATE=false
```

### **Múltiplos Destinatários:**

```bash
# Enviar para múltiplos emails (separar por vírgula)
EMAIL_TO=hppeixoto14@gmail.com,outro@email.com,admin@empresa.com
```

---

## 🧪 Testar Configuração

### **Script de Teste:**

Crie `backend/test-email.js`:

```javascript
const { EmailService } = require('./dist/ai/notifications/EmailService');

async function testEmail() {
  console.log('🧪 Testando envio de email...\n');

  const emailService = new EmailService();

  // Testar conexão SMTP
  console.log('1️⃣ Testando conexão SMTP...');
  const connected = await emailService.testConnection();

  if (connected) {
    console.log('✅ Conexão SMTP OK!\n');
    console.log('📧 Configuração:');
    console.log('   Host:', process.env.SMTP_HOST);
    console.log('   Port:', process.env.SMTP_PORT);
    console.log('   User:', process.env.SMTP_USER);
    console.log('   To:', process.env.EMAIL_TO);
    console.log('\n✅ Tudo configurado corretamente!');
  } else {
    console.log('❌ Falha na conexão SMTP\n');
    console.log('💡 Verifique:');
    console.log('   1. Senha de app do Gmail está correta');
    console.log('   2. Verificação em 2 etapas ativada');
    console.log('   3. Variáveis de ambiente no .env');
  }
}

testEmail();
```

**Executar:**
```bash
cd backend
node test-email.js
```

---

## 🚨 Troubleshooting

### **Erro: "Invalid login"**

**Solução:**
1. Verificar se senha de app está correta no `.env`
2. Senha deve ter 16 caracteres (sem espaços)
3. Verificação em 2 etapas deve estar ativa

### **Erro: "Connection timeout"**

**Solução:**
1. Verificar se porta 587 não está bloqueada
2. Verificar firewall do Windows
3. Tentar porta 465 com `SMTP_SECURE=true`

### **Não recebo emails:**

**Checklist:**
1. ✅ `EMAIL_NOTIFICATIONS=true` no `.env`
2. ✅ Análise gerou findings (se `EMAIL_ONLY_ON_FINDINGS=true`)
3. ✅ Email não caiu na pasta de SPAM
4. ✅ Verifique logs: `backend/logs/`

### **Email na Pasta de SPAM:**

**Solução:**
1. Abrir email
2. Clicar em "Não é spam"
3. Adicionar `hppeixoto14@gmail.com` aos contatos
4. Próximos emails irão para caixa de entrada

---

## 📊 Formato do PDF Anexado

### **Estrutura:**

```
Página 1: Cabeçalho e Resumo
├── Nome do agente
├── Status e ID
├── Métricas visuais
└── Gráficos de severidade

Página 2+: Descobertas Detalhadas
├── Críticos (com bordas vermelhas)
├── Altos (com bordas laranjas)
├── Médios (com bordas amarelas)
└── Baixos (com bordas verdes)

Cada Finding:
├── Título e categoria
├── Descrição detalhada
├── Recurso afetado
├── Evidências (colapsável)
└── Recomendações (numeradas)

Última Página: Ações
├── Ações executadas automaticamente
├── Ações pendentes de aprovação
└── Rodapé com data e versão
```

### **Aparência:**
- **Profissional** - Formatação limpa e legível
- **Cores** - Severidades claramente identificáveis
- **Compacto** - Geralmente 2-5 páginas
- **Imprimível** - Formatação A4 perfeita

---

## 🔒 Segurança e Privacidade

### **Dados no Email:**

✅ **Incluído (seguro):**
- Metadados sanitizados
- IPs anonimizados (192.168.xxx.xxx)
- User IDs hasheados
- Timestamps e métricas
- Categorias e severidades

❌ **NÃO Incluído:**
- Senhas
- Chaves de criptografia
- Dados descriptografados
- Informações pessoais identificáveis
- Emails de usuários (apenas hashes)

### **Transporte:**
- ✅ TLS/SSL obrigatório (porta 587)
- ✅ Senha de app (não senha real do Gmail)
- ✅ Email criptografado em trânsito
- ✅ PDF armazenado localmente após envio

---

## 📅 Frequência de Emails

### **Padrão (Semanal):**
- **Domingo 02:00:** Audit Agent → Email
- **Domingo 03:00:** Health Monitor → Email
- **Domingo 04:00:** Compliance Checker → Email
- **Domingo 05:00:** Breach Detector → Email

**Total:** 4 emails por semana (se houver findings)

### **Alertas Críticos:**
- **Imediato:** Quando detectado (qualquer dia/hora)
- **Exemplo:** Brute force em andamento → Email agora

---

## 💡 Dicas e Boas Práticas

### **1. Criar Regras no Gmail:**

**Regra 1: Marcar como Importante**
```
De: SafeBox Security AI
Assunto contém: 🚨 ALERTA CRÍTICO
Ação: Marcar como importante + Notificação push
```

**Regra 2: Organizar em Pasta**
```
De: SafeBox Security AI
Assunto contém: ✅
Ação: Aplicar etiqueta "SafeBox/Relatórios"
```

### **2. Configurar Notificações Push:**
1. Gmail App → Configurações
2. Notificações → Todas
3. Apenas para emails importantes de SafeBox

### **3. Revisar Semanalmente:**
- Segunda-feira de manhã: revisar 4 emails da semana
- Priorizar críticos e altos
- Arquivar após revisão

---

## ✅ Checklist de Configuração

- [ ] Verificação em 2 etapas ativada no Gmail
- [ ] Senha de app criada
- [ ] Arquivo `.env` configurado
- [ ] Senha de app colada no `SMTP_PASSWORD`
- [ ] Teste de conexão executado com sucesso
- [ ] Email de teste recebido
- [ ] Não está no SPAM
- [ ] Regras do Gmail configuradas (opcional)

---

## 📞 Precisa de Ajuda?

### **Configuração Gmail:**
https://support.google.com/accounts/answer/185833

### **Testar Configuração:**
```bash
cd backend
node test-email.js
```

### **Ver Logs:**
```bash
cat backend/logs/audit.log | grep "Email"
```

---

**Status:** ✅ Implementado e Documentado  
**Seu Email:** hppeixoto14@gmail.com  
**Formato:** PDF anexado automaticamente  
**Frequência:** Semanal (domingos) + Alertas críticos imediatos  

---

🎉 **Notificações por email configuradas! Você receberá relatórios em PDF automaticamente.**

**Próximo Passo:** Configurar senha de app do Gmail e testar!

