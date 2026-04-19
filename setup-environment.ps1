# Script para configurar o ambiente SafeBox
# Execute como: powershell -ExecutionPolicy Bypass -File setup-environment.ps1

Write-Host "🔐 SafeBox - Configuração de Ambiente" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se estamos no diretório correto
if (-not (Test-Path "frontend")) {
    Write-Host "❌ Erro: Execute este script no diretório raiz do projeto SafeBox" -ForegroundColor Red
    exit 1
}

# Verifica se o Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js detectado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado. Instale Node.js 16+ antes de continuar." -ForegroundColor Red
    Write-Host "   Download: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Instala dependências do frontend
Write-Host ""
Write-Host "📦 Instalando dependências do frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependências instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}

# Cria arquivo .env se não existir
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "📝 Criando arquivo .env..." -ForegroundColor Yellow
    
    $envContent = @"
# Frontend Environment Variables for React
# ⚠️ IMPORTANT: Replace with your actual Supabase credentials

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
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ Arquivo .env criado!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Arquivo .env já existe, mantendo configurações atuais" -ForegroundColor Blue
}

# Volta para o diretório raiz
Set-Location ..

Write-Host ""
Write-Host "🎉 Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure suas credenciais do Supabase em frontend/.env" -ForegroundColor White
Write-Host "2. Execute: cd frontend && npm start" -ForegroundColor White
Write-Host ""
Write-Host "📖 Para mais detalhes, veja:" -ForegroundColor Cyan
Write-Host "   - frontend/ENVIRONMENT_SETUP.md" -ForegroundColor White
Write-Host "   - README.md" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Para obter suas credenciais do Supabase:" -ForegroundColor Cyan
Write-Host "   https://app.supabase.com → Seu Projeto → Settings → API" -ForegroundColor White 