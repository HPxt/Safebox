import { ZodError } from 'zod'
import { redactErrorForClient, redactObject } from '@/security/redaction'

export class AppError extends Error {
  statusCode: number
  code: string
  expose: boolean
  details: Record<string, unknown> | undefined

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    options?: {
      expose?: boolean
      details?: Record<string, unknown>
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.expose = options?.expose ?? statusCode < 500
    this.details = options?.details

    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', {
      expose: true,
      ...(details ? { details } : {}),
    })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', { expose: true })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN', { expose: true })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND', { expose: true })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT', { expose: true })
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS', { expose: true })
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'External service request failed') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', { expose: false })
  }
}

type HttpParserError = Error & {
  status?: number
  statusCode?: number
  type?: string
}

const httpErrorCodeForStatus = (statusCode: number): string => {
  if (statusCode === 400) return 'BAD_REQUEST'
  if (statusCode === 413) return 'PAYLOAD_TOO_LARGE'
  if (statusCode === 415) return 'UNSUPPORTED_MEDIA_TYPE'
  return 'HTTP_ERROR'
}

const httpErrorMessageForStatus = (statusCode: number): string => {
  if (statusCode === 400) return 'Invalid request body'
  if (statusCode === 413) return 'Payload too large'
  if (statusCode === 415) return 'Unsupported media type'
  return 'Invalid request'
}

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError
}

export const fromUnknownError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof ZodError) {
    return new ValidationError('Invalid request data', {
      issues: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  if (error instanceof Error) {
    const httpError = error as HttpParserError
    const statusCode = httpError.statusCode ?? httpError.status

    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      const options: {
        expose: true
        details?: Record<string, unknown>
        cause: Error
      } = {
        expose: true,
        cause: error,
      }

      if (httpError.type) {
        options.details = { type: httpError.type }
      }

      return new AppError(
        httpErrorMessageForStatus(statusCode),
        statusCode,
        httpErrorCodeForStatus(statusCode),
        options,
      )
    }

    return new AppError(error.message, 500, 'INTERNAL_ERROR', {
      expose: false,
      cause: error,
    })
  }

  return new AppError('Internal server error')
}

export const toClientErrorResponse = (
  error: unknown,
  _isDevelopment: boolean,
): {
  success: false
  error: string
  code: string
  details?: Record<string, unknown>
} => {
  const appError = fromUnknownError(error)
  const shouldExposeDetails = appError.expose && appError.details

  const response: {
    success: false
    error: string
    code: string
    details?: Record<string, unknown>
  } = {
    success: false,
    error: appError.expose ? redactErrorForClient(appError) : 'Internal server error',
    code: appError.code,
  }

  if (shouldExposeDetails) {
    response.details = redactObject(appError.details as Record<string, unknown>)
  }

  return response
}
