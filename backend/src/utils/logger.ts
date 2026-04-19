import winston from 'winston'
import path from 'path'
import { supabase } from '@/config/database'
import { redactObject } from '@/security/redaction'

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  audit: 4,
}

// Custom colors for log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  audit: 'magenta',
}

winston.addColors(colors)

// Create logger configuration
const loggerConfig: winston.LoggerOptions = {
  level: process.env['LOG_LEVEL'] || 'info',
  levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
}

// Add file transport in production
if (process.env['NODE_ENV'] === 'production') {
  const logDir = path.dirname(process.env['LOG_FILE'] || 'logs/safebox.log')
  
  const fileTransports = [
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Audit log file
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      level: 'audit',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ]
  
  const existingTransports = Array.isArray(loggerConfig.transports) 
    ? loggerConfig.transports 
    : loggerConfig.transports ? [loggerConfig.transports] : []
  
  loggerConfig.transports = [...existingTransports, ...fileTransports]
}

// Create logger instance
export const logger = winston.createLogger(loggerConfig)

// Enhanced audit logging function with database storage
export const logAuditEvent = async (
  eventType: 'vault_unlock' | 'vault_lock' | 'credential_created' | 'credential_updated' | 'credential_deleted' | 'settings_updated' | 'login_success' | 'login_failure' | 'password_changed',
  userId?: string,
  eventData: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string
) => {
  const auditData = {
    eventType,
    userId,
    eventData: redactObject(eventData),
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString(),
  }

  // Log to winston
  logger.log('audit', 'Audit Event', auditData)

  // Store in database if available
  try {
    if (process.env['ENABLE_AUDIT_LOGS'] === 'true') {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        event_type: eventType,
        event_data: redactObject(eventData),
        ip_address: ipAddress,
        user_agent: userAgent,
      })
    }
  } catch (error) {
    logger.error('Failed to store audit log in database:', error)
  }
}

// Enhanced request logging function
export const logRequest = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  userId?: string,
  ipAddress?: string,
  userAgent?: string,
  additionalData?: Record<string, any>
) => {
  const logData = {
    method,
    url,
    statusCode,
    responseTime,
    userId,
    ipAddress,
    userAgent,
    ...additionalData,
  }

  // Color code by status
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
  
  logger.log(level, 'HTTP Request', redactObject(logData))
}

// Security event logging
export const logSecurityEvent = async (
  eventType: 'suspicious_activity' | 'rate_limit_exceeded' | 'authentication_failure' | 'unauthorized_access' | 'data_breach_attempt',
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
  userId?: string
) => {
  const securityData = {
    eventType,
    severity,
    details,
    ipAddress,
    userAgent,
    userId,
    timestamp: new Date().toISOString(),
  }

  logger.warn('Security Event', redactObject(securityData))

  // For critical events, also log as error
  if (severity === 'critical') {
    logger.error('Critical Security Event', redactObject(securityData))
  }

  // Store in audit logs as well
  await logAuditEvent('login_failure', userId, { 
    securityEvent: eventType, 
    severity, 
    ...details 
  }, ipAddress, userAgent)
}

// Performance monitoring
export const logPerformance = (
  operation: string,
  duration: number,
  details?: Record<string, any>
) => {
  const perfData = {
    operation,
    duration,
    ...details,
  }

  // Warn on slow operations (> 1000ms)
  const level = duration > 1000 ? 'warn' : 'debug'
  logger.log(level, 'Performance', redactObject(perfData))
}

export default logger 
