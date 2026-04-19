import { ZodType } from 'zod'
import { ValidationError } from '@/security/errors'

export const validateWithSchema = <T>(schema: ZodType<T>, input: unknown): T => {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new ValidationError('Invalid request data', {
      issues: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  return result.data
}

export const parseIntegerQuery = (
  value: unknown,
  {
    defaultValue,
    min,
    max,
    fieldName,
  }: {
    defaultValue: number
    min: number
    max: number
    fieldName: string
  },
): number => {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }

  const numeric = Number(value)

  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new ValidationError(`${fieldName} must be an integer between ${min} and ${max}`)
  }

  return numeric
}

export const assertNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${fieldName} is required`)
  }

  return value.trim()
}
