# SafeBox - Iniciar com Supabase Real
# Script para iniciar a aplicação com credenciais seguras

Write-Host "🔐 SafeBox - Configuração Segura" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Verificar se as variáveis já estão definidas
if (-not $env:REACT_APP_SUPABASE_URL -or -not $env:REACT_APP_SUPABASE_ANON_KEY) {
    Write-Host ""
    Write-Host "⚠️  Credenciais não encontradas nas variáveis de ambiente" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 Para configurar suas credenciais de forma segura:" -ForegroundColor Cyan
    Write-Host "1. Crie um arquivo .env na pasta frontend/ com:" -ForegroundColor White
    Write-Host "   REACT_APP_SUPABASE_URL=https://seu-projeto.supabase.co" -ForegroundColor Gray
    Write-Host "   REACT_APP_SUPABASE_ANON_KEY=sua_chave_anonima" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Ou defina as variáveis de ambiente:" -ForegroundColor White
    Write-Host "   `$env:REACT_APP_SUPABASE_URL = 'https://seu-projeto.supabase.co'" -ForegroundColor Gray
    Write-Host "   `$env:REACT_APP_SUPABASE_ANON_KEY = 'sua_chave_anonima'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📍 Onde encontrar suas credenciais:" -ForegroundColor Cyan
    Write-Host "   • Acesse https://supabase.com" -ForegroundColor White
    Write-Host "   • Vá no seu projeto > Settings > API" -ForegroundColor White
    Write-Host "   • Copie 'Project URL' e 'anon public key'" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Deseja continuar em modo de desenvolvimento? (Y/n)"
    if ($continue -eq "n" -or $continue -eq "N") {
        Write-Host "❌ Execução cancelada" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "🚧 Iniciando em modo de desenvolvimento..." -ForegroundColor Yellow
    $env:REACT_APP_SUPABASE_URL = "https://dev.supabase.co"
    $env:REACT_APP_SUPABASE_ANON_KEY = "dev-mode"
} else {
    Write-Host "✅ Credenciais encontradas nas variáveis de ambiente" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Iniciando aplicação..." -ForegroundColor Yellow

# Navegar para o diretório frontend e iniciar
Set-Location frontend
npm start 