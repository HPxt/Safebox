# Agent 4: Especialista em Segurança

## Responsabilidades Principais

- **WebCrypto API**: Implementação de criptografia client-side com AES-256-GCM
- **Derivação de Chaves**: Argon2id para derivação segura de chaves mestras
- **Arquitetura Zero-Knowledge**: Garantir que dados sensíveis nunca deixem o cliente
- **Gerenciamento Seguro**: Handling de chaves, salts, IVs de forma segura
- **Validação de Integridade**: Verificação de dados criptografados
- **Auditoria de Segurança**: Logs de acesso, tentativas de descriptografia
- **Resistência a Ataques**: Proteção contra timing attacks, side-channel attacks

## Arquitetura de Segurança

### Fluxo Zero-Knowledge
```
Master Password → Argon2id → Master Key → AES-256-GCM → Encrypted Blob → Supabase
    ↓                ↓            ↓             ↓
Salt (random)    Key Derivation  Data + IV    Server Storage
                                              (nunca vê plaintext)
```

## Implementação WebCrypto

### Core Crypto Service

```typescript
// src/services/cryptoService.ts
import { hash } from '@noble/hashes/argon2id'
import { randomBytes } from '@noble/hashes/utils'

export interface EncryptedData {
  data: string // base64 encoded encrypted data
  iv: string   // base64 encoded initialization vector
  salt: string // base64 encoded salt
  iterations: number
  keyLength: number
}

export interface Credential {
  id: string
  title: string
  username: string
  password: string
  url?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

class CryptoService {
  private static readonly ALGORITHM = 'AES-GCM'
  private static readonly KEY_LENGTH = 256
  private static readonly IV_LENGTH = 12
  private static readonly SALT_LENGTH = 32
  private static readonly ARGON2_ITERATIONS = 100000 // ~100ms on modern devices
  private static readonly ARGON2_MEMORY = 64 * 1024 // 64MB
  private static readonly ARGON2_THREADS = 1

  /**
   * Deriva uma chave mestra usando Argon2id
   */
  async deriveMasterKey(
    masterPassword: string, 
    salt?: Uint8Array
  ): Promise<{ key: CryptoKey; salt: Uint8Array }> {
    try {
      const saltBytes = salt || randomBytes(CryptoService.SALT_LENGTH)
      
      // Deriva chave usando Argon2id
      const keyMaterial = hash(
        new TextEncoder().encode(masterPassword),
        saltBytes,
        {
          t: CryptoService.ARGON2_ITERATIONS,
          m: CryptoService.ARGON2_MEMORY,
          p: CryptoService.ARGON2_THREADS,
          dkLen: 32, // 256 bits
        }
      )

      // Importa para WebCrypto
      const key = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: CryptoService.ALGORITHM },
        false, // não exportável
        ['encrypt', 'decrypt']
      )

      return { key, salt: saltBytes }
    } catch (error) {
      throw new Error(`Erro na derivação da chave: ${error}`)
    }
  }

  /**
   * Criptografa dados usando AES-256-GCM
   */
  async encryptData(data: string, masterKey: CryptoKey): Promise<EncryptedData> {
    try {
      const encoder = new TextEncoder()
      const iv = crypto.getRandomValues(new Uint8Array(CryptoService.IV_LENGTH))
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: CryptoService.ALGORITHM,
          iv: iv,
        },
        masterKey,
        encoder.encode(data)
      )

      return {
        data: this.arrayBufferToBase64(encryptedData),
        iv: this.arrayBufferToBase64(iv),
        salt: '', // será preenchido pelo chamador
        iterations: CryptoService.ARGON2_ITERATIONS,
        keyLength: CryptoService.KEY_LENGTH,
      }
    } catch (error) {
      throw new Error(`Erro na criptografia: ${error}`)
    }
  }

  /**
   * Descriptografa dados usando AES-256-GCM  
   */
  async decryptData(encryptedData: EncryptedData, masterKey: CryptoKey): Promise<string> {
    try {
      const data = this.base64ToArrayBuffer(encryptedData.data)
      const iv = this.base64ToArrayBuffer(encryptedData.iv)

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: CryptoService.ALGORITHM,  
          iv: iv,
        },
        masterKey,
        data
      )

      return new TextDecoder().decode(decryptedData)
    } catch (error) {
      throw new Error(`Erro na descriptografia: ${error}`)
    }
  }

  /**
   * Criptografa múltiplas credenciais
   */
  async encryptCredentials(
    credentials: Credential[], 
    masterPassword: string,
    existingSalt?: string
  ): Promise<EncryptedData> {
    try {
      const salt = existingSalt 
        ? this.base64ToArrayBuffer(existingSalt)
        : undefined

      const { key, salt: derivedSalt } = await this.deriveMasterKey(masterPassword, salt)
      
      const jsonData = JSON.stringify(credentials)
      const encrypted = await this.encryptData(jsonData, key)
      
      return {
        ...encrypted,
        salt: this.arrayBufferToBase64(derivedSalt)
      }
    } catch (error) {
      throw new Error(`Erro ao criptografar credenciais: ${error}`)
    }
  }

  /**
   * Descriptografa múltiplas credenciais
   */
  async decryptCredentials(
    encryptedData: EncryptedData, 
    masterPassword: string
  ): Promise<Credential[]> {
    try {
      const salt = this.base64ToArrayBuffer(encryptedData.salt)
      const { key } = await this.deriveMasterKey(masterPassword, salt)
      
      const decryptedJson = await this.decryptData(encryptedData, key)
      const credentials = JSON.parse(decryptedJson) as Credential[]
      
      // Validação básica da estrutura
      if (!Array.isArray(credentials)) {
        throw new Error('Dados descriptografados inválidos')
      }

      return credentials.map(cred => ({
        ...cred,
        createdAt: new Date(cred.createdAt),
        updatedAt: new Date(cred.updatedAt)
      }))
    } catch (error) {
      throw new Error(`Erro ao descriptografar credenciais: ${error}`)
    }
  }

  /**
   * Verifica se uma senha mestra está correta
   */
  async verifyMasterPassword(
    masterPassword: string, 
    encryptedData: EncryptedData
  ): Promise<boolean> {
    try {
      await this.decryptCredentials(encryptedData, masterPassword)
      return true
    } catch {
      return false
    }
  }

  /**
   * Gera hash seguro para verificação de integridade
   */
  async generateIntegrityHash(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return this.arrayBufferToBase64(hashBuffer)
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
}

export const cryptoService = new CryptoService()
```

