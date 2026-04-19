import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { createSupabaseAuthClient, supabase } from '@/config/database'
import { config } from '@/config/environment'
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/security/errors'
import { validatePasswordStrength, recordFailedLogin, clearFailedLogins } from '@/middleware/security.middleware'
import { AuthUser, UserUpdate } from '@/types/database'
import { logger, logAuditEvent } from '@/utils/logger'

type TokenPayload = {
  userId: string
  email: string
  sessionId: string
}

const parseDurationToMs = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value)

  if (!match) {
    return 24 * 60 * 60 * 1000
  }

  const amount = Number(match[1])
  const unit = match[2]

  switch (unit) {
    case 's':
      return amount * 1000
    case 'm':
      return amount * 60 * 1000
    case 'h':
      return amount * 60 * 60 * 1000
    case 'd':
      return amount * 24 * 60 * 60 * 1000
    default:
      return 24 * 60 * 60 * 1000
  }
}

export class AuthService {
  async register(
    email: string,
    password: string,
    fullName?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: AuthUser; token: string }> {
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      throw new ValidationError('Password does not meet security requirements', {
        errors: passwordValidation.errors,
      })
    }

    const authClient = createSupabaseAuthClient()
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (authError) {
      logger.warn('User registration failed', { message: authError.message })
      throw new ConflictError('Unable to register with the provided email')
    }

    if (!authData.user) {
      throw new AppError('User creation failed', 500, 'REGISTRATION_FAILED')
    }

    const token = await this.issueSession(authData.user.id, email, ipAddress, userAgent)

    await logAuditEvent('login_success', authData.user.id, {
      event: 'user_registered',
    }, ipAddress, userAgent)

    return {
      user: {
        id: authData.user.id,
        email,
        ...(fullName ? { fullName } : {}),
        status: 'active',
        createdAt: new Date().toISOString(),
        loginCount: 0,
      },
      token,
    }
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: AuthUser; token: string }> {
    const authClient = createSupabaseAuthClient()
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      if (ipAddress) {
        recordFailedLogin(ipAddress)
      }

      await logAuditEvent('login_failure', undefined, {
        event: 'login_failed',
      }, ipAddress, userAgent)

      throw new UnauthorizedError('Invalid email or password')
    }

    const profile = await this.getProfile(authData.user.id)
    const token = await this.issueSession(authData.user.id, profile.email, ipAddress, userAgent)

    if (ipAddress) {
      clearFailedLogins(ipAddress)
    }

    await supabase.rpc('update_user_last_login', {
      p_user_id: authData.user.id,
    })

    await logAuditEvent('login_success', authData.user.id, {
      event: 'login_success',
    }, ipAddress, userAgent)

    return {
      user: profile,
      token,
    }
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.revokeSession(userId, sessionId)

    await logAuditEvent('vault_lock', userId, {
      event: 'user_logout',
      sessionId,
    })
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) {
      throw new NotFoundError('User profile not found')
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name ?? undefined,
      avatarUrl: data.avatar_url ?? undefined,
      status: data.status,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at ?? undefined,
      loginCount: data.login_count,
    }
  }

  async updateProfile(userId: string, updates: Partial<UserUpdate>): Promise<AuthUser> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error || !data) {
      throw new AppError('Failed to update user profile', 500, 'PROFILE_UPDATE_FAILED')
    }

    await logAuditEvent('settings_updated', userId, {
      event: 'profile_updated',
      updatedFields: Object.keys(updates),
    })

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name ?? undefined,
      avatarUrl: data.avatar_url ?? undefined,
      status: data.status,
      createdAt: data.created_at,
      lastLoginAt: data.last_login_at ?? undefined,
      loginCount: data.login_count,
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.isValid) {
      throw new ValidationError('New password does not meet security requirements', {
        errors: passwordValidation.errors,
      })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      throw new NotFoundError('User not found')
    }

    const authClient = createSupabaseAuthClient()
    const { error: verifyError } = await authClient.auth.signInWithPassword({
      email: userData.email,
      password: currentPassword,
    })

    if (verifyError) {
      throw new UnauthorizedError('Current password is incorrect')
    }

    const { error: updateError } = await authClient.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      throw new AppError('Failed to update password', 500, 'PASSWORD_CHANGE_FAILED')
    }

    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)

    await logAuditEvent('password_changed', userId, {
      event: 'password_changed',
    })
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload

      if (!decoded.userId || !decoded.email || !decoded.sessionId) {
        throw new UnauthorizedError('Invalid token')
      }

      await this.ensureSessionIsActive(decoded.userId, decoded.sessionId, token)

      return decoded
    } catch (error) {
      logger.warn('Token verification failed', {
        message: error instanceof Error ? error.message : 'unknown',
      })
      throw new UnauthorizedError('Invalid or expired token')
    }
  }

  async refreshToken(userId: string, sessionId: string): Promise<string> {
    const profile = await this.getProfile(userId)
    const newToken = this.generateToken({
      userId,
      email: profile.email,
      sessionId,
    })

    await this.persistSessionToken(userId, sessionId, newToken)
    return newToken
  }

  async deleteAccount(userId: string): Promise<void> {
    await supabase
      .from('users')
      .update({ status: 'deleted' })
      .eq('id', userId)

    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)

    await logAuditEvent('settings_updated', userId, {
      event: 'account_deleted',
    })
  }

  private async issueSession(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const sessionId = uuidv4()
    const token = this.generateToken({ userId, email, sessionId })

    await supabase
      .from('user_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        session_token: this.hashToken(token),
        expires_at: new Date(Date.now() + parseDurationToMs(config.jwt.expiresIn)).toISOString(),
        ip_address: ipAddress ?? null,
        user_agent: userAgent ?? null,
        is_active: true,
      })

    await this.enforceConcurrentSessionLimit(userId)
    return token
  }

  private async ensureSessionIsActive(userId: string, sessionId: string, token: string): Promise<void> {
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('id, session_token, expires_at, is_active')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !session || !session.is_active) {
      throw new UnauthorizedError('Session is not active')
    }

    if (session.session_token !== this.hashToken(token)) {
      throw new UnauthorizedError('Session token mismatch')
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await this.revokeSession(userId, sessionId)
      throw new UnauthorizedError('Session expired')
    }

    await supabase
      .from('user_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
  }

  private async revokeSession(userId: string, sessionId: string): Promise<void> {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
      .eq('user_id', userId)
  }

  private async persistSessionToken(userId: string, sessionId: string, token: string): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update({
        session_token: this.hashToken(token),
        expires_at: new Date(Date.now() + parseDurationToMs(config.jwt.expiresIn)).toISOString(),
        last_activity_at: new Date().toISOString(),
        is_active: true,
      })
      .eq('id', sessionId)
      .eq('user_id', userId)

    if (error) {
      throw new AppError('Failed to refresh session', 500, 'SESSION_REFRESH_FAILED')
    }
  }

  private async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false })

    if (error || !sessions || sessions.length <= config.session.maxConcurrentSessions) {
      return
    }

    const overflowIds = sessions
      .slice(config.session.maxConcurrentSessions)
      .map(session => session.id)

    if (overflowIds.length > 0) {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .in('id', overflowIds)
        .eq('user_id', userId)
    }
  }

  private generateToken(payload: TokenPayload): string {
    const signOptions: SignOptions = {}
    signOptions.expiresIn = config.jwt.expiresIn as NonNullable<SignOptions['expiresIn']>

    return jwt.sign(payload, config.jwt.secret, signOptions)
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }
}

export const authService = new AuthService()
