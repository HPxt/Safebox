import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('localhost'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/safebox.log'),
  
  // Optional configurations
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  TWO_FACTOR_ENCRYPTION_SECRET: z.string().min(32).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  
  // Feature flags
  ENABLE_AUDIT_LOGS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_RATE_LIMITING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_EMAIL_NOTIFICATIONS: z.string().transform(val => val === 'true').default('false'),
  ENABLE_BACKUP_CLEANUP: z.string().transform(val => val === 'true').default('true'),
  
  // Backup and session configuration
  BACKUP_RETENTION_DAYS: z.string().transform(Number).default('30'),
  MAX_BACKUPS_PER_USER: z.string().transform(Number).default('10'),
  SESSION_TIMEOUT_MINUTES: z.string().transform(Number).default('15'),
  MAX_CONCURRENT_SESSIONS: z.string().transform(Number).default('5'),
})

// Validate environment variables
const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parseResult.error.format())
  process.exit(1)
}

const env = parseResult.data

// Export structured configuration
export const config = {
  env: process.env['NODE_ENV'] || 'development',
  isDevelopment: process.env['NODE_ENV'] === 'development',
  isProduction: process.env['NODE_ENV'] === 'production',
  isTest: env.NODE_ENV === 'test',
  
  server: {
    port: parseInt(process.env['PORT'] || '3001', 10),
    host: process.env['HOST'] || '0.0.0.0',
  },
  
  supabase: {
    url: process.env['SUPABASE_URL'] || '',
    anonKey: process.env['SUPABASE_ANON_KEY'] || '',
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  
  security: {
    bcryptRounds: env.BCRYPT_ROUNDS,
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },
    twoFactorEncryptionSecret: env.TWO_FACTOR_ENCRYPTION_SECRET,
  },
  
  cors: {
    // SEGURANÇA: Restringir origins em produção
    origin: process.env['NODE_ENV'] === 'production' 
      ? [
          'https://safebox.vercel.app',           // Produção
          'https://safebox-*.vercel.app',         // Preview deployments
          'https://safebox.com',                  // Domínio customizado futuro
        ]
      : [
          'http://localhost:3000',                // React dev
          'http://localhost:3001',                // Backend dev
          'http://127.0.0.1:3000',               // Alternativa localhost
        ],
    credentials: true,
    maxAge: 86400, // 24 horas
  },
  
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  
  database: {
    url: env.DATABASE_URL,
  },
  
  redis: {
    url: env.REDIS_URL,
  },
  
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  
  monitoring: {
    sentryDsn: env.SENTRY_DSN,
  },
  
  features: {
    auditLogs: env.ENABLE_AUDIT_LOGS,
    rateLimiting: env.ENABLE_RATE_LIMITING,
    emailNotifications: env.ENABLE_EMAIL_NOTIFICATIONS,
    backupCleanup: env.ENABLE_BACKUP_CLEANUP,
  },
  
  backup: {
    retentionDays: env.BACKUP_RETENTION_DAYS,
    maxBackupsPerUser: env.MAX_BACKUPS_PER_USER,
  },
  
  session: {
    timeoutMinutes: env.SESSION_TIMEOUT_MINUTES,
    maxConcurrentSessions: env.MAX_CONCURRENT_SESSIONS,
  },
} as const

export default config 
