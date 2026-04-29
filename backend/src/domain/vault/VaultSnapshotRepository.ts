import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Json } from '@/types/database'
import { ConflictError, ValidationError } from '@/security/errors'
import { NormalizedVault } from './types'

type ScopedClient = SupabaseClient<Database>

const parseJsonVaultPayload = (value: string): Json => {
  try {
    return JSON.parse(value) as Json
  } catch {
    throw new ValidationError('Legacy vault payload must be valid JSON')
  }
}

const normalizeCredentialVault = (record: any): NormalizedVault => ({
  id: record.id,
  encryptedData: record.enc_blob,
  dataHash: record.data_hash,
  version: record.version ?? 1,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
  storageMode: 'credentials',
})

const normalizeLegacyVault = (record: any): NormalizedVault => ({
  id: record.id,
  encryptedData: JSON.stringify(record.encrypted_data),
  dataHash: record.data_hash,
  version: record.version ?? 1,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
  storageMode: 'vaults',
})

export class VaultSnapshotRepository {
  constructor(private readonly scopedClient: ScopedClient) {}

  async getCurrentVault(userId: string): Promise<NormalizedVault | null> {
    const credentialVault = await this.getCredentialVault(userId)
    if (credentialVault?.enc_blob) {
      return normalizeCredentialVault(credentialVault)
    }

    const legacyVault = await this.getLegacyVault(userId)
    if (legacyVault) {
      return normalizeLegacyVault(legacyVault)
    }

    return null
  }

  async createCredentialVault(userId: string, encryptedData: string, dataHash: string): Promise<NormalizedVault> {
    const { data, error } = await this.scopedClient
      .from('credentials')
      .insert({
        user_id: userId,
        title: 'vault',
        encrypted_password: 'enc_blob_mode',
        enc_blob: encryptedData,
        data_hash: dataHash,
        version: 1,
      })
      .select('id, user_id, enc_blob, data_hash, version, created_at, updated_at')
      .maybeSingle()

    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictError('Vault already exists')
      }

      throw error
    }

    return normalizeCredentialVault(data)
  }

  async updateCredentialVault(
    userId: string,
    currentVault: NormalizedVault,
    encryptedData: string,
    dataHash: string,
    expectedVersion: number,
  ): Promise<NormalizedVault> {
    const { data, error } = await this.scopedClient
      .from('credentials')
      .update({
        enc_blob: encryptedData,
        data_hash: dataHash,
        version: currentVault.version + 1,
      })
      .eq('id', currentVault.id)
      .eq('user_id', userId)
      .eq('version', expectedVersion)
      .select('id, user_id, enc_blob, data_hash, version, created_at, updated_at')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new ConflictError('Vault version conflict detected')
    }

    return normalizeCredentialVault(data)
  }

  async createLegacyVault(userId: string, encryptedData: string, dataHash: string): Promise<NormalizedVault> {
    const { data, error } = await this.scopedClient
      .from('vaults')
      .insert({
        user_id: userId,
        encrypted_data: parseJsonVaultPayload(encryptedData),
        data_hash: dataHash,
        version: 1,
      })
      .select('*')
      .maybeSingle()

    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictError('Vault already exists')
      }

      throw error
    }

    return normalizeLegacyVault(data)
  }

  async updateLegacyVault(
    userId: string,
    currentVault: NormalizedVault,
    encryptedData: string,
    dataHash: string,
    expectedVersion: number,
  ): Promise<NormalizedVault> {
    const { data, error } = await this.scopedClient
      .from('vaults')
      .update({
        encrypted_data: parseJsonVaultPayload(encryptedData),
        data_hash: dataHash,
        version: currentVault.version + 1,
      })
      .eq('id', currentVault.id)
      .eq('user_id', userId)
      .eq('version', expectedVersion)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new ConflictError('Vault version conflict detected')
    }

    return normalizeLegacyVault(data)
  }

  async clearVault(userId: string, currentVault: NormalizedVault, expectedVersion: number): Promise<void> {
    if (currentVault.storageMode === 'credentials') {
      const { data, error } = await this.scopedClient
        .from('credentials')
        .update({
          enc_blob: null,
          data_hash: null,
          version: currentVault.version + 1,
        })
        .eq('id', currentVault.id)
        .eq('user_id', userId)
        .eq('version', expectedVersion)
        .select('id')
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data) {
        throw new ConflictError('Vault version conflict detected')
      }
      return
    }

    const { data, error } = await this.scopedClient
      .from('vaults')
      .delete()
      .eq('id', currentVault.id)
      .eq('user_id', userId)
      .eq('version', expectedVersion)
      .select('id')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new ConflictError('Vault version conflict detected')
    }
  }

  async restoreCredentialSnapshot(
    userId: string,
    currentVault: NormalizedVault | null,
    encryptedData: string,
    dataHash: string,
    expectedVersion?: number,
  ): Promise<NormalizedVault> {
    if (!currentVault) {
      return this.createCredentialVault(userId, encryptedData, dataHash)
    }

    if (expectedVersion === undefined) {
      throw new ConflictError('Vault restore requires expected version')
    }

    return this.updateCredentialVault(userId, currentVault, encryptedData, dataHash, expectedVersion)
  }

  async restoreLegacySnapshot(
    userId: string,
    currentVault: NormalizedVault | null,
    encryptedData: string,
    dataHash: string,
    expectedVersion?: number,
  ): Promise<NormalizedVault> {
    if (!currentVault) {
      return this.createLegacyVault(userId, encryptedData, dataHash)
    }

    if (expectedVersion === undefined) {
      throw new ConflictError('Vault restore requires expected version')
    }

    return this.updateLegacyVault(userId, currentVault, encryptedData, dataHash, expectedVersion)
  }

  private async getCredentialVault(userId: string): Promise<any | null> {
    const { data, error } = await this.scopedClient
      .from('credentials')
      .select('id, user_id, enc_blob, data_hash, version, created_at, updated_at')
      .eq('user_id', userId)
      .not('enc_blob', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    return data?.[0] ?? null
  }

  private async getLegacyVault(userId: string): Promise<any | null> {
    const { data, error } = await this.scopedClient
      .from('vaults')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data
  }
}
