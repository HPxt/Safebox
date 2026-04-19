# 📋 Exemplo de Configuração .env

Copie este conteúdo para `backend/.env`:

```bash
# ===== SAFEBOX BACKEND CONFIGURATION =====

# ===== SUPABASE =====
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# ===== JWT =====
JWT_SECRET=your-jwt-secret-here

# ===== SERVER =====
PORT=3001
NODE_ENV=development

# ===== LLM CONFIGURATION =====
LLM_PROVIDER=lmstudio
LMSTUDIO_HOST=http://localhost:1234
LMSTUDIO_MODEL=gpt-oss-20b
LLM_TIMEOUT=120000
LLM_MAX_RETRIES=3

# ===== EMAIL NOTIFICATIONS =====
EMAIL_NOTIFICATIONS=true

# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

# Gmail Credentials
SMTP_USER=hppeixoto14@gmail.com
SMTP_PASSWORD=your-gmail-app-password-here  # 16 caracteres da senha de app

# Email Settings
EMAIL_FROM=SafeBox Security AI <hppeixoto14@gmail.com>
EMAIL_TO=hppeixoto14@gmail.com

# Email Behavior
EMAIL_ONLY_ON_FINDINGS=true
EMAIL_CRITICAL_IMMEDIATE=true

# ===== REDIS (OPTIONAL) =====
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=604800  # 7 dias em segundos

# ===== AI AGENTS =====
AI_SCHEDULE_ENABLED=true
AI_SCHEDULE_TIMEZONE=America/Sao_Paulo
AI_AUTOMATION_LEVEL=3  # 1=alertas, 2=sugestões, 3=parcial, 4=autônomo

# ===== REPORTS =====
REPORTS_DIR=./reports
REPORTS_FORMAT=all  # markdown, html, json, all
REPORTS_INCLUDE_DETAILS=true
```

## 🔑 Como Obter a Senha de App do Gmail

1. Acesse: https://myaccount.google.com/apppasswords
2. Nome do app: `SafeBox AI`
3. Clique em "Criar"
4. Copie a senha de 16 caracteres
5. Cole em `SMTP_PASSWORD` (sem espaços)

## ✅ Depois de Configurar

```bash
cd backend
node test-email.js  # Testar configuração
```

