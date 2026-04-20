import { Request } from 'express'
import { getPrivilegedSupabase } from '@/config/privilegedDb'
import { AppError, NotFoundError, UnauthorizedError } from '@/security/errors'
import type { Database } from '@/types/database'

export interface AuthenticatedRequestUser {
  userId: string
  email: string
  sessionId: string
}

export interface SupabaseAuthenticatedRequestUser {
  userId: string
  email: string
}

type OwnedResourceArgs = {
  table: string
  id: string
  userId: string
  select?: string
  idColumn?: string
  userColumn?: string
}

export const requireAuthenticatedUser = (req: Request): AuthenticatedRequestUser => {
  if (!req.user?.userId || !req.user.email || !req.user.sessionId) {
    throw new UnauthorizedError()
  }

  return {
    userId: req.user.userId,
    email: req.user.email,
    sessionId: req.user.sessionId,
  }
}

export const requireSupabaseAuthenticatedUser = (req: Request): SupabaseAuthenticatedRequestUser => {
  if (!req.supabaseUser?.userId || !req.supabaseUser.email) {
    throw new UnauthorizedError()
  }

  return {
    userId: req.supabaseUser.userId,
    email: req.supabaseUser.email,
  }
}

export const requireOwnedResource = async <T>({
  table,
  id,
  userId,
  select = '*',
  idColumn = 'id',
  userColumn = 'user_id',
}: OwnedResourceArgs): Promise<T> => {
  const { data, error } = await getPrivilegedSupabase()
    .from(table as keyof Database['public']['Tables'])
    .select(select)
    .eq(idColumn, id)
    .eq(userColumn, userId)
    .maybeSingle()

  if (error) {
    throw new AppError('Failed to validate resource ownership', 500, 'AUTHORIZATION_LOOKUP_FAILED', {
      expose: false,
      details: { table, idColumn },
      cause: error,
    })
  }

  if (!data) {
    throw new NotFoundError()
  }

  return data as T
}
