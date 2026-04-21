import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from '@/config/environment'
import { testDatabaseConnection } from '@/config/database'
import { logger } from '@/utils/logger'
import { fromUnknownError, toClientErrorResponse } from '@/security/errors'
import { isAllowedCorsOrigin } from '@/security/outboundHttp'
import { redactObject } from '@/security/redaction'
import { generalRateLimit } from '@/middleware/rateLimiting.middleware'
import { advancedSecurityHeaders, sanitizeInput } from '@/middleware/security.middleware'
import authRoutes from '@/routes/auth.routes'
import vaultRoutes from '@/routes/vault.routes'
import settingsRoutes from '@/routes/settings.routes'

// Create Express app
const app: Express = express()

// Global server variable
let serverInstance: any = null

// Trust proxy for correct IP detection
app.set('trust proxy', 1)

// Global rate limiting (must be before other middleware)
if (config.features.rateLimiting) {
  app.use(generalRateLimit)
  logger.info('Global rate limiting enabled')
}

// Advanced security headers
app.use(advancedSecurityHeaders)

// Security middleware.
// CSP is owned exclusively by advancedSecurityHeaders above; disabling it here
// to avoid two sources of truth that can diverge silently over time.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// CORS configuration com validação
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: Postman, apps mobile)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = config.cors.origin as string[]
    
    const isAllowed = isAllowedCorsOrigin(origin, allowedOrigins)
    
    if (isAllowed) {
      callback(null, true)
    } else {
      logger.warn(`CORS blocked: ${origin} not authorized`, { origin, ip: 'unknown' })
      callback(new Error(`CORS bloqueado: ${origin} não autorizado`))
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: config.cors.maxAge
}))

// Headers de segurança adicionais
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
})

// Body parsing middleware
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// Input sanitization (after body parsing)
app.use(sanitizeInput)

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    logger.info('HTTP Request', redactObject({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    }))
  })
  
  next()
})

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    // Public health info (minimal surface exposure)
    const basicHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }

    // Quick connectivity checks (non-blocking)
    const checks = {
      database: false,
      redis: false as boolean | null,
    }

    try {
      const dbConnected = await testDatabaseConnection()
      checks.database = dbConnected
    } catch (error) {
      logger.warn('Health check - database connection failed', {
        message: error instanceof Error ? error.message : 'Unknown database health error',
      })
    }

    // Redis check if configured
    if (config.redis.url) {
      try {
        const Redis = await import('ioredis')
        const redis = new Redis.default(config.redis.url)
        await redis.ping()
        checks.redis = true
        await redis.disconnect()
      } catch (error) {
        logger.warn('Health check - Redis connection failed', {
          message: error instanceof Error ? error.message : 'Unknown redis health error',
        })
      }
    } else {
      checks.redis = null // Not configured
    }

    // Determine overall status
    const overallStatus = checks.database ? 'healthy' : 'degraded'

    res.json({
      ...basicHealth,
      status: overallStatus,
      checks,
      services: {
        api: 'healthy',
        database: checks.database ? 'healthy' : 'unhealthy',
        redis: checks.redis === null ? 'not_configured' : (checks.redis ? 'healthy' : 'unhealthy'),
      },
    })
  } catch (error) {
    logger.error('Health check endpoint error', {
      message: error instanceof Error ? error.message : 'Unknown health endpoint error',
    })
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    })
  }
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/vault', vaultRoutes)
app.use('/api/settings', settingsRoutes)

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
  })
})

// Global error handler
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const normalizedError = fromUnknownError(error)
  logger.error('Unhandled error', {
    code: normalizedError.code,
    statusCode: normalizedError.statusCode,
    details: normalizedError.details,
    message: normalizedError.message,
  })

  res.status(normalizedError.statusCode).json(
    toClientErrorResponse(normalizedError, config.isDevelopment),
  )
})

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`)
  
  if (serverInstance) {
    serverInstance.close(() => {
      logger.info('Server closed')
      process.exit(0)
    })
  }
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Start server
const startServer = async () => {
  try {
    // Test database connection
    logger.info('Testing database connection...')
    const dbConnected = await testDatabaseConnection()
    
    if (!dbConnected) {
      logger.error('Database connection failed, exiting...')
      process.exit(1)
    }
    
    // Start HTTP server
    serverInstance = app.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 SafeBox Backend started successfully!`)
      logger.info(`📍 Server running on http://${config.server.host}:${config.server.port}`)
      logger.info(`🌍 Environment: ${config.env}`)
      logger.info(`📊 Health check: http://${config.server.host}:${config.server.port}/health`)
    })
    
    // Handle server errors
    serverInstance.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.server.port} is already in use`)
      } else {
        logger.error('Server error', {
          code: error?.code,
          message: error instanceof Error ? error.message : 'Unknown server error',
        })
      }
      process.exit(1)
    })
    
    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    
    return serverInstance
  } catch (error) {
    logger.error('Failed to start server', {
      message: error instanceof Error ? error.message : 'Unknown startup error',
    })
    process.exit(1)
  }
}

// Export for testing
export { app }

// Start server if this file is run directly
if (require.main === module) {
  startServer()
} 
