import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  verifyTwoFactorToken,
} from './twoFactor'

describe('twoFactor security helpers', () => {
  it('encrypts and decrypts a 2FA secret without losing the value', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const encrypted = encryptTwoFactorSecret(secret)

    expect(encrypted.startsWith('ENCv1:')).toBe(true)
    expect(decryptTwoFactorSecret(encrypted)).toBe(secret)
  })

  it('returns raw secret for legacy PLAIN: format (backwards-compat until DB migration)', () => {
    // PLAIN: secrets must still work so existing users are not locked out.
    // Callers should opportunistically re-encrypt on next successful verification.
    expect(decryptTwoFactorSecret('PLAIN:JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP')
  })

  it('rejects invalid TOTP tokens', () => {
    expect(verifyTwoFactorToken('JBSWY3DPEHPK3PXP', 'abcdef')).toBe(false)
  })
})
