import { z } from 'zod'
import { ValidationError } from '@/security/errors'
import { parseIntegerQuery, validateWithSchema } from '@/security/validation'

describe('validation helpers', () => {
  it('rejects invalid schema payloads with a ValidationError', () => {
    const schema = z.object({
      email: z.string().email(),
    }).strict()

    expect(() => validateWithSchema(schema, { email: 'invalid' })).toThrow(ValidationError)
  })

  it('parses bounded integer query params', () => {
    expect(parseIntegerQuery('10', {
      defaultValue: 5,
      min: 1,
      max: 20,
      fieldName: 'limit',
    })).toBe(10)
  })

  it('rejects out-of-range integer query params', () => {
    expect(() => parseIntegerQuery('50', {
      defaultValue: 5,
      min: 1,
      max: 20,
      fieldName: 'limit',
    })).toThrow('limit must be an integer between 1 and 20')
  })
})