### Secure Storage Service

```typescript
// src/services/secureStorageService.ts
import { cryptoService, EncryptedData } from './cryptoService'

interface SecureSession {
  isUnlocked: boolean
  masterKey?: CryptoKey
  expiresAt: number
  lastActivity: number
}

class SecureStorageService {
  private static readonly SESSION_TIMEOUT = 15 * 60 * 1000 // 15 minutos
  private static readonly ACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutos
  private session: SecureSession | null = null

  /**
   * Desbloqueia o cofre com a senha mestra
   */
  async unlockVault(masterPassword: string, encryptedData?: EncryptedData): Promise<boolean> {
    try {
      if (encryptedData) {
        // Verifica senha usando dados existentes
        const isValid = await cryptoService.verifyMasterPassword(masterPassword, encryptedData)
        if (!isValid) return false

        const salt = cryptoService['base64ToArrayBuffer'](encryptedData.salt)
        const { key } = await cryptoService.deriveMasterKey(masterPassword, salt)
        
        this.session = {
          isUnlocked: true,
          masterKey: key,
          expiresAt: Date.now() + SecureStorageService.SESSION_TIMEOUT,
          lastActivity: Date.now()
        }
      } else {
        // Primeira vez - cria nova chave
        const { key } = await cryptoService.deriveMasterKey(masterPassword)
        
        this.session = {
          isUnlocked: true,
          masterKey: key,
          expiresAt: Date.now() + SecureStorageService.SESSION_TIMEOUT,
          lastActivity: Date.now()
        }
      }

      return true
    } catch (error) {
      console.error('Erro ao desbloquear cofre:', error)
      return false
    }
  }

  /**
   * Bloqueia o cofre e limpa dados sensíveis
   */
  lockVault(): void {
    if (this.session?.masterKey) {
      // WebCrypto keys são automaticamente limpos pelo GC
      // mas podemos forçar a remoção da referência
      this.session.masterKey = undefined
    }
    
    this.session = null
    
    // Force garbage collection se disponível (desenvolvimento)
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc()
    }
  }

  /**
   * Verifica se o cofre está desbloqueado
   */
  isVaultUnlocked(): boolean {
    if (!this.session?.isUnlocked) return false

    const now = Date.now()
    
    // Verifica timeout de sessão
    if (now > this.session.expiresAt) {
      this.lockVault()
      return false
    }

    // Verifica timeout de inatividade
    if (now - this.session.lastActivity > SecureStorageService.ACTIVITY_TIMEOUT) {
      this.lockVault()
      return false
    }

    return true
  }

  /**
   * Atualiza atividade da sessão
   */
  updateActivity(): void {
    if (this.session?.isUnlocked) {
      this.session.lastActivity = Date.now()
      this.session.expiresAt = Date.now() + SecureStorageService.SESSION_TIMEOUT
    }
  }

  /**
   * Obtém a chave mestra da sessão atual
   */
  getMasterKey(): CryptoKey | null {
    if (!this.isVaultUnlocked()) return null
    this.updateActivity()
    return this.session!.masterKey || null
  }

  /**
   * Verifica força da senha mestra
   */
  validateMasterPasswordStrength(password: string): {
    score: number
    feedback: string[]
    isValid: boolean
  } {
    const feedback: string[] = []
    let score = 0

    if (password.length < 12) {
      feedback.push('Use pelo menos 12 caracteres')
    } else {
      score += 1
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Inclua letras minúsculas')
    } else {
      score += 1
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Inclua letras maiúsculas')
    } else {
      score += 1
    }

    if (!/\d/.test(password)) {
      feedback.push('Inclua números')
    } else {
      score += 1
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      feedback.push('Inclua símbolos especiais')
    } else {
      score += 1
    }

    // Verifica padrões comuns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /(.)\1{2,}/, // caracteres repetidos
    ]

    if (commonPatterns.some(pattern => pattern.test(password))) {
      feedback.push('Evite padrões comuns ou repetições')
      score = Math.max(0, score - 1)
    }

    return {
      score,
      feedback,
      isValid: score >= 4 && password.length >= 12
    }
  }
}

export const secureStorageService = new SecureStorageService()
```

