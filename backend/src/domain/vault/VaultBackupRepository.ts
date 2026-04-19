import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { NotFoundError } from '@/security/errors'
import { NormalizedVault, VaultBackupSummary } from './types'

type ScopedClient = SupabaseClient<Database>

export class VaultBackupRepository {
  constructor(private readonly scopedClient: ScopedClient) {}

  async createBackup(userId: string, vault: NormalizedVault): Promise<VaultBackupSummary> {
    if (vault.storageMode === 'credentials') {
      const { data, error } = await this.scopedClient
        .from('credential_backups')
        .insert({
          user_id: userId,
          credential_id: vault.id,
          enc_blob: vault.encryptedData,
          backup_type: 'manual',
        })
        .select('id, backup_type, created_at')
        .maybeSingle()

      if (error || !data) {
        throw error
      }

      return {
        id: data.id,
        backupType: data.backup_type,
        createdAt: data.created_at,
      }
    }

    const { data, error } = await this.scopedClient
      .from('vault_backups')
      .insert({
        user_id: userId,
        vault_id: vault.id,
        encrypted_data: JSON.parse(vault.encryptedData),
        backup_type: 'manual',
      })
      .select('id, backup_type, created_at')
      .maybeSingle()

    if (error || !data) {
      throw error
    }

    return {
      id: data.id,
      backupType: data.backup_type,
      createdAt: data.created_at,
    }
  }

  async listBackups(userId: string, storageMode: 'credentials' | 'vaults', limit: number): Promise<VaultBackupSummary[]> {
    if (storageMode === 'vaults') {
      const { data, error } = await this.scopedClient
        .from('vault_backups')
        .select('id, backup_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw error
      }

      return (data ?? []).map((item) => ({
        id: item.id,
        backupType: item.backup_type,
        createdAt: item.created_at,
      }))
    }

    const { data, error } = await this.scopedClient
      .from('credential_backups')
      .select('id, backup_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      backupType: item.backup_type,
      createdAt: item.created_at,
    }))
  }

  async getCredentialBackup(userId: string, backupId: string): Promise<{ id: string; encBlob: string }> {
    const { data, error } = await this.scopedClient
      .from('credential_backups')
      .select('id, enc_blob')
      .eq('id', backupId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data?.enc_blob) {
      throw new NotFoundError('Backup not found')
    }

    return {
      id: data.id,
      encBlob: data.enc_blob,
    }
  }

  async getLegacyBackup(userId: string, backupId: string): Promise<{ id: string; encryptedData: string }> {
    const { data, error } = await this.scopedClient
      .from('vault_backups')
      .select('id, encrypted_data')
      .eq('id', backupId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      throw new NotFoundError('Backup not found')
    }

    return {
      id: data.id,
      encryptedData: JSON.stringify(data.encrypted_data),
    }
  }
}
