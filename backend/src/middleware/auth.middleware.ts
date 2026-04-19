import { Request, Response, NextFunction } from 'express'
import { authService } from '@/services/auth.service'
import { createSupabaseAuthClient } from '@/config/database'
import { logger } from '@/utils/logger'

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
        sessionId: string
      }
      supabaseUser?: {
        userId: string
        email: string
      }
      authToken?: string
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
      })
      return
    }

    // Verify token
    const decoded = await authService.verifyToken(token)
    req.user = decoded
    req.authToken = token

    next()
  } catch (error) {
    logger.error('Authentication failed:', error)
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
    })
  }
}

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (token) {
      try {
        const decoded = await authService.verifyToken(token)
        req.user = decoded
        req.authToken = token
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.warn('Invalid token in optional auth:', error)
      }
    }

    next()
  } catch (error) {
    logger.error('Optional auth error:', error)
    next()
  }
}

export const authenticateSupabaseAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Supabase access token required',
      })
      return
    }

    const authClient = createSupabaseAuthClient()
    const { data, error } = await authClient.auth.getUser(token)

    if (error || !data.user?.id || !data.user.email) {
      res.status(403).json({
        success: false,
        error: 'Invalid Supabase session',
      })
      return
    }

    req.supabaseUser = {
      userId: data.user.id,
      email: data.user.email,
    }
    req.authToken = token
    next()
  } catch (error) {
    logger.error('Supabase authentication failed:', error)
    res.status(403).json({
      success: false,
      error: 'Invalid or expired Supabase session',
    })
  }
}

/**
 * Admin authentication middleware
 * Requires admin privileges (placeholder for future implementation)
 */
export const requireAdmin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
      return
    }

    res.status(403).json({
      success: false,
      error: 'Admin authorization is not configured',
    })
  } catch (error) {
    logger.error('Admin auth error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
} 