### Password Generator

```typescript
// src/services/passwordGeneratorService.ts
interface GeneratorOptions {
  length: number
  includeLowercase: boolean
  includeUppercase: boolean
  includeNumbers: boolean
  includeSymbols: boolean
  excludeAmbiguous: boolean
  minNumbers?: number
  minSymbols?: number
}

class PasswordGeneratorService {
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
  private static readonly UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  private static readonly NUMBERS = '0123456789'
  private static readonly SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  private static readonly AMBIGUOUS = 'il1Lo0O'

  /**
   * Gera senha segura usando crypto.getRandomValues
   */
  generatePassword(options: GeneratorOptions): string {
    let charset = ''
    
    if (options.includeLowercase) {
      charset += options.excludeAmbiguous 
        ? this.removeAmbiguous(PasswordGeneratorService.LOWERCASE)
        : PasswordGeneratorService.LOWERCASE
    }
    
    if (options.includeUppercase) {
      charset += options.excludeAmbiguous
        ? this.removeAmbiguous(PasswordGeneratorService.UPPERCASE)
        : PasswordGeneratorService.UPPERCASE
    }
    
    if (options.includeNumbers) {
      charset += options.excludeAmbiguous
        ? this.removeAmbiguous(PasswordGeneratorService.NUMBERS)
        : PasswordGeneratorService.NUMBERS
    }
    
    if (options.includeSymbols) {
      charset += PasswordGeneratorService.SYMBOLS
    }

    if (charset.length === 0) {
      throw new Error('Pelo menos um tipo de caractere deve ser selecionado')
    }

    // Gera senha inicial
    let password = ''
    const randomValues = new Uint32Array(options.length)
    crypto.getRandomValues(randomValues)

    for (let i = 0; i < options.length; i++) {
      const randomIndex = randomValues[i] % charset.length
      password += charset[randomIndex]
    }

    // Garante requisitos mínimos
    password = this.ensureRequirements(password, options, charset)

    return password
  }

  /**
   * Calcula entropia da senha
   */
  calculateEntropy(password: string): number {
    const charsets = [
      { chars: PasswordGeneratorService.LOWERCASE, name: 'lowercase' },
      { chars: PasswordGeneratorService.UPPERCASE, name: 'uppercase' },
      { chars: PasswordGeneratorService.NUMBERS, name: 'numbers' },
      { chars: PasswordGeneratorService.SYMBOLS, name: 'symbols' },
    ]

    let poolSize = 0
    
    for (const charset of charsets) {
      if (charset.chars.split('').some(char => password.includes(char))) {
        poolSize += charset.chars.length
      }
    }

    return Math.log2(Math.pow(poolSize, password.length))
  }

  /**
   * Avalia força da senha
   */
  evaluateStrength(password: string): {
    score: number
    entropy: number
    timeToCrack: string
    feedback: string[]
  } {
    const entropy = this.calculateEntropy(password)
    const feedback: string[] = []
    let score = 0

    // Avaliação baseada na entropia
    if (entropy < 30) {
      score = 1
      feedback.push('Senha muito fraca - fácil de quebrar')
    } else if (entropy < 50) {
      score = 2
      feedback.push('Senha fraca - pode ser quebrada rapidamente')
    } else if (entropy < 70) {
      score = 3
      feedback.push('Senha média - oferece proteção básica')
    } else if (entropy < 90) {
      score = 4
      feedback.push('Senha forte - boa proteção')
    } else {
      score = 5
      feedback.push('Senha muito forte - excelente proteção')
    }

    // Cálculo tempo para quebrar (aproximação)
    const attemptsPerSecond = 1e9 // 1 bilhão de tentativas/segundo
    const totalCombinations = Math.pow(2, entropy)
    const secondsToCrack = totalCombinations / (2 * attemptsPerSecond)
    
    const timeToCrack = this.formatTime(secondsToCrack)

    return { score, entropy, timeToCrack, feedback }
  }

  private removeAmbiguous(charset: string): string {
    return charset.split('').filter(char => 
      !PasswordGeneratorService.AMBIGUOUS.includes(char)
    ).join('')
  }

  private ensureRequirements(
    password: string, 
    options: GeneratorOptions, 
    charset: string
  ): string {
    let result = password.split('')
    
    // Garante números mínimos se especificado
    if (options.minNumbers && options.includeNumbers) {
      const numberCount = result.filter(char => 
        PasswordGeneratorService.NUMBERS.includes(char)
      ).length
      
      if (numberCount < options.minNumbers) {
        const needed = options.minNumbers - numberCount
        for (let i = 0; i < needed; i++) {
          const randomIndex = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] % result.length)
          const randomNumber = PasswordGeneratorService.NUMBERS[
            Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] % PasswordGeneratorService.NUMBERS.length)
          ]
          result[randomIndex] = randomNumber
        }
      }
    }

    return result.join('')
  }

  private formatTime(seconds: number): string {
    if (seconds < 1) return 'Instantâneo'
    if (seconds < 60) return `${Math.round(seconds)} segundos`
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutos`
    if (seconds < 86400) return `${Math.round(seconds / 3600)} horas`
    if (seconds < 31536000) return `${Math.round(seconds / 86400)} dias`
    if (seconds < 31536000000) return `${Math.round(seconds / 31536000)} anos`
    return 'Mais de 1000 anos'
  }
}

