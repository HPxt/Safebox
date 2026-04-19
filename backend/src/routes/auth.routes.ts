import { Router } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { createSupabaseUserClient } from '@/config/database'
import { authService } from '@/services/auth.service'
import { authenticateSupabaseAccessToken, authenticateToken } from '@/middleware/auth.middleware'
import {
  loginRateLimit,
  passwordChangeRateLimit,
  registerRateLimit,
  suspiciousActivityDetector,
} from '@/middleware/rateLimiting.middleware'
import { bruteForcePrevention } from '@/middleware/security.middleware'
import { requireAuthenticatedUser, requireSupabaseAuthenticatedUser } from '@/security/authorization'
import { asyncHandler, sendSuccess } from '@/security/http'
import { validateWithSchema } from '@/security/validation'
import {
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  verifyTwoFactorToken,
} from '@/security/twoFactor'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  fullName: z.string().trim().min(1).max(120).optional(),
}).strict()

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
}).strict()

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
}).strict()

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z.string().url().optional(),
}).strict()

const twoFactorEnableSchema = z.object({
  secret: z.string().trim().min(16).max(128),
  verificationCode: z.string().regex(/^\d{6}$/, 'Invalid verification code'),
  backupCodes: z.array(z.string().trim().min(6).max(32)).min(4).max(20),
}).strict()

const twoFactorVerifySchema = z.object({
  code: z.string().trim().min(6).max(32),
}).strict()

const hashBackupCode = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex')
}

const createScopedClient = (authToken: string) => createSupabaseUserClient(authToken)

const logTwoFactorAttempt = async (
  authToken: string,
  userId: string,
  success: boolean,
  errorMessage: string | undefined,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<void> => {
  const scopedClient = createScopedClient(authToken)
  await scopedClient
    .from('two_factor_attempts' as never)
    .insert({
      user_id: userId,
      success,
      error_message: errorMessage ?? null,
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
    } as never)
}

router.post('/register', suspiciousActivityDetector, registerRateLimit, asyncHandler(async (req, res) => {
  const { email, password, fullName } = validateWithSchema(registerSchema, req.body)
  const result = await authService.register(
    email,
    password,
    fullName,
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    statusCode: 201,
    data: result,
    message: 'User registered successfully',
  })
}))

router.post('/login', bruteForcePrevention, suspiciousActivityDetector, loginRateLimit, asyncHandler(async (req, res) => {
  const { email, password } = validateWithSchema(loginSchema, req.body)
  const result = await authService.login(email, password, req.ip, req.get('User-Agent'))

  sendSuccess(res, {
    data: result,
    message: 'Login successful',
  })
}))

router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req)
  await authService.logout(user.userId, user.sessionId)

  sendSuccess(res, {
    message: 'Logout successful',
  })
}))

router.get('/profile', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const profile = await authService.getProfile(user.userId)

  sendSuccess(res, { data: profile })
}))

router.put('/profile', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const validatedData = validateWithSchema(updateProfileSchema, req.body)
  const updates = {
    ...(validatedData.fullName !== undefined ? { full_name: validatedData.fullName } : {}),
    ...(validatedData.avatarUrl !== undefined ? { avatar_url: validatedData.avatarUrl } : {}),
  }

  const profile = await authService.updateProfile(user.userId, updates)

  sendSuccess(res, {
    data: profile,
    message: 'Profile updated successfully',
  })
}))

router.post('/change-password', authenticateSupabaseAccessToken, passwordChangeRateLimit, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const { currentPassword, newPassword } = validateWithSchema(changePasswordSchema, req.body)

  await authService.changePassword(user.userId, currentPassword, newPassword)

  sendSuccess(res, {
    message: 'Password changed successfully. Please login again on your devices.',
  })
}))

router.post('/refresh-token', authenticateToken, asyncHandler(async (req, res) => {
  const user = requireAuthenticatedUser(req)
  const token = await authService.refreshToken(user.userId, user.sessionId)

  sendSuccess(res, {
    data: { token },
    message: 'Token refreshed successfully',
  })
}))

