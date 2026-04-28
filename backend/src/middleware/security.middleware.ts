import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { logSecurityEvent } from '@/utils/logger'
import { config } from '@/config/environment'

interface SecurityConfig {
  maxFailedLogins: number
  lockoutDuration: number
  sessionTimeout: number
  enableCSRF: boolean
  enableXSSProtection: boolean
  enableSQLInjectionProtection: boolean
}

const securityConfig: SecurityConfig = {
  maxFailedLogins: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  enableCSRF: true,
  enableXSSProtection: true,
  enableSQLInjectionProtection: true,
}

// Store para rastrear tentativas de login falhadas
const failedLoginAttempts = new Map<string, { count: number; lockedUntil?: number }>()

// Store para tokens CSRF
const csrfTokens = new Map<string, { token: string; expires: number }>()

/**
 * Validação rigorosa de força de senha
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []

  // Comprimento mínimo 12 caracteres
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }

  // Pelo menos 1 letra minúscula
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  // Pelo menos 1 letra maiúscula
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  // Pelo menos 1 número
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  // Pelo menos 1 símbolo especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // Verificar padrões comuns perigosos
  const dangerousPatterns = [
    /(.)\1{3,}/, // 4+ caracteres repetidos
    /123456|654321|qwerty|password|admin|login/i, // Padrões comuns
    /^[a-z]+$|^[A-Z]+$|^[0-9]+$/, // Apenas um tipo de caractere
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains unsafe patterns')
      break
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Middleware de proteção contra ataques de força bruta
 */
export const bruteForcePrevention = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown'
  const attempt = failedLoginAttempts.get(clientId)

  if (attempt && attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
    const remainingTime = Math.ceil((attempt.lockedUntil - Date.now()) / 1000 / 60)
    
    logSecurityEvent(
      'rate_limit_exceeded',
      'high',
      { reason: 'Account locked due to failed login attempts', remainingMinutes: remainingTime },
      req.ip,
      req.get('User-Agent')
    ).catch(() => undefined)

    return res.status(423).json({
      success: false,
      error: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
      remainingTime: remainingTime,
    })
  }

  return next()
}

/**
 * Registrar tentativa de login falhada
 */
export const recordFailedLogin = (clientId: string, userId?: string) => {
  const attempt = failedLoginAttempts.get(clientId) || { count: 0 }
  attempt.count += 1

  if (attempt.count >= securityConfig.maxFailedLogins) {
    attempt.lockedUntil = Date.now() + securityConfig.lockoutDuration
    
    logSecurityEvent(
      'authentication_failure',
      'critical',
      { 
        reason: 'Multiple failed login attempts - account locked',
        attemptCount: attempt.count,
        lockoutDuration: securityConfig.lockoutDuration,
      },
      clientId,
      undefined,
      userId
    ).catch(() => undefined)
  }

  failedLoginAttempts.set(clientId, attempt)
}

/**
 * Limpar tentativas de login após sucesso
 */
export const clearFailedLogins = (clientId: string) => {
  failedLoginAttempts.delete(clientId)
}

/**
 * Gerador de token CSRF
 */
export const generateCSRFToken = (sessionId: string): string => {
  const token = crypto.randomBytes(32).toString('hex')
  csrfTokens.set(sessionId, {
    token,
    expires: Date.now() + securityConfig.sessionTimeout,
  })
  return token
}

/**
 * Validador de token CSRF
 */
export const validateCSRFToken = (sessionId: string, token: string): boolean => {
  const storedToken = csrfTokens.get(sessionId)
  
  if (!storedToken || storedToken.expires < Date.now()) {
    csrfTokens.delete(sessionId)
    return false
  }

  return storedToken.token === token
}

/**
 * Middleware de proteção CSRF
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  if (!securityConfig.enableCSRF) {
    return next()
  }

  // Pular para métodos GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  const sessionId = (req as any).sessionID || req.user?.userId || req.ip
  const csrfToken = req.headers['x-csrf-token'] as string

  if (!csrfToken || !validateCSRFToken(sessionId, csrfToken)) {
    logSecurityEvent(
      'unauthorized_access',
      'medium',
      { reason: 'Invalid or missing CSRF token' },
      req.ip,
      req.get('User-Agent')
    ).catch(() => undefined)

    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
    })
  }

  next()
}

/**
 * Sanitização de entrada para prevenir XSS e SQL Injection
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (!req.body) {
    return next()
  }

  const sanitizeValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(item))
    }

    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !['__proto__', 'prototype', 'constructor'].includes(key))
          .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)]),
      )
    }

    return value
  }

  try {
    req.body = sanitizeValue(req.body)
    next()
  } catch (_error) {
    res.status(400).json({
      success: false,
      error: 'Invalid input detected',
    })
  }
}

/**
 * Headers de segurança avançados
 */
export const advancedSecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY')
  
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()')
  
  // Strict Transport Security (HTTPS only)
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // Content Security Policy rigorosa
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'",
  ].join('; ')

  res.setHeader('Content-Security-Policy', csp)

  next()
}

/**
 * Limpeza automática de dados expirados
 */
const cleanupInterval = setInterval(() => {
  // Limpar tentativas de login expiradas
  const now = Date.now()
  for (const [key, attempt] of failedLoginAttempts.entries()) {
    if (attempt.lockedUntil && attempt.lockedUntil < now) {
      failedLoginAttempts.delete(key)
    }
  }

  // Limpar tokens CSRF expirados
  for (const [key, token] of csrfTokens.entries()) {
    if (token.expires < now) {
      csrfTokens.delete(key)
    }
  }
}, 5 * 60 * 1000) // Executar a cada 5 minutos

cleanupInterval.unref()

export {
  securityConfig,
  failedLoginAttempts,
  csrfTokens,
} 
