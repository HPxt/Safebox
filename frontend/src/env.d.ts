/// <reference types="react-scripts" />

/**
 * Validação de variáveis de ambiente obrigatórias
 * ⚠️ SEGURANÇA: Nunca usar valores padrão para credenciais em produção
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // Variáveis obrigatórias do Supabase
    REACT_APP_SUPABASE_URL: string
    REACT_APP_SUPABASE_ANON_KEY: string
    REACT_APP_BACKEND_URL?: string
    
    // Configurações opcionais
    REACT_APP_VERSION?: string
    REACT_APP_ENVIRONMENT?: 'development' | 'staging' | 'production'
    
    // Configurações de segurança
    REACT_APP_ENABLE_DEBUG_LOGS?: string
    REACT_APP_CSP_NONCE?: string
    
    // URLs permitidas para CORS (separadas por vírgula)
    REACT_APP_ALLOWED_ORIGINS?: string
    
    // Configurações de monitoramento
    REACT_APP_SENTRY_DSN?: string
    REACT_APP_ANALYTICS_ID?: string
  }
}

/**
 * Validação em tempo de execução das variáveis obrigatórias
 */
const requiredEnvVars = [
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY'
] as const

// Verificar se todas as variáveis obrigatórias estão definidas
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
})

// Validações específicas para produção
if (process.env.NODE_ENV === 'production') {
  // Verificar se URLs não são localhost
  if (process.env.REACT_APP_SUPABASE_URL?.includes('localhost')) {
    throw new Error('Production cannot use localhost URLs')
  }
  
  // Verificar formato da chave anônima
  if (!process.env.REACT_APP_SUPABASE_ANON_KEY?.startsWith('eyJ')) {
    throw new Error('Invalid Supabase anon key format')
  }
} 
