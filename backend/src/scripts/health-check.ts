import { config } from '@/config/environment'
import { testDatabaseConnection } from '@/config/database'
import { logger } from '@/utils/logger'
import Redis from 'ioredis'

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'warning'
  message: string
  details?: any
}

class HealthChecker {
  private results: HealthCheckResult[] = []

  async checkDatabase(): Promise<void> {
    try {
      const isConnected = await testDatabaseConnection()
      this.results.push({
        service: 'Database (Supabase)',
        status: isConnected ? 'healthy' : 'unhealthy',
        message: isConnected ? 'Database connection successful' : 'Database connection failed',
      })
    } catch (error) {
      this.results.push({
        service: 'Database (Supabase)',
        status: 'unhealthy',
        message: 'Database connection error',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  async checkRedis(): Promise<void> {
    if (!config.redis.url) {
      this.results.push({
        service: 'Redis',
        status: 'warning',
        message: 'Redis URL not configured - using memory store for rate limiting',
      })
      return
    }

    try {
      const redis = new Redis(config.redis.url)
      await redis.ping()
      await redis.disconnect()
      
      this.results.push({
        service: 'Redis',
        status: 'healthy',
        message: 'Redis connection successful',
      })
    } catch (error) {
      this.results.push({
        service: 'Redis',
        status: 'unhealthy',
        message: 'Redis connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  checkEnvironmentVariables(): void {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'JWT_SECRET',
    ]

    const missing = required.filter(key => !process.env[key])
    
    if (missing.length === 0) {
      this.results.push({
        service: 'Environment Variables',
        status: 'healthy',
        message: 'All required environment variables are set',
      })
    } else {
      this.results.push({
        service: 'Environment Variables',
        status: 'unhealthy',
        message: `Missing required environment variables: ${missing.join(', ')}`,
        details: { missing },
      })
    }

    // Check optional but recommended variables
    const recommended = ['REDIS_URL', 'LOG_LEVEL', 'CORS_ORIGIN']
    const missingRecommended = recommended.filter(key => !process.env[key])
    
    if (missingRecommended.length > 0) {
      this.results.push({
        service: 'Optional Configuration',
        status: 'warning',
        message: `Missing recommended environment variables: ${missingRecommended.join(', ')}`,
        details: { missingRecommended },
      })
    }
  }

  checkSecurityConfiguration(): void {
    const issues: string[] = []

    // Check JWT secret strength
    const jwtSecret = process.env['JWT_SECRET']
    if (jwtSecret && jwtSecret.length < 32) {
      issues.push('JWT secret should be at least 32 characters long')
    }

    // Check production settings
    if (config.isProduction) {
      if (!process.env['REDIS_URL']) {
        issues.push('Redis should be configured in production for rate limiting')
      }
      
      if (config.cors.origin.includes('localhost')) {
        issues.push('CORS should not include localhost in production')
      }
    }

    // Check rate limiting
    if (!config.features.rateLimiting) {
      issues.push('Rate limiting is disabled - security risk')
    }

    if (issues.length === 0) {
      this.results.push({
        service: 'Security Configuration',
        status: 'healthy',
        message: 'Security configuration looks good',
      })
    } else {
      this.results.push({
        service: 'Security Configuration',
        status: config.isProduction ? 'unhealthy' : 'warning',
        message: `Security issues found: ${issues.join('; ')}`,
        details: { issues },
      })
    }
  }

  async runAllChecks(): Promise<HealthCheckResult[]> {
    logger.info('🔍 Starting health check...')

    // Run all checks
    await this.checkDatabase()
    await this.checkRedis()
    this.checkEnvironmentVariables()
    this.checkSecurityConfiguration()

    // Log results
    const healthyCount = this.results.filter(r => r.status === 'healthy').length
    const warningCount = this.results.filter(r => r.status === 'warning').length
    const unhealthyCount = this.results.filter(r => r.status === 'unhealthy').length

    logger.info(`Health check completed: ${healthyCount} healthy, ${warningCount} warnings, ${unhealthyCount} unhealthy`)

    // Log each result
    this.results.forEach(result => {
      const level = result.status === 'healthy' ? 'info' : 
                   result.status === 'warning' ? 'warn' : 'error'
      
      logger.log(level, `[${result.service}] ${result.message}`, result.details)
    })

    return this.results
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    const hasUnhealthy = this.results.some(r => r.status === 'unhealthy')
    const hasWarning = this.results.some(r => r.status === 'warning')

    if (hasUnhealthy) return 'unhealthy'
    if (hasWarning) return 'degraded'
    return 'healthy'
  }
}

// Script execution
const runHealthCheck = async () => {
  try {
    const checker = new HealthChecker()
    const results = await checker.runAllChecks()
    const overallStatus = checker.getOverallStatus()

    console.log('\n=== HEALTH CHECK SUMMARY ===')
    console.log(`Overall Status: ${overallStatus.toUpperCase()}`)
    console.log(`Environment: ${config.env}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)

    // Exit with appropriate code
    const exitCode = overallStatus === 'unhealthy' ? 1 : 0
    process.exit(exitCode)
  } catch (error) {
    logger.error('Health check failed:', error)
    process.exit(1)
  }
}

// Export for use in other modules
export { HealthChecker, HealthCheckResult }

// Run if called directly
if (require.main === module) {
  runHealthCheck()
} 