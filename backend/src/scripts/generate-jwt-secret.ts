import crypto from 'crypto'

function generateJWTSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64')
}

function generateSecureConfig() {
  const jwtSecret = generateJWTSecret()
  
  console.log('🔐 SafeBox - Configuração de Segurança Gerada')
  console.log('=' .repeat(50))
  console.log('')
  console.log('Copie esta linha para seu arquivo .env:')
  console.log('')
  console.log(`JWT_SECRET=${jwtSecret}`)
  console.log('')
  console.log('⚠️  IMPORTANTE: Mantenha esta chave em segurança!')
  console.log('   Não compartilhe e não commite no Git.')
  console.log('')
  console.log('✅ Chave gerada com sucesso!')
  console.log('=' .repeat(50))
}

// Run if called directly
if (require.main === module) {
  generateSecureConfig()
}

export { generateJWTSecret, generateSecureConfig } 