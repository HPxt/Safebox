import { Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import slowDown from 'express-slow-down'
import Redis from 'ioredis'
import { config } from '@/config/environment'
import { redactObject } from '@/security/redaction'
import { logger } from '@/utils/logger'

export const rateLimitErrorBody = (error: string, retryAfter: number) => ({
  success: false,
  error,
  code: 'TOO_MANY_REQUESTS',
  retryAfter,
})

// Configuração do Redis para rate limiting distribuído
let redisClient: Redis | null = null

if (config.redis.url) {
  try {
    redisClient = new Redis(config.redis.url)
    redisClient.on('error', (err) => {
      logger.error('Redis connection error', {
        message: err instanceof Error ? err.message : 'Unknown redis error',
      })
    })
    redisClient.on('connect', () => {
      logger.info('Redis connected for rate limiting')
    })
  } catch (_error) {
    logger.warn('Redis not available, using memory store for rate limiting')
  }
}

// Store personalizado para Redis
class RedisStore {
  private client: Redis
  private prefix: string

  constructor(client: Redis, prefix = 'rl:') {
    this.client = client
    this.prefix = prefix
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime?: Date }> {
    const redisKey = this.prefix + key
    const pipeline = this.client.pipeline()
    
    pipeline.incr(redisKey)
    pipeline.expire(redisKey, 900) // 15 minutos
    
    const results = await pipeline.exec()
    const totalHits = results?.[0]?.[1] as number || 0
    
    return {
      totalHits,
      resetTime: new Date(Date.now() + 900000) // 15 minutos
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.prefix + key
    await this.client.decr(redisKey)
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = this.prefix + key
    await this.client.del(redisKey)
  }
}

// Rate limiter para login (mais restritivo)
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    success: false,
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? { store: new RedisStore(redisClient, 'login:') as any } : {}),
  keyGenerator: (req: Request) => {
    // Usar IP + User-Agent para identificação mais precisa
    const ip = req.ip || req.connection.remoteAddress || 'unknown'
    const userAgent = req.get('User-Agent') || 'unknown'
    return `${ip}:${Buffer.from(userAgent).toString('base64').substring(0, 20)}`
  },
  handler: (req: Request, res: Response) => {
    const ip = req.ip || 'unknown'
    logger.warn('Rate limit exceeded for login', redactObject({
      ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    }))
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: 15 * 60
    })
  }
})

// Rate limiter para registro (moderado)
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por IP por hora
  message: {
    success: false,
    error: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? { store: new RedisStore(redisClient, 'register:') as any } : {}),
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for registration', redactObject({
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }))
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de registro. Tente novamente em 1 hora.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: 60 * 60
    })
  }
})

// Rate limiter para mudança de senha (muito restritivo)
export const passwordChangeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 mudanças por usuário por hora
  message: {
    success: false,
    error: 'Muitas tentativas de mudança de senha. Tente novamente em 1 hora.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? { store: new RedisStore(redisClient, 'password:') as any } : {}),
  keyGenerator: (req: Request) => {
    // Usar userId se autenticado, senão IP
    const userId = req.supabaseUser?.userId || req.user?.userId
    return userId ? `user:${userId}` : `ip:${req.ip}`
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for password change', redactObject({
      userId: req.supabaseUser?.userId || req.user?.userId,
      ip: req.ip
    }))
    
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de mudança de senha. Tente novamente em 1 hora.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: 60 * 60
    })
  }
})

// Rate limiter geral para API (liberal)
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 requests por IP
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? { store: new RedisStore(redisClient, 'general:') as any } : {}),
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (req: Request, res: Response) => {
    logger.warn('General rate limit exceeded', redactObject({
      ip: req.ip,
      path: req.path,
      method: req.method
    }))
    
    res.status(429).json({
      success: false,
      error: 'Muitas requisições. Tente novamente em alguns minutos.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: 15 * 60
    })
  }
})

// Slow down para requests suspeitos (adiciona delay progressivo)
export const suspiciousSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 10, // começar delay após 10 requests
  delayMs: () => 500, // delay fixo compatível com express-slow-down v2
  maxDelayMs: 10000, // delay máximo de 10 segundos
  ...(redisClient ? { store: new RedisStore(redisClient, 'slow:') as any } : {}),
  keyGenerator: (req: Request) => req.ip || 'unknown',
})

// Middleware para detectar padrões suspeitos
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || ''
  const ip = req.ip || ''
  
  // Detectar user agents suspeitos
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scan/i,
    /hack/i,
    /attack/i,
    /sqlmap/i,
    /nmap/i,
    /burp/i,
    /nikto/i
  ]
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent))
  
  if (isSuspicious) {
    logger.warn('Suspicious user agent detected', redactObject({
      ip,
      userAgent,
      path: req.path
    }))
    
    // Aplicar rate limit mais restritivo para atividade suspeita
    return rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 1, // apenas 1 request por minuto
      message: {
        success: false,
        error: 'Atividade suspeita detectada. Acesso temporariamente restrito.',
        code: 'TOO_MANY_REQUESTS',
        retryAfter: 60
      }
    })(req, res, next)
  }
  
  next()
}

// Rate limiter específico para operações de vault (críticas)
export const vaultRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // máximo 60 operações por minuto por usuário
  message: {
    success: false,
    error: 'Muitas operações no cofre. Aguarde um momento.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  ...(redisClient ? { store: new RedisStore(redisClient, 'vault:') as any } : {}),
  keyGenerator: (req: Request) => {
    const userId = req.supabaseUser?.userId || req.user?.userId
    return userId ? `user:${userId}` : `ip:${req.ip}`
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Vault rate limit exceeded', redactObject({
      userId: req.supabaseUser?.userId || req.user?.userId,
      ip: req.ip,
      operation: req.method + ' ' + req.path
    }))
    
    res.status(429).json({
      success: false,
      error: 'Muitas operações no cofre. Aguarde um momento.',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: 60
    })
  }
})

// Middleware para limpar rate limits (para testes ou emergências)
export const clearRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  if (req.query['clearRateLimit'] === 'true' && config.isDevelopment) {
    const ip = req.ip || 'unknown'
    
    if (redisClient) {
      const keys = await redisClient.keys(`*${ip}*`)
      if (keys.length > 0) {
        await redisClient.del(...keys)
        logger.info('Rate limits cleared in development mode')
      }
    }
    
    res.json({
      success: true,
      message: 'Rate limits cleared (development only)'
    })
    return
  }
  
  next()
}

export default {
  loginRateLimit,
  registerRateLimit,
  passwordChangeRateLimit,
  generalRateLimit,
  suspiciousSlowDown,
  suspiciousActivityDetector,
  vaultRateLimit,
  clearRateLimit
} 
