import { argon2id } from 'hash-wasm'

// Configuração fixa do Argon2id - removida detecção de dispositivo
const ARGON2_CONFIG = {
  LOW: {
    memorySize: 64 * 1024,  // 64 MB
    iterations: 3,
    parallelism: 4,
    hashLength: 32,
    saltLength: 32  // 256 bits de salt
  }
};

// Configurações do PBKDF2 (similar ao Bitwarden)
const PBKDF2_CONFIG = {
  iterations: 100000,   // 100k iterações para pré-hash
  hashAlgorithm: 'SHA-256'
}

// Tamanhos para AES-GCM
const NONCE_SIZE = 12 // 96 bits para GCM
const TAG_SIZE = 16   // 128 bits

export class CryptoService {
  // Armazenamento seguro em memória (não acessível via DevTools)
  private static encryptionKey: CryptoKey | null = null;
  private static keyTimeout: NodeJS.Timeout | null = null;
  private static readonly KEY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora

  /**
   * Armazenamento seguro de chaves criptográficas
   * ⚠️ CORREÇÃO: Não usar localStorage para chaves sensíveis
   */
  private static keyStore: Map<string, { key: CryptoKey; timestamp: number }> = new Map()
  private static readonly KEY_EXPIRY_TIME = 60 * 60 * 1000 // 1 hora de ociosidade
  
  // Controle de atividade do usuário
  private static lastActivityTime: number = Date.now()
  private static activityListenersSetup: boolean = false

  private static generateStorageKey(userId?: string): string {
    const sessionId = this.getSessionId()
    return `crypto_key_${userId || 'default'}_${sessionId}`
  }

  // Testar se Web Crypto API está disponível
  static async testWebCrypto(): Promise<boolean> {
    try {
      // Testar geração de chave aleatória
      const testKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      )
      
      // Testar criptografia básica
      const testData = new TextEncoder().encode('test')
      const iv = new Uint8Array(12)
      crypto.getRandomValues(iv)
      
      await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        testKey,
        testData
      )
      