router.get('/2fa/status', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { data, error } = await scopedClient
    .from('users')
    .select('two_factor_enabled')
    .eq('id', user.userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  sendSuccess(res, {
    data: {
      enabled: Boolean(data?.two_factor_enabled),
    },
  })
}))

router.post('/2fa/enable', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const { secret, verificationCode, backupCodes } = validateWithSchema(twoFactorEnableSchema, req.body)
  const scopedClient = createScopedClient(req.authToken!)

  if (!verifyTwoFactorToken(secret, verificationCode)) {
    await logTwoFactorAttempt(req.authToken!, user.userId, false, 'Invalid activation code', req.ip, req.get('User-Agent'))
    throw new Error('Invalid 2FA verification code')
  }

  const encryptedSecret = encryptTwoFactorSecret(secret)
  const hashedBackupCodes = backupCodes.map(hashBackupCode)

  const { error } = await scopedClient
    .from('users')
    .update({
      two_factor_secret: encryptedSecret,
      two_factor_enabled: true,
      two_factor_backup_codes: hashedBackupCodes,
      two_factor_verified_at: new Date().toISOString(),
    })
    .eq('id', user.userId)

  if (error) {
    throw error
  }

  await logTwoFactorAttempt(req.authToken!, user.userId, true, 'Activated', req.ip, req.get('User-Agent'))

  sendSuccess(res, {
    message: '2FA enabled successfully',
  })
}))

router.post('/2fa/verify', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const { code } = validateWithSchema(twoFactorVerifySchema, req.body)
  const scopedClient = createScopedClient(req.authToken!)

  const { data, error } = await scopedClient
    .from('users')
    .select('two_factor_enabled, two_factor_secret, two_factor_backup_codes')
    .eq('id', user.userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.two_factor_enabled || !data.two_factor_secret) {
    sendSuccess(res, {
      data: { verified: false, reason: '2FA not enabled' },
    })
    return
  }

  let verified = false
  let usedBackupCode = false
  const normalizedCode = code.replace(/\s+/g, '')

  try {
    const secret = decryptTwoFactorSecret(data.two_factor_secret)
    verified = verifyTwoFactorToken(secret, normalizedCode)
  } catch (error) {
    await logTwoFactorAttempt(req.authToken!, user.userId, false, 'Unable to decrypt 2FA secret', req.ip, req.get('User-Agent'))
    throw error
  }

  if (!verified && data.two_factor_backup_codes?.length) {
    const hashedCode = hashBackupCode(normalizedCode)
    verified = data.two_factor_backup_codes.includes(hashedCode)
    usedBackupCode = verified

    if (verified) {
      const remainingCodes = data.two_factor_backup_codes.filter((item: string) => item !== hashedCode)
      const { error: updateError } = await scopedClient
        .from('users')
        .update({ two_factor_backup_codes: remainingCodes })
        .eq('id', user.userId)

      if (updateError) {
        throw updateError
      }
    }
  }

  await logTwoFactorAttempt(
    req.authToken!,
    user.userId,
    verified,
    verified ? (usedBackupCode ? 'Backup code' : 'Verified') : 'Invalid code',
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    data: {
      verified,
      usedBackupCode,
    },
  })
}))

router.post('/2fa/disable', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { error } = await scopedClient
    .from('users')
    .update({
      two_factor_secret: null,
      two_factor_enabled: false,
      two_factor_backup_codes: null,
      two_factor_verified_at: null,
    })
    .eq('id', user.userId)

  if (error) {
    throw error
  }

  await logTwoFactorAttempt(req.authToken!, user.userId, true, 'Deactivated', req.ip, req.get('User-Agent'))

  sendSuccess(res, {
    message: '2FA disabled successfully',
  })
}))

router.delete('/account', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  await authService.deleteAccount(user.userId)

  sendSuccess(res, {
    message: 'Account deleted successfully',
  })
}))

export default router
