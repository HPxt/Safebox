import { getPrivilegedSupabase } from '@/config/privilegedDb'
import { Vault, VaultInsert, VaultBackup } from '@/types/database'
import { logger, logAuditEvent } from '@/utils/logger'
import crypto from 'crypto'

/**
 * @deprecated Legacy implementation — bypasses RLS (service_role) and lacks optimistic locking on some paths.
 * Runtime API uses VaultSnapshotService with a user-scoped Supabase client (see vault.routes).
 */
export class VaultService {
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown vault service error'
  }

  /**
   * Get user's vault
   */
  async getVault(userId: string): Promise<Vault | null> {
    try {
      const { data, error } = await getPrivilegedSupabase()
        .from('vaults')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No vault found - this is normal for new users
          return null
        }
        logger.error('Failed to fetch vault', {
          code: error.code,
          message: error.message,
        })
        throw new Error('Failed to fetch vault')
      }

      // Log vault access
      await logAuditEvent('vault_unlock', userId, {
        event: 'vault_accessed',
        vaultId: data.id,
      })

      return data
    } catch (error) {
      logger.error('Get vault error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Create new vault for user
   */
  async createVault(userId: string, encryptedData: any, dataHash: string): Promise<Vault> {
    try {
      const vaultData: VaultInsert = {
        user_id: userId,
        encrypted_data: encryptedData,
        data_hash: dataHash,
        version: 1,
      }

      const { data, error } = await getPrivilegedSupabase()
        .from('vaults')
        .insert(vaultData)
        .select()
        .single()

      if (error) {
        logger.error('Failed to create vault', {
          code: error.code,
          message: error.message,
        })
        throw new Error('Failed to create vault')
      }

      // Log vault creation
      await logAuditEvent('credential_created', userId, {
        event: 'vault_created',
        vaultId: data.id,
      })

      logger.info('Vault created successfully', { vaultId: data.id })
      return data
    } catch (error) {
      logger.error('Create vault error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Update vault data
   */
  async updateVault(userId: string, encryptedData: any, dataHash: string): Promise<Vault> {
    try {
      // First, get the current vault to create a backup
      const currentVault = await this.getVault(userId)
      if (!currentVault) {
        throw new Error('Vault not found')
      }

      // Verify data integrity
      if (!this.verifyDataHash(encryptedData, dataHash)) {
        throw new Error('Data integrity check failed')
      }

      // Update vault
      const { data, error } = await getPrivilegedSupabase()
        .from('vaults')
        .update({
          encrypted_data: encryptedData,
          data_hash: dataHash,
          version: currentVault.version + 1,
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update vault', {
          code: error.code,
          message: error.message,
        })
        throw new Error('Failed to update vault')
      }

      // Log vault update
      await logAuditEvent('credential_updated', userId, {
        event: 'vault_updated',
        vaultId: data.id,
        previousVersion: currentVault.version,
        newVersion: data.version,
      })

      logger.info('Vault updated successfully', {
        vaultId: data.id,
        version: data.version 
      })

      return data
    } catch (error) {
      logger.error('Update vault error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Delete vault (soft delete by clearing data)
   */
  async deleteVault(userId: string): Promise<void> {
    try {
      const { error } = await getPrivilegedSupabase()
        .from('vaults')
        .delete()
        .eq('user_id', userId)

      if (error) {
        logger.error('Failed to delete vault', {
          code: error.code,
          message: error.message,
        })
        throw new Error('Failed to delete vault')
      }

      // Log vault deletion
      await logAuditEvent('credential_deleted', userId, {
        event: 'vault_deleted',
      })

      logger.info('Vault deleted successfully')
    } catch (error) {
      logger.error('Delete vault error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Create manual backup of vault
   */
  async createBackup(userId: string, backupType: string = 'manual'): Promise<VaultBackup> {
    try {
      const vault = await this.getVault(userId)
      if (!vault) {
        throw new Error('No vault found to backup')
      }

      const { data, error } = await getPrivilegedSupabase()
        .from('vault_backups')
        .insert({
          user_id: userId,
          vault_id: vault.id,
          encrypted_data: vault.encrypted_data,
          backup_type: backupType,
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create backup', {
          code: error.code,
          message: error.message,
        })
        throw new Error('Failed to create backup')
      }

      logger.info('Backup created successfully', {
        backupId: data.id, 
        backupType 
      })

      return data
    } catch (error) {
      logger.error('Create backup error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Get vault backups
   */
  async getBackups(userId: string, limit: number = 10): Promise<VaultBackup[]> {
    try {
      const { data, error } = await getPrivilegedSupabase()
        .from('vault_backups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        logger.error('Failed to fetch backups', {
          code: error.code,
          message: error.message,
        })
        throw new Error('Failed to fetch backups')
      }

      return data || []
    } catch (error) {
      logger.error('Get backups error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Restore vault from backup
   */
  async restoreFromBackup(userId: string, backupId: string): Promise<Vault> {
    try {
      // Get backup data
      const { data: backup, error: backupError } = await getPrivilegedSupabase()
        .from('vault_backups')
        .select('*')
        .eq('id', backupId)
        .eq('user_id', userId)
        .single()

      if (backupError) {
        logger.error('Failed to fetch backup', {
          code: backupError.code,
          message: backupError.message,
        })
        throw new Error('Backup not found')
      }

      // Calculate hash for the backup data
      const dataHash = this.calculateDataHash(backup.encrypted_data)

      // Update vault with backup data
      const restoredVault = await this.updateVault(userId, backup.encrypted_data, dataHash)

      // Log restore event
      await logAuditEvent('credential_updated', userId, {
        event: 'vault_restored',
        backupId,
        vaultId: restoredVault.id,
      })

      logger.info('Vault restored from backup', {
        backupId, 
        vaultId: restoredVault.id 
      })

      return restoredVault
    } catch (error) {
      logger.error('Restore from backup error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Get vault statistics
   */
  async getVaultStats(userId: string): Promise<{
    hasVault: boolean
    version: number
    lastUpdated: string | null
    backupCount: number
    dataSize: number
  }> {
    try {
      const vault = await this.getVault(userId)
      const backups = await this.getBackups(userId)

      return {
        hasVault: !!vault,
        version: vault?.version || 0,
        lastUpdated: vault?.updated_at || null,
        backupCount: backups.length,
        dataSize: vault ? JSON.stringify(vault.encrypted_data).length : 0,
      }
    } catch (error) {
      logger.error('Get vault stats error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }

  /**
   * Verify data integrity using hash
   */
  private verifyDataHash(data: any, expectedHash: string): boolean {
    const calculatedHash = this.calculateDataHash(data)
    return calculatedHash === expectedHash
  }

  /**
   * Calculate SHA-256 hash of data
   */
  private calculateDataHash(data: any): string {
    const dataString = JSON.stringify(data)
    return crypto.createHash('sha256').update(dataString).digest('hex')
  }

  /**
   * Clean up old backups (keep only the most recent ones)
   */
  async cleanupOldBackups(userId: string, keepCount: number = 10): Promise<void> {
    try {
      // Get all backups for user
      const { data: allBackups, error } = await getPrivilegedSupabase()
        .from('vault_backups')
        .select('id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to fetch backups for cleanup', {
          code: error.code,
          message: error.message,
        })
        return
      }

      if (allBackups && allBackups.length > keepCount) {
        const backupsToDelete = allBackups.slice(keepCount)
        const idsToDelete = backupsToDelete.map(b => b.id)

        const { error: deleteError } = await getPrivilegedSupabase()
          .from('vault_backups')
          .delete()
          .in('id', idsToDelete)

        if (deleteError) {
          logger.error('Failed to delete old backups', {
            code: deleteError.code,
            message: deleteError.message,
          })
        } else {
          logger.info('Old backups cleaned up', {
            deletedCount: idsToDelete.length 
          })
        }
      }
    } catch (error) {
      logger.error('Cleanup old backups error', {
        message: this.getErrorMessage(error),
      })
    }
  }

  /**
   * Export vault data (for user download)
   */
  async exportVault(userId: string): Promise<{
    vault: Vault
    backups: VaultBackup[]
    exportedAt: string
  }> {
    try {
      const vault = await this.getVault(userId)
      if (!vault) {
        throw new Error('No vault found to export')
      }

      const backups = await this.getBackups(userId, 5) // Last 5 backups

      // Log export event
      await logAuditEvent('credential_updated', userId, {
        event: 'vault_exported',
        vaultId: vault.id,
      })

      return {
        vault,
        backups,
        exportedAt: new Date().toISOString(),
      }
    } catch (error) {
      logger.error('Export vault error', {
        message: this.getErrorMessage(error),
      })
      throw error
    }
  }
}