export const passwordGeneratorService = new PasswordGeneratorService()
```

## Security Context

```typitten
// src/contexts/SecurityContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import { secureStorageService } from '@/services/secureStorageService'

interface SecurityContextType {
  isVaultUnlocked: boolean
  unlockVault: (password: string, encryptedData?: any) => Promise<boolean>
  lockVault: () => void
  updateActivity: () => void
  sessionTimeRemaining: number
}

const SecurityContext = createContext<SecurityContextType | null>(null)

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false)
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0)

  const unlockVault = async (password: string, encryptedData?: any) => {
    const success = await secureStorageService.unlockVault(password, encryptedData)
    setIsVaultUnlocked(success)
    return success
  }

  const lockVault = () => {
    secureStorageService.lockVault()
    setIsVaultUnlocked(false)
  }

  const updateActivity = () => {
    secureStorageService.updateActivity()
  }

  // Monitor de sessão
  useEffect(() => {
    const interval = setInterval(() => {
      const isUnlocked = secureStorageService.isVaultUnlocked()
      
      if (isUnlocked !== isVaultUnlocked) {
        setIsVaultUnlocked(isUnlocked)
      }

      // Calcular tempo restante (implementação simplificada)
      setSessionTimeRemaining(isUnlocked ? 900 : 0) // 15 min
    }, 1000)

    return () => clearInterval(interval)
  }, [isVaultUnlocked])

  // Lock automático quando a aba perde foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Opcional: lock imediato quando aba é escondida
        // lockVault()
      } else {
        updateActivity()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <SecurityContext.Provider value={{
      isVaultUnlocked,
      unlockVault,
      lockVault,
      updateActivity,
      sessionTimeRemaining
    }}>
      {children}
    </SecurityContext.Provider>
  )
}

