import {
  AppError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
  fromUnknownError,
  toClientErrorResponse,
} from '@/security/errors'
import { rateLimitErrorBody } from '@/middleware/rateLimiting.middleware'

describe('security/errors contract', () => {
  test('ValidationError serializes to stable client shape', () => {
    const err = new ValidationError('Invalid request data', {
      issues: [{ path: 'email', message: 'Invalid email format' }],
    })
    const payload = toClientErrorResponse(err, false)

    expect(payload).toEqual({
      success: false,
      error: 'Invalid request data',
      code: 'VALIDATION_ERROR',
      details: {
        issues: [{ path: 'email', message: 'Invalid email format' }],
      },
    })
  })

  test('UnauthorizedError uses UNAUTHORIZED code', () => {
    const payload = toClientErrorResponse(new UnauthorizedError(), false)
    expect(payload.success).toBe(false)
    expect(payload.code).toBe('UNAUTHORIZED')
  })

  test('NotFoundError uses NOT_FOUND code', () => {
    const payload = toClientErrorResponse(new NotFoundError(), false)
    expect(payload.success).toBe(false)
    expect(payload.code).toBe('NOT_FOUND')
  })

  test('ConflictError uses CONFLICT code', () => {
    const payload = toClientErrorResponse(new ConflictError(), false)
    expect(payload.success).toBe(false)
    expect(payload.code).toBe('CONFLICT')
  })

  test('ForbiddenError uses FORBIDDEN code', () => {
    const payload = toClientErrorResponse(new ForbiddenError(), false)
    expect(payload.success).toBe(false)
    expect(payload.code).toBe('FORBIDDEN')
  })

  test('TooManyRequestsError uses TOO_MANY_REQUESTS code', () => {
    const payload = toClientErrorResponse(new TooManyRequestsError(), false)
    expect(payload.success).toBe(false)
    expect(payload.code).toBe('TOO_MANY_REQUESTS')
  })

  test('rate limit response includes stable TOO_MANY_REQUESTS code and retryAfter', () => {
    expect(rateLimitErrorBody('Slow down', 60)).toEqual({
      success: false,
      error: 'Slow down',
      code: 'TOO_MANY_REQUESTS',
      retryAfter: 60,
    })
  })

  test('ExternalServiceError is hidden from clients in production', () => {
    const payload = toClientErrorResponse(new ExternalServiceError('upstream timeout'), false)
    expect(payload).toEqual({
      success: false,
      error: 'Internal server error',
      code: 'EXTERNAL_SERVICE_ERROR',
    })
  })

  test('non-exposed AppError includes debug details only in development', () => {
    const err = new AppError('Sensitive failure detail', 500, 'INTERNAL_ERROR', { expose: false })
    const prodPayload = toClientErrorResponse(err, false)
    const devPayload = toClientErrorResponse(err, true)

    expect(prodPayload).toEqual({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    })
    expect(devPayload.success).toBe(false)
    expect(devPayload.code).toBe('INTERNAL_ERROR')
    expect(devPayload.error).toBe('Internal server error')
    expect(devPayload.details).toEqual({ debug: 'Sensitive failure detail' })
  })

  test('fromUnknownError normalizes generic Error into INTERNAL_ERROR', () => {
    const normalized = fromUnknownError(new Error('Boom'))
    expect(normalized.code).toBe('INTERNAL_ERROR')
    expect(normalized.statusCode).toBe(500)
  })
})

