import { redactObject, redactValue, REDACTION_PLACEHOLDER } from '@/security/redaction'

describe('redaction', () => {
  it('redacts sensitive keys recursively', () => {
    const payload = redactObject({
      email: 'user@example.com',
      password: 'super-secret',
      ip: '127.0.0.1',
      nested: {
        accessToken: 'token-value',
        userAgent: 'Mozilla/5.0',
        safe: 'ok',
      },
    })

    expect(payload).toEqual({
      email: 'user@example.com',
      password: REDACTION_PLACEHOLDER,
      ip: REDACTION_PLACEHOLDER,
      nested: {
        accessToken: REDACTION_PLACEHOLDER,
        userAgent: REDACTION_PLACEHOLDER,
        safe: 'ok',
      },
    })
  })

  it('redacts bearer tokens even without a sensitive key name', () => {
    expect(redactValue('Bearer abc.def.ghi')).toBe('Bearer [REDACTED]')
  })
})