export const useSecurity = () => {
  const context = useContext(SecurityContext)
  if (!context) {
    throw new Error('useSecurity deve ser usado dentro de SecurityProvider')
  }
  return context
}
```

## Auditoria e Logging

```typescript
// src/services/securityAuditService.ts
interface SecurityEvent {
  id: string
  type: 'vault_unlock' | 'vault_lock' | 'decrypt_success' | 'decrypt_failure' | 'session_timeout'
  timestamp: Date
  userAgent: string
  ipAddress?: string
  details?: Record<string, any>
}

class SecurityAuditService {
  private events: SecurityEvent[] = []
  private maxEvents = 100

  logEvent(type: SecurityEvent['type'], details?: Record<string, any>) {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      details
    }

    this.events.unshift(event)
    
    // Manter apenas os últimos eventos
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents)
    }

    // Persist em localStorage (apenas metadados, sem dados sensíveis)
    this.persistAuditLog()
  }

  getAuditLog(): SecurityEvent[] {
    return [...this.events]
  }

  clearAuditLog() {
    this.events = []
    localStorage.removeItem('safebox_audit_log')
  }

  private persistAuditLog() {
    try {
      const sanitizedEvents = this.events.map(event => ({
        ...event,
        details: undefined // Remove detalhes sensíveis
      }))
      
      localStorage.setItem('safebox_audit_log', JSON.stringify(sanitizedEvents))
    } catch (error) {
      console.warn('Falha ao persistir log de auditoria:', error)
    }
  }

  private loadAuditLog() {
    try {
      const stored = localStorage.getItem('safebox_audit_log')
      if (stored) {
        this.events = JSON.parse(stored).map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }))
      }
    } catch (error) {
      console.warn('Falha ao carregar log de auditoria:', error)
    }
  }

  constructor() {
    this.loadAuditLog()
  }
}

export const securityAuditService = new SecurityAuditService()
```

## Checklist de Responsabilidades

### Criptografia ✅
- [ ] WebCrypto API implementada com AES-256-GCM
- [ ] Argon2id para derivação de chaves
- [ ] IVs únicos para cada operação
- [ ] Verificação de integridade implementada

### Arquitetura Zero-Knowledge ✅
- [ ] Dados sensíveis nunca saem do cliente
- [ ] Servidor armazena apenas blobs criptografados
- [ ] Chaves mestras nunca transmitidas
- [ ] Descriptografia apenas client-side

### Gerenciamento de Sessão ✅
- [ ] Timeouts de sessão configuráveis
- [ ] Lock automático por inatividade
- [ ] Limpeza segura de memória
- [ ] Monitoramento de visibilidade da aba

### Validação e Auditoria ✅
- [ ] Validação de força de senhas
- [ ] Log de eventos de segurança
- [ ] Detecção de tentativas suspeitas
- [ ] Métricas de entropia implementadas

### Resistência a Ataques ✅
- [ ] Proteção contra timing attacks
- [ ] Geração criptograficamente segura
- [ ] Sanitização de dados sensíveis
- [ ] Prevenção de side-channel attacks 