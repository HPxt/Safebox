import * as OTPAuth from 'otpauth'
import { supabase } from '../config/supabase'
import { backendRequest } from './backendApi'

type TwoFactorVerifyResponse = {
  verified: boolean
  usedBackupCode?: boolean
  reason?: string
}

class TwoFactorService {
  static generateSecret(email: string): { secret: string; uri: string } {
    const totp = new OTPAuth.TOTP({
      issuer: 'SafeBox',
      label: `SafeBox (${email})`,
      algorithm: 'SHA256',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(
        OTPAuth.Secret.fromUTF8(
          crypto.getRandomValues(new Uint8Array(20)).toString(),
        ).base32,
      ),
    })

    return {
      secret: totp.secret.base32,
      uri: totp.toString(),
    }
  }

  static verifyToken(secret: string, token: string): boolean {
    try {
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: 'SHA256',
        digits: 6,
        period: 30,
      })

      return totp.validate({ token, window: 1 }) !== null
    } catch {
      return false
    }
  }

  static generateBackupCodes(count = 8): string[] {
    const codes: string[] = []

    for (let index = 0; index < count; index += 1) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(byte => byte.toString().padStart(3, '0').slice(-2))
        .join('')

      codes.push(code)
    }

    return codes
  }

  static async enable2FA(secret: string, backupCodes: string[], verificationCode: string) {
    return backendRequest('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({
        secret,
        backupCodes,
        verificationCode,
      }),
    })
  }

  static async disable2FA() {
    return backendRequest('/auth/2fa/disable', {
      method: 'POST',
    })
  }

  static async verifyCode(code: string): Promise<TwoFactorVerifyResponse> {
    return backendRequest<TwoFactorVerifyResponse>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  }

  static async check2FAStatus(_userId?: string): Promise<boolean> {
    try {
      const response = await backendRequest<{ enabled: boolean }>('/auth/2fa/status', {
        method: 'GET',
      })
      return response.enabled
    } catch {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) {
          return false
        }

        const { data, error } = await supabase
          .from('users')
          .select('two_factor_enabled')
          .eq('id', user.id)
          .single()

        if (error) {
          return false
        }

        return Boolean(data?.two_factor_enabled)
      } catch {
        return false
      }
    }
  }
}

export default TwoFactorService
