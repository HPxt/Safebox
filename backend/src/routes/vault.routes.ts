import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseUserClient, supabaseAdmin } from '@/config/database'
import { VaultBackupRepository } from '@/domain/vault/VaultBackupRepository'
import { VaultSnapshotRepository } from '@/domain/vault/VaultSnapshotRepository'
import { VaultSnapshotService } from '@/domain/vault/VaultSnapshotService'
import { authenticateSupabaseAccessToken } from '@/middleware/auth.middleware'
import { vaultRateLimit } from '@/middleware/rateLimiting.middleware'
import { requireSupabaseAuthenticatedUser } from '@/security/authorization'
import { asyncHandler, sendSuccess } from '@/security/http'
import { parseIntegerQuery, validateWithSchema } from '@/security/validation'

const router = Router()

const createVaultService = (authToken: string) => {
  const scopedClient = createSupabaseUserClient(authToken)
  const vaultRepository = new VaultSnapshotRepository(scopedClient)
  const backupRepository = new VaultBackupRepository(scopedClient)

  return new VaultSnapshotService(vaultRepository, backupRepository)
}

const vaultCreateSchema = z.object({
  encryptedData: z.string().min(1).max(1_500_000),
  dataHash: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid data hash'),
}).strict()

const vaultUpdateSchema = vaultCreateSchema.extend({
  expectedVersion: z.number().int().min(1),
}).strict()

const vaultDeleteSchema = z.object({
  expectedVersion: z.number().int().min(1),
}).strict()

const backupIdSchema = z.object({
  backupId: z.string().uuid('Invalid backup id'),
}).strict()

const restoreSchema = z.object({
  expectedVersion: z.number().int().min(1).optional(),
}).strict()

const logVaultAudit = async (
  userId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  ipAddress: string | undefined,
  userAgent: string | undefined,
) => {
  await supabaseAdmin.rpc('log_audit_event', {
    p_user_id: userId,
    p_event_type: eventType,
    p_event_data: eventData,
    p_ip_address: ipAddress,
    p_user_agent: userAgent,
  })
}

router.use(vaultRateLimit)

router.get('/', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const vaultService = createVaultService(req.authToken!)
  const vault = await vaultService.getCurrentVault(user.userId)

  sendSuccess(res, { data: vault })
}))

router.post('/', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const payload = validateWithSchema(vaultCreateSchema, req.body)
  const vaultService = createVaultService(req.authToken!)
  const createdVault = await vaultService.createVault(user.userId, payload)

  await logVaultAudit(
    user.userId,
    'credential_created',
    {
      event: 'vault_created',
      storageMode: createdVault.storageMode,
      version: createdVault.version,
    },
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    statusCode: 201,
    data: createdVault,
    message: 'Vault created successfully',
  })
}))

router.put('/', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const payload = validateWithSchema(vaultUpdateSchema, req.body)
  const vaultService = createVaultService(req.authToken!)
  const updatedVault = await vaultService.updateVault(user.userId, payload)

  await logVaultAudit(
    user.userId,
    'credential_updated',
    {
      event: 'vault_updated',
      storageMode: updatedVault.storageMode,
      version: updatedVault.version,
    },
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    data: updatedVault,
    message: 'Vault updated successfully',
  })
}))

router.delete('/', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const { expectedVersion } = validateWithSchema(vaultDeleteSchema, req.body)
  const vaultService = createVaultService(req.authToken!)
  const deletedVault = await vaultService.deleteVault(user.userId, expectedVersion)

  await logVaultAudit(
    user.userId,
    'credential_deleted',
    {
      event: 'vault_deleted',
      storageMode: deletedVault.storageMode,
      version: deletedVault.version,
    },
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    message: 'Vault deleted successfully',
  })
}))

router.get('/stats', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const vaultService = createVaultService(req.authToken!)
  const stats = await vaultService.getStats(user.userId)

  sendSuccess(res, { data: stats })
}))

router.post('/backup', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const vaultService = createVaultService(req.authToken!)
  const { vault, backup } = await vaultService.createBackup(user.userId)

  await logVaultAudit(
    user.userId,
    'credential_updated',
    {
      event: 'vault_backup_created',
      backupId: backup.id,
      storageMode: vault.storageMode,
      version: vault.version,
    },
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    statusCode: 201,
    data: backup,
    message: 'Backup created successfully',
  })
}))

router.get('/backups', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const limit = parseIntegerQuery(req.query['limit'], {
    defaultValue: 10,
    min: 1,
    max: 100,
    fieldName: 'limit',
  })
  const vaultService = createVaultService(req.authToken!)
  const backups = await vaultService.listBackups(user.userId, limit)

  sendSuccess(res, { data: backups })
}))

router.post('/restore/:backupId', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const { backupId } = validateWithSchema(backupIdSchema, req.params)
  const { expectedVersion } = validateWithSchema(restoreSchema, req.body ?? {})
  const vaultService = createVaultService(req.authToken!)
  const restoredVault = await vaultService.restoreBackup(user.userId, backupId, expectedVersion)

  await logVaultAudit(
    user.userId,
    'credential_updated',
    {
      event: 'vault_restored',
      backupId,
      storageMode: restoredVault.storageMode,
      version: restoredVault.version,
    },
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, {
    data: restoredVault,
    message: 'Vault restored successfully',
  })
}))

router.get('/export', authenticateSupabaseAccessToken, asyncHandler(async (req, res) => {
  const user = requireSupabaseAuthenticatedUser(req)
  const vaultService = createVaultService(req.authToken!)
  const exportedVault = await vaultService.exportVault(user.userId)

  await logVaultAudit(
    user.userId,
    'credential_updated',
    {
      event: 'vault_exported',
      storageMode: exportedVault.vault.storageMode,
      version: exportedVault.vault.version,
    },
    req.ip,
    req.get('User-Agent'),
  )

  sendSuccess(res, { data: exportedVault })
}))

export default router
