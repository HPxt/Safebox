import { redactObject, redactValue, REDACTION_PLACEHOLDER } from '@/security/redaction'

describe('redaction', () => {
  it('redacts sensitive keys recursively', () => {
    const payload = redactObject({
      email: 'user@example.com',
      password: 'super-secret',
      nested: {
        accessToken: 'token-value',
        safe: 'ok',
      },
    })

    expect(payload).toEqual({
      email: 'user@example.com',
      password: REDACTION_PLACEHOLDER,
      nested: {
        accessToken: REDACTION_PLACEHOLDER,
        safe: 'ok',
      },
    })
  })

  it('redacts bearer tokens even without a sensitive key name', () => {
    expect(redactValue('Bearer abc.def.ghi')).toBe('Bearer [REDACTED]')
  })
})
