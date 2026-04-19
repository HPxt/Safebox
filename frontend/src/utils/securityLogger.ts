/**
 * Sistema de logs seguro para produção
 * Remove informações sensíveis automaticamente
 */

interface LogLevel {
  DEBUG: 0
  INFO: 1
  WARN: 2
  ERROR: 3
  CRITICAL: 4
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
}

class SecurityLogger {
  private static instance: SecurityLogger
  private readonly isProduction = process.env.NODE_ENV === 'production'
  private readonly currentLogLevel = this.isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger()
    }
    return SecurityLogger.instance
  }

  /**
   * Sanitizar dados sensíveis antes de logar
   */
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Remover emails, tokens, senhas, etc.
      return data
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
        .replace(/Bearer\s+[A-Za-z0-9-._~+/]+=*/g, '[TOKEN_REDACTED]')
        .replace(/password['":\s]*['"'][^'"]+['"']/gi, 'password: "[REDACTED]"')
        .replace(/token['":\s]*['"'][^'"]+['"']/gi, 'token: "[REDACTED]"')
        .replace(/key['":\s]*['"'][^'"]+['"']/gi, 'key: "[REDACTED]"')
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {}
      
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase()
        
        // Campos sensíveis que devem ser redacted
        if (lowerKey.includes('password') || 
            lowerKey.includes('token') || 
            lowerKey.includes('key') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('email') ||
            lowerKey === 'id') {
          sanitized[key] = '[REDACTED]'
        } else {
          sanitized[key] = this.sanitizeData(value)
        }
      }
      
      return sanitized
    }

    return data
  }

  /**
   * Log de debug (apenas desenvolvimento)
   */
  debug(message: string, data?: any): void {
    if (this.currentLogLevel <= LOG_LEVELS.DEBUG) {
      const sanitizedData = data ? this.sanitizeData(data) : undefined
      console.log(`[DEBUG] ${message}`, sanitizedData)
    }
  }

  /**
   * Log de informação
   */
  info(message: string, data?: any): void {
    if (this.currentLogLevel <= LOG_LEVELS.INFO) {
      const sanitizedData = data ? this.sanitizeData(data) : undefined
      console.log(`[INFO] ${message}`, sanitizedData)
    }
  }

  /**
   * Log de aviso
   */
  warn(message: string, data?: any): void {
    if (this.currentLogLevel <= LOG_LEVELS.WARN) {
      const sanitizedData = data ? this.sanitizeData(data) : undefined
      console.warn(`[WARN] ${message}`, sanitizedData)
    }
  }

  /**
   * Log de erro
   */
  error(message: string, error?: any): void {
    if (this.currentLogLevel <= LOG_LEVELS.ERROR) {
      const sanitizedError = error ? this.sanitizeData(error) : undefined
      console.error(`[ERROR] ${message}`, sanitizedError)
      
      // Em produção, enviar para serviço de monitoramento
      if (this.isProduction) {
        this.sendToMonitoring('error', message, sanitizedError)
      }
    }
  }

  /**
   * Log crítico (sempre logado)
   */
  critical(message: string, error?: any): void {
    const sanitizedError = error ? this.sanitizeData(error) : undefined
    console.error(`[CRITICAL] ${message}`, sanitizedError)
    
    // Sempre enviar logs críticos para monitoramento
    this.sendToMonitoring('critical', message, sanitizedError)
  }

  /**
   * Log de evento de segurança
   */
  security(event: string, details?: any): void {
    const sanitizedDetails = details ? this.sanitizeData(details) : undefined
    const logMessage = `[SECURITY] ${event}`
    
    console.warn(logMessage, sanitizedDetails)
    
    // Sempre enviar eventos de segurança para monitoramento
    this.sendToMonitoring('security', event, sanitizedDetails)
  }

  /**
   * Enviar logs para serviço de monitoramento (implementar conforme necessário)
   */
  private sendToMonitoring(level: string, message: string, data?: any): void {
    // TODO: Implementar integração com Sentry, LogRocket, etc.
    // Por enquanto, apenas armazenar localmente para debug
    if (this.isProduction) {
      // Em produção, evitar logs no console
      return
    }
  }
}

// Exportar instância singleton
export const securityLogger = SecurityLogger.getInstance()
export default securityLogger 