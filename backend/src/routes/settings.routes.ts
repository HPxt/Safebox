import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseUserClient } from '@/config/database'
import { authenticateSupabaseAccessToken } from '@/middleware/auth.middleware'
import { logPrivilegedAuditEvent } from '@/security/audit'
import { requireSupabaseAuthenticatedUser } from '@/security/authorization'
import { ConflictError, NotFoundError } from '@/security/errors'
import { asyncHandler, sendSuccess } from '@/security/http'
import { parseIntegerQuery, validateWithSchema } from '@/security/validation'

const router: Router = Router()

const settingsSchema = z.object({
  security: z.object({
    sessionTimeout: z.number().int().min(5).max(120).optional(),
    autoLock: z.boolean().optional(),
    requireConfirm: z.boolean().optional(),
    showHiddenCredentials: z.boolean().optional(),
    clipboardTimeout: z.number().int().min(5).max(300).optional(),
  }).optional(),
  generator: z.object({
    defaultLength: z.number().int().min(8).max(128).optional(),
    useLowercase: z.boolean().optional(),
    useUppercase: z.boolean().optional(),
    useNumbers: z.boolean().optional(),
    useSymbols: z.boolean().optional(),
    excludeAmbiguous: z.boolean().optional(),
  }).optional(),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.enum(['pt-BR', 'en-US']).optional(),
    compactMode: z.boolean().optional(),
    showStrength: z.boolean().optional(),
  }).optional(),
}).strict()

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format'),
  icon: z.string().trim().min(1).max(50).optional(),
}).strict()

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
  icon: z.string().trim().min(1).max(50).optional(),
}).strict()

const idSchema = z.object({
  id: z.string().uuid('Invalid resource id'),
}).strict()

const mapSettings = (settings: any) => ({
  security: {
    sessionTimeout: settings.session_timeout,
    autoLock: settings.auto_lock,
    requireConfirm: settings.require_confirm,
    showHiddenCredentials: settings.show_hidden_credentials,
    clipboardTimeout: settings.clipboard_timeout,
  },
  generator: {
    defaultLength: settings.default_length,
    useLowercase: settings.use_lowercase,
    useUppercase: settings.use_uppercase,
    useNumbers: settings.use_numbers,
    useSymbols: settings.use_symbols,
    excludeAmbiguous: settings.exclude_ambiguous,
  },
  ui: {
    theme: settings.theme,
    language: settings.language,
    compactMode: settings.compact_mode,
    showStrength: settings.show_strength,
  },
  createdAt: settings.created_at,
  updatedAt: settings.updated_at,
})

const createScopedClient = (authToken: string) => createSupabaseUserClient(authToken)

router.get('/', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)

  const { data, error } = await scopedClient
    .from('user_settings')
    .select('*')
    .eq('user_id', user.userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  sendSuccess(res, {
    data: data ? mapSettings(data) : null,
  })
}))

router.put('/', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { security, generator, ui } = validateWithSchema(settingsSchema, req.body)

  const updateData = {
    ...(security?.sessionTimeout !== undefined ? { session_timeout: security.sessionTimeout } : {}),
    ...(security?.autoLock !== undefined ? { auto_lock: security.autoLock } : {}),
    ...(security?.requireConfirm !== undefined ? { require_confirm: security.requireConfirm } : {}),
    ...(security?.showHiddenCredentials !== undefined ? { show_hidden_credentials: security.showHiddenCredentials } : {}),
    ...(security?.clipboardTimeout !== undefined ? { clipboard_timeout: security.clipboardTimeout } : {}),
    ...(generator?.defaultLength !== undefined ? { default_length: generator.defaultLength } : {}),
    ...(generator?.useLowercase !== undefined ? { use_lowercase: generator.useLowercase } : {}),
    ...(generator?.useUppercase !== undefined ? { use_uppercase: generator.useUppercase } : {}),
    ...(generator?.useNumbers !== undefined ? { use_numbers: generator.useNumbers } : {}),
    ...(generator?.useSymbols !== undefined ? { use_symbols: generator.useSymbols } : {}),
    ...(generator?.excludeAmbiguous !== undefined ? { exclude_ambiguous: generator.excludeAmbiguous } : {}),
    ...(ui?.theme !== undefined ? { theme: ui.theme } : {}),
    ...(ui?.language !== undefined ? { language: ui.language } : {}),
    ...(ui?.compactMode !== undefined ? { compact_mode: ui.compactMode } : {}),
    ...(ui?.showStrength !== undefined ? { show_strength: ui.showStrength } : {}),
  }

  const { data, error } = await scopedClient
    .from('user_settings')
    .upsert({
      user_id: user.userId,
      ...updateData,
    }, {
      onConflict: 'user_id',
    })
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  await logPrivilegedAuditEvent({
    userId: user.userId,
    eventType: 'settings_updated',
    eventData: {
      event: 'user_settings_updated',
      updatedFields: Object.keys(updateData),
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  })

  sendSuccess(res, {
    data: mapSettings(data),
    message: 'Settings updated successfully',
  })
}))

router.get('/categories', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)

  const { data, error } = await scopedClient
    .from('categories')
    .select('*')
    .eq('user_id', user.userId)
    .order('name')

  if (error) {
    throw error
  }

  sendSuccess(res, { data: data ?? [] })
}))

router.post('/categories', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { name, color, icon } = validateWithSchema(categoryCreateSchema, req.body)

  const { data, error } = await scopedClient
    .from('categories')
    .insert({
      user_id: user.userId,
      name,
      color,
      icon: icon ?? 'folder',
    })
    .select('*')
    .maybeSingle()

  if (error?.code === '23505') {
    throw new ConflictError('Category name already exists')
  }

  if (error || !data) {
    throw error
  }

  sendSuccess(res, {
    statusCode: 201,
    data,
    message: 'Category created successfully',
  })
}))

router.put('/categories/:id', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { id } = validateWithSchema(idSchema, req.params)
  const updates = validateWithSchema(categoryUpdateSchema, req.body)

  const { data, error } = await scopedClient
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.userId)
    .select('*')
    .maybeSingle()

  if (error?.code === '23505') {
    throw new ConflictError('Category name already exists')
  }

  if (error) {
    throw error
  }

  if (!data) {
    throw new NotFoundError('Category not found')
  }

  sendSuccess(res, {
    data,
    message: 'Category updated successfully',
  })
}))

router.delete('/categories/:id', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { id } = validateWithSchema(idSchema, req.params)

  const { data, error } = await scopedClient
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new NotFoundError('Category not found')
  }

  sendSuccess(res, {
    message: 'Category deleted successfully',
  })
}))

router.get('/audit-logs', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const page = parseIntegerQuery(req.query['page'], {
    defaultValue: 1,
    min: 1,
    max: 1000,
    fieldName: 'page',
  })
  const limit = parseIntegerQuery(req.query['limit'], {
    defaultValue: 20,
    min: 1,
    max: 100,
    fieldName: 'limit',
  })
  const offset = (page - 1) * limit

  const { data, error } = await scopedClient
    .from('audit_logs')
    .select('id, event_type, event_data, ip_address, created_at')
    .eq('user_id', user.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw error
  }

  const { count, error: countError } = await scopedClient
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.userId)

  if (countError) {
    throw countError
  }

  sendSuccess(res, {
    data: data ?? [],
    extra: {
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    },
  })
}))

router.get('/sessions', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)

  const { data, error } = await scopedClient
    .from('user_sessions')
    .select('id, ip_address, user_agent, created_at, last_activity_at, is_active, expires_at')
    .eq('user_id', user.userId)
    .eq('is_active', true)
    .order('last_activity_at', { ascending: false })

  if (error) {
    throw error
  }

  sendSuccess(res, { data: data ?? [] })
}))

router.delete('/sessions/:id', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const scopedClient = createScopedClient(req.authToken!)
  const { id } = validateWithSchema(idSchema, req.params)

  const { data, error } = await scopedClient
    .from('user_sessions')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', user.userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new NotFoundError('Session not found')
  }

  sendSuccess(res, {
    message: 'Session revoked successfully',
  })
}))

export default router