      return true
    } catch (error) {
      console.error('Web Crypto API test failed:', error)
      return false
    }
  }

  // Gerar salt aleatório
  static generateSalt(): string {
    const salt = new Uint8Array(ARGON2_CONFIG.LOW.saltLength)
    crypto.getRandomValues(salt)
    return btoa(String.fromCharCode(...Array.from(salt)))
  }

  // Gerar nonce aleatório para AES-GCM
  static generateNonce(): string {
    const nonce = new Uint8Array(NONCE_SIZE)
    crypto.getRandomValues(nonce)
    return btoa(String.fromCharCode(...Array.from(nonce)))
  }

  // Rate limiting para derivação de chave (evita ataques de força bruta)
  static getFailedAttempts(userId?: string): number {
    const key = `safebox_failed_attempts_${userId || 'anonymous'}`
    const stored = localStorage.getItem(key)
    if (!stored) return 0
    
    const data = JSON.parse(stored)
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    // Limpar tentativas antigas (mais de 1 hora)
    if (now - data.timestamp > oneHour) {
      localStorage.removeItem(key)
      return 0
    }
    
    return data.attempts || 0
  }

  static recordFailedAttempt(userId?: string): void {
    const key = `safebox_failed_attempts_${userId || 'anonymous'}`
    const attempts = this.getFailedAttempts(userId) + 1
    
    localStorage.setItem(key, JSON.stringify({
      attempts,
      timestamp: Date.now()
    }))
  }

  static clearFailedAttempts(userId?: string): void {
    const key = `safebox_failed_attempts_${userId || 'anonymous'}`
    localStorage.removeItem(key)
  }

  // Derivar chave com rate limiting
  static async deriveKeyWithRateLimit(
    password: string, 
    salt: string, 
    params?: any,
    userId?: string
  ): Promise<CryptoKey> {
    const attempts = this.getFailedAttempts(userId)
    
    // Aplicar delay progressivo baseado nas tentativas
    if (attempts > 0) {
      const delay = Math.min(attempts * 2000, 30000) // Máximo 30 segundos
      console.log(`⏳ Rate limiting ativo: aguardando ${delay/1000}s devido a ${attempts} tentativas falhadas`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    // Avisar sobre muitas tentativas
    if (attempts >= 5) {
      console.warn(`🚨 MUITAS TENTATIVAS FALHADAS (${attempts}). Sistema pode estar sob ataque!`)
    }
    
    try {
      const key = await this.deriveKey(password, salt, params)
      
      // Se chegou até aqui, a derivação foi bem-sucedida
      // Limpar contador de tentativas falhadas
      this.clearFailedAttempts(userId)
      
      return key
    } catch (error) {
      // Registrar tentativa falhada
      this.recordFailedAttempt(userId)
      throw error
    }
  }

  // Derivar chave com indicador de progresso para melhor UX
  static async deriveKeyWithProgress(
    password: string, 
    salt: string, 
    params?: any,
    onProgress?: (progress: number, message: string) => void
  ): Promise<CryptoKey> {
    const config = { ...ARGON2_CONFIG.LOW, ...params }
    
    // Converter salt de base64 para Uint8Array
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0))
    
    if (onProgress) {
      onProgress(10, 'Iniciando derivação de chave...')
    }
    
    try {
      // Passo 1: Usar PBKDF2 para criar uma chave inicial
      const encoder = new TextEncoder()
      const passwordBytes = encoder.encode(password)
      
      if (onProgress) {
        onProgress(25, 'Executando PBKDF2...')
      }
      
      // Importar senha como chave para PBKDF2
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      )
      
      // Derivar bits com PBKDF2
      const pbkdf2Bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes.slice(0, 16),
          iterations: PBKDF2_CONFIG.iterations,
          hash: PBKDF2_CONFIG.hashAlgorithm
        },
        passwordKey,
        256
      )
      
      if (onProgress) {
        onProgress(50, 'PBKDF2 concluído, iniciando Argon2id...')
      }
      
      // Passo 2: Usar o resultado do PBKDF2 como entrada para Argon2id
      const pbkdf2Result = new Uint8Array(pbkdf2Bits)
      const combinedPassword = btoa(String.fromCharCode(...Array.from(pbkdf2Result))) + password
      
      if (onProgress) {
        onProgress(75, `Processando Argon2id (${config.memorySize/1024}MB, ${config.iterations} iterações)...`)
      }
      
      // Derivar chave final com Argon2id
      const hashResult = await argon2id({
        password: combinedPassword,
        salt: saltBytes,
        parallelism: config.parallelism,
        iterations: config.iterations,
        memorySize: config.memorySize,
        hashLength: config.hashLength,
        outputType: 'binary'
      })

      if (onProgress) {
        onProgress(90, 'Importando chave criptográfica...')
      }

      // Garantir que temos uma Uint8Array de 32 bytes
      if (!(hashResult instanceof Uint8Array) || hashResult.length !== 32) {
        throw new Error(`Hash result inválido: esperado Uint8Array de 32 bytes, recebido ${typeof hashResult} de ${hashResult.length} bytes`)
      }

      // Importar a chave derivada para uso com Web Crypto API
      const key = await crypto.subtle.importKey(
        'raw',
        hashResult,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      )
      
      if (onProgress) {
        onProgress(100, 'Chave derivada com sucesso!')
      }
      
      return key
      
    } catch (error: any) {
      if (onProgress) {
        onProgress(0, `Erro na derivação: ${error.message}`)
      }
      throw error
    }
  }

  // Derivar chave da senha-mestra usando abordagem híbrida
  static async deriveKey(
    password: string, 
    salt: string, 
    params?: any
  ): Promise<CryptoKey> {
    // Se params for passado, usar diretamente. Senão, usar configuração LOW
    const config = params ? { ...ARGON2_CONFIG.LOW, ...params } : this.getArgon2ConfigForDevice()
    
    // Converter salt de base64 para Uint8Array
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0))
    
    // Removido console.log por segurança - informações sensíveis
    
    try {
      // Passo 1: Usar PBKDF2 para criar uma chave inicial (compatível com Web Crypto)
      const encoder = new TextEncoder()
      const passwordBytes = encoder.encode(password)
      
      // Importar senha como chave para PBKDF2
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      )
      
      // Derivar bits com PBKDF2
      const pbkdf2Bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes.slice(0, 16), // Usar primeiros 16 bytes do salt
          iterations: PBKDF2_CONFIG.iterations,
          hash: PBKDF2_CONFIG.hashAlgorithm
        },
        passwordKey,
        256 // 32 bytes
      )
      
      // Passo 2: Usar o resultado do PBKDF2 como entrada para Argon2id
      const pbkdf2Result = new Uint8Array(pbkdf2Bits)
      const combinedPassword = btoa(String.fromCharCode(...Array.from(pbkdf2Result))) + password

      // Derivar chave final com Argon2id
      const hashResult = await argon2id({
        password: combinedPassword,
        salt: saltBytes,
        parallelism: config.parallelism,
        iterations: config.iterations,
        memorySize: config.memorySize,
        hashLength: config.hashLength,
        outputType: 'binary'
      })

      // Garantir que temos uma Uint8Array de 32 bytes
      if (!(hashResult instanceof Uint8Array) || hashResult.length !== 32) {
        throw new Error(`Hash result inválido: esperado Uint8Array de 32 bytes, recebido ${typeof hashResult} de ${hashResult.length} bytes`)
      }

      // Importar a chave derivada para uso com Web Crypto API
      const key = await crypto.subtle.importKey(
        'raw',
        hashResult,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
      )
      
      // Logs de timing removidos em produção
      
      return key
      
    } catch (error: any) {
      console.error('Erro na derivação de chave:', error)
      throw error
    }
  }

  // Criptografar dados com AES-GCM
  static async encrypt(
    data: string, 
    key: CryptoKey, 
    nonce?: string
  ): Promise<{ encrypted: string; nonce: string }> {
    // Gerar nonce se não fornecido
    const nonceToUse = nonce || this.generateNonce()
    const nonceBytes = Uint8Array.from(atob(nonceToUse), c => c.charCodeAt(0))
    
    // Converter dados para ArrayBuffer
    const encoder = new TextEncoder()
    const dataBytes = encoder.encode(data)
    
    // Criptografar
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonceBytes,
        tagLength: TAG_SIZE * 8
      },
      key,
      dataBytes
    )
    
    // Converter para base64
    const encryptedArray = new Uint8Array(encryptedBuffer)
    const encrypted = btoa(String.fromCharCode(...Array.from(encryptedArray)))
    
    return { encrypted, nonce: nonceToUse }
  }

  // Descriptografar dados com AES-GCM
  static async decrypt(
    encryptedData: string, 
    key: CryptoKey, 
    nonce: string
  ): Promise<string> {
    // Converter de base64 para ArrayBuffer
    const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
    const nonceBytes = Uint8Array.from(atob(nonce), c => c.charCodeAt(0))
    
    // Descriptografar
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceBytes,
        tagLength: TAG_SIZE * 8
      },
      key,
      encryptedBytes
    )
    
    // Converter para string
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  }

  /**
   * Gerar ID de sessão único e seguro
   */
  private static getSessionId(): string {
    // Usar sessionStorage apenas para ID de sessão (não sensível)
    let sessionId = sessionStorage.getItem('safebox_session_id')
    if (!sessionId) {
      sessionId = this.generateSecureId()
      sessionStorage.setItem('safebox_session_id', sessionId)
    }
    return sessionId
  }

  /**
   * Gerar ID seguro
   */
  private static generateSecureId(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Armazenar chave de forma segura (apenas em memória)
   * ⚠️ SEGURANÇA: Nunca armazenar chaves em localStorage/sessionStorage
   */
  static async storeKey(key: CryptoKey, userId?: string): Promise<void> {
    try {
      const storageKey = this.generateStorageKey(userId)
      
      // Armazenar apenas em memória com expiração
      this.keyStore.set(storageKey, {
        key,
        timestamp: Date.now()
      })

      // Registrar atividade ao armazenar chave
      this.recordActivity()
      
      // Configurar listeners de atividade se ainda não configurados
      this.setupActivityListeners()

      // Limpar chaves expiradas periodicamente
      this.cleanupExpiredKeys()
      
      console.log('🔐 Chave armazenada com sucesso. Expira após 1h de inatividade.')
      
    } catch (error) {
      console.error('Erro ao armazenar chave:', error)
      throw new Error('Failed to store cryptographic key securely')
    }
  }

  /**
   * Registrar atividade do usuário (chamado quando há interação)
   */
  static recordActivity(): void {
    this.lastActivityTime = Date.now()
  }

  /**
   * Configurar listeners de atividade (deve ser chamado uma vez na inicialização)
   */
  static setupActivityListeners(): void {
    if (this.activityListenersSetup || typeof window === 'undefined') {
      return
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      this.recordActivity()
    }

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    this.activityListenersSetup = true
    console.log('🔐 Activity listeners configurados para controle de sessão')
  }

  /**
   * Verificar se a chave expirou por ociosidade real do usuário
   */
  private static hasExpiredByInactivity(): boolean {
    const timeSinceLastActivity = Date.now() - this.lastActivityTime
    return timeSinceLastActivity > this.KEY_EXPIRY_TIME
  }

  /**
   * Recuperar chave armazenada
   */
  static async getStoredKey(userId?: string): Promise<CryptoKey | null> {
    try {
      const storageKey = this.generateStorageKey(userId)
      const stored = this.keyStore.get(storageKey)

      if (!stored) {
        return null
      }

      // Verificar se expirou por OCIOSIDADE REAL do usuário (não apenas tempo desde armazenamento)
      if (this.hasExpiredByInactivity()) {
        console.warn('🔒 Chave criptográfica expirou por 1 hora de inatividade')
        this.keyStore.delete(storageKey)
        return null
      }

      // Chave ainda válida - não precisa atualizar timestamp aqui
      // O timestamp de atividade é atualizado pelos listeners

      return stored.key
    } catch (error) {
      console.error('Erro ao recuperar chave:', error)
      return null
    }
  }

  /**
   * Obter tempo restante até expiração (em minutos)
   */
  static getTimeUntilExpiry(): number {
    const timeSinceLastActivity = Date.now() - this.lastActivityTime
    const remainingMs = this.KEY_EXPIRY_TIME - timeSinceLastActivity
    return Math.max(0, Math.floor(remainingMs / 60000))
  }

  /**
   * Verificar se há chave válida sem buscá-la
   */
  static hasValidKey(userId?: string): boolean {
    const storageKey = this.generateStorageKey(userId)
    const stored = this.keyStore.get(storageKey)
    
    if (!stored) return false
    if (this.hasExpiredByInactivity()) return false
    
    return true
  }

  /**
   * Limpar chave armazenada
   * Nota: NÃO limpa o sessionId para evitar problemas de dessincronização
   */
  static clearStoredKey(userId?: string): void {
    const storageKey = this.generateStorageKey(userId)
    this.keyStore.delete(storageKey)
    // NÃO limpar sessionId aqui - isso causava problemas ao trocar de aba
    // O sessionId só deve ser limpo no clearAllKeys (logout completo)
  }

  /**
   * Limpar chaves expiradas (baseado em ociosidade real)
   */
  private static cleanupExpiredKeys(): void {
    // Se o usuário estiver inativo por mais de 1 hora, limpar todas as chaves
    if (this.hasExpiredByInactivity()) {
      console.log('🧹 Limpando chaves expiradas por inatividade')
      this.keyStore.clear()
    }
  }

  /**
   * Limpar todas as chaves (logout/segurança)
   */
  static clearAllKeys(): void {
    this.keyStore.clear()
    sessionStorage.removeItem('safebox_session_id')
  }

  // Criar hash da chave para verificação
  static async hashKey(key: CryptoKey): Promise<string> {
    try {
      // Exportar a chave
      const keyData = await crypto.subtle.exportKey('raw', key)
      
      // Criar hash SHA-256 da chave
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
      
      // Converter para base64
      const hashArray = new Uint8Array(hashBuffer)
      return btoa(String.fromCharCode(...Array.from(hashArray)))
    } catch (error) {
      console.error('Erro ao criar hash da chave:', error)
      throw error
    }
  }

  // Lista de senhas mais comuns para bloquear
  static readonly BLOCKED_PASSWORDS = [
    // Top senhas mais comuns
    '123456', '123456789', 'qwerty', 'password', 'abc123', '111111', '123123',
    '1234567890', '1234567', 'password123', '12345678', '12345', '1234', '123',
    'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'hello',
    'freedom', 'whatever', 'qazwsx', 'trustno1', 'adobe123', 'azerty', 'photoshop',
    // Padrões brasileiros
    'senha', 'senha123', '123senha', 'mudar123', 'brasil', 'admin123',
    '102030', '010203', '123321', '654321', '987654321',
    // Padrões de teclado
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx', '1q2w3e4r', '1q2w3e',
    // Anos comuns
    '2024', '2023', '2022', '2021', '2020', '1990', '1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '1999'
  ]

  // Padrões perigosos para detectar
  static readonly DANGEROUS_PATTERNS = [
    /^\d+$/,                    // Apenas números (123456789)
    /^[a-z]+$/,                 // Apenas letras minúsculas
    /^[A-Z]+$/,                 // Apenas letras maiúsculas
    /^(.)\1{4,}$/,              // Mesmo caractere repetido (11111, aaaaa)
    /^(012|123|234|345|456|567|678|789|890)+/,  // Sequências numéricas
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i, // Sequências alfabéticas
    /^(qwe|wer|ert|rty|tyu|yui|uio|iop|asd|sdf|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm)+/i, // Padrões de teclado
    /(\w)\1{2,}/,               // 3+ caracteres consecutivos iguais
    /^.{1,7}$/,                 // Muito curta (menos de 8)
  ]

  // Nova validação de força da senha - MUITO MAIS RIGOROSA
  static validatePasswordStrength(password: string): {
    isValid: boolean
    score: number
    feedback: string[]
    blocked: boolean
    blockReason?: string
  } {
    const feedback = []
    let score = 0
    let blocked = false
    let blockReason = ''

    // 🚫 VERIFICAÇÕES DE BLOQUEIO (IMPEDEM USO)
    
    // 1. Verificar senhas na lista negra
    if (this.BLOCKED_PASSWORDS.includes(password.toLowerCase())) {
      blocked = true
      blockReason = 'Esta senha está na lista das mais comuns e hackeadas. Use uma senha única.'
      return { isValid: false, score: 0, feedback: [blockReason], blocked, blockReason }
    }

    // 2. Verificar padrões perigosos
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(password)) {
        blocked = true
        blockReason = 'Senha contém padrão inseguro. Use combinação de letras, números e símbolos.'
        return { isValid: false, score: 0, feedback: [blockReason], blocked, blockReason }
      }
    }

    // 3. Verificar se contém parte do email (seria preciso passar email, por enquanto pular)
    
    // 4. Comprimento mínimo ABSOLUTO
    if (password.length < 12) {
      blocked = true
      blockReason = 'Senha deve ter pelo menos 12 caracteres para ser segura.'
      return { isValid: false, score: 0, feedback: [blockReason], blocked, blockReason }
    }

    // ✅ PONTUAÇÃO (Para senhas que passaram nos bloqueios)
    
    // Comprimento (0-4 pontos) - mais generoso para senhas longas
    if (password.length >= 20) {
      score += 4
    } else if (password.length >= 16) {
      score += 3
    } else if (password.length >= 14) {
      score += 2
      feedback.push('💡 Para máxima segurança, use 16+ caracteres')
    } else if (password.length >= 12) {
      score += 1
      feedback.push('⚠️ Considere usar 14+ caracteres')
    }

    // Letras minúsculas (1 ponto)
    if (/[a-z]/.test(password)) {
      score += 1
    } else {
      feedback.push('❌ Adicione letras minúsculas (a-z)')
    }

    // Letras maiúsculas (1 ponto)
    if (/[A-Z]/.test(password)) {
      score += 1
    } else {
      feedback.push('❌ Adicione letras maiúsculas (A-Z)')
    }

    // Números (1 ponto)
    if (/\d/.test(password)) {
      score += 1
    } else {
      feedback.push('❌ Adicione números (0-9)')
    }

    // Caracteres especiais (1-2 pontos) - mais rigoroso
    const specialChars = password.match(/[^a-zA-Z0-9]/g) || []
    const specialCount = specialChars.length
    if (specialCount >= 3) {
      score += 2
    } else if (specialCount >= 2) {
      score += 1
      feedback.push('💡 Use 3+ símbolos para pontuação máxima')
    } else if (specialCount === 1) {
      feedback.push('⚠️ Use pelo menos 2 símbolos (!@#$%^&*)')
    } else {
      feedback.push('❌ Adicione símbolos (!@#$%^&*)')
    }

    // Variedade de caracteres (0-2 pontos)
    const uniqueChars = new Set(password).size
    const varietyRatio = uniqueChars / password.length
    
    if (varietyRatio >= 0.8) {
      score += 2
    } else if (varietyRatio >= 0.6) {
      score += 1
      feedback.push('💡 Evite repetir caracteres para mais segurança')
    } else {
      feedback.push('⚠️ Use mais variedade - evite repetições')
    }

    // Bônus para passwords que misturam bem os tipos
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = specialCount > 0
    
    const typeCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
    if (typeCount === 4) {
      score += 1 // Bônus por usar todos os tipos
    }

    // Garantir que o score fique entre 0 e 10
    score = Math.max(0, Math.min(10, score))

    // Mensagens de encorajamento baseadas no score
    if (score >= 9) {
      feedback.unshift('🛡️ Excelente! Senha muito forte')
    } else if (score >= 7) {
      feedback.unshift('✅ Boa senha! Algumas melhorias possíveis:')
    } else if (score >= 5) {
      feedback.unshift('⚠️ Senha aceitável, mas pode melhorar:')
    } else {
      feedback.unshift('❌ Senha fraca. Precisa melhorar:')
    }

    // Critério mais rigoroso para aprovação
    const isValid = score >= 7 && !blocked

    return {
      isValid,
      score,
      feedback,
      blocked,
      blockReason
    }
  }

  // Obter configuração Argon2id (sempre LOW agora)
  static getArgon2ConfigForDevice(): typeof ARGON2_CONFIG.LOW {
    // Sempre retornar configuração LOW fixa
    return ARGON2_CONFIG.LOW;
  }

  // Função para obter configuração KDF (sempre retorna LOW)
  static getKdfConfig = () => {
    return {
      algorithm: 'argon2id' as const,
      iterations: ARGON2_CONFIG.LOW.iterations,
      memorySize: ARGON2_CONFIG.LOW.memorySize,
      parallelism: ARGON2_CONFIG.LOW.parallelism
    };
  };

  // Verificar se a senha mestre fornecida está correta
  // Compara derivando a chave e verificando se corresponde à chave armazenada
  static async verifyMasterPassword(password: string): Promise<boolean> {
    try {
      // Importar supabase dinamicamente para evitar dependência circular
      const { supabase } = await import('../config/supabase')
      
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('Usuário não autenticado')
        return false
      }

      // Buscar salt e params do usuário
      const { data: userData, error } = await supabase
        .from('users')
        .select('kdf_salt, kdf_params')
        .eq('id', user.id)
        .single()

      if (error || !userData?.kdf_salt) {
        console.error('Erro ao buscar dados KDF:', error)
        return false
      }

      // Derivar a chave com a senha fornecida
      const derivedKey = await this.deriveKey(
        password,
        userData.kdf_salt,
        userData.kdf_params
      )

      // Obter a chave armazenada na sessão
      const storedKey = await this.getStoredKey()
      if (!storedKey) {
        console.error('Nenhuma chave armazenada na sessão')
        return false
      }

      // Exportar ambas as chaves para comparação
      const derivedRaw = await crypto.subtle.exportKey('raw', derivedKey)
      const storedRaw = await crypto.subtle.exportKey('raw', storedKey)

      // Comparar as chaves
      const derivedArray = new Uint8Array(derivedRaw)
      const storedArray = new Uint8Array(storedRaw)

      if (derivedArray.length !== storedArray.length) {
        return false
      }

      // Comparação segura contra timing attacks
      let result = 0
      for (let i = 0; i < derivedArray.length; i++) {
        result |= derivedArray[i] ^ storedArray[i]
      }

      return result === 0
    } catch (error) {
      console.error('Erro ao verificar senha mestre:', error)
      return false
    }
  }
}

export default CryptoService 
