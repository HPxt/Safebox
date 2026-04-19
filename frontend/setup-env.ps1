# Script para configurar variáveis de ambiente do Supabase
# Execute este script no PowerShell antes de iniciar o servidor

Write-Host "🔧 Configurando variáveis de ambiente do SafeBox..." -ForegroundColor Blue

# Verificar se as credenciais foram fornecidas como parâmetros
param(
    [Parameter(Mandatory=$false)]
    [string]$SupabaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$SupabaseAnonKey
)

if (-not $SupabaseUrl -or -not $SupabaseAnonKey) {
    Write-Host "❌ Uso: .\setup-env.ps1 -SupabaseUrl 'https://seu-projeto.supabase.co' -SupabaseAnonKey 'sua-chave-anonima'" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Para obter suas credenciais:" -ForegroundColor Yellow
    Write-Host "1. Acesse https://supabase.com" -ForegroundColor White
    Write-Host "2. Crie/acesse seu projeto" -ForegroundColor White
    Write-Host "3. Vá em Settings > API" -ForegroundColor White
    Write-Host "4. Copie a 'Project URL' e 'anon public key'" -ForegroundColor White
    Write-Host ""
    Write-Host "🚧 Continuando em modo de desenvolvimento..." -ForegroundColor Yellow
    
    # Configurar modo de desenvolvimento
    $env:REACT_APP_SUPABASE_URL = "https://dev.supabase.co"
    $env:REACT_APP_SUPABASE_ANON_KEY = "dev-mode"
} else {
    Write-Host "✅ Configurando modo de produção..." -ForegroundColor Green
    
    # Validar formato da URL
    if (-not $SupabaseUrl.StartsWith("https://") -or -not $SupabaseUrl.Contains(".supabase.co")) {
        Write-Host "❌ URL inválida. Deve ser no formato: https://seu-projeto.supabase.co" -ForegroundColor Red
        exit 1
    }
    
    # Validar formato da chave
    if ($SupabaseAnonKey.Length -lt 100) {
        Write-Host "❌ Chave anônima muito curta. Verifique se copiou corretamente." -ForegroundColor Red
        exit 1
    }
    
    # Configurar variáveis de produção
    $env:REACT_APP_SUPABASE_URL = $SupabaseUrl
    $env:REACT_APP_SUPABASE_ANON_KEY = $SupabaseAnonKey
    
    Write-Host "🌐 URL: $SupabaseUrl" -ForegroundColor Green
    Write-Host "🔑 Chave: $($SupabaseAnonKey.Substring(0, 20))..." -ForegroundColor Green
}

# Configurar outras variáveis
$env:REACT_APP_VERSION = "1.0.0"
$env:NODE_ENV = "development"

Write-Host ""
Write-Host "🚀 Variáveis configuradas! Iniciando servidor..." -ForegroundColor Blue
Write-Host ""

# Iniciar o servidor
Set-Location frontend
npm start 