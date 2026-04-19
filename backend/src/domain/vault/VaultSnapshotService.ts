import crypto from 'crypto'
import { ConflictError, NotFoundError, ValidationError } from '@/security/errors'
import { VaultBackupRepository } from './VaultBackupRepository'
import { VaultSnapshotRepository } from './VaultSnapshotRepository'
import {
  NormalizedVault,
  VaultBackupSummary,
  VaultExportBundle,
  VaultWritePayload,
} from './types'

export class VaultSnapshotService {
  constructor(
    private readonly vaultRepository: VaultSnapshotRepository,
    private readonly backupRepository: VaultBackupRepository,
  ) {}

  getCurrentVault(userId: string): Promise<NormalizedVault | null> {
    return this.vaultRepository.getCurrentVault(userId)
  }

  async createVault(userId: string, payload: VaultWritePayload): Promise<NormalizedVault> {
    this.ensureHashMatches(payload.encryptedData, payload.dataHash)

    const existingVault = await this.vaultRepository.getCurrentVault(userId)
    if (existingVault) {
      throw new ConflictError('Vault already exists')
    }

    return this.vaultRepository.createCredentialVault(userId, payload.encryptedData, payload.dataHash)
  }

  async updateVault(userId: string, payload: VaultWritePayload): Promise<NormalizedVault> {
    this.ensureHashMatches(payload.encryptedData, payload.dataHash)

    if (payload.expectedVersion === undefined) {
      throw new ValidationError('expectedVersion is required for vault updates')
    }

    const currentVault = await this.vaultRepository.getCurrentVault(userId)
    if (!currentVault) {
      throw new NotFoundError('Vault not found')
    }

    return currentVault.storageMode === 'credentials'
      ? this.vaultRepository.updateCredentialVault(
          userId,
          currentVault,
          payload.encryptedData,
          payload.dataHash,
          payload.expectedVersion,
        )
      : this.vaultRepository.updateLegacyVault(
          userId,
          currentVault,
          payload.encryptedData,
          payload.dataHash,
          payload.expectedVersion,
        )
  }

  async deleteVault(userId: string, expectedVersion?: number): Promise<NormalizedVault> {
    if (expectedVersion === undefined) {
      throw new ValidationError('expectedVersion is required for vault deletion')
    }

    const currentVault = await this.vaultRepository.getCurrentVault(userId)
    if (!currentVault) {
      throw new NotFoundError('Vault not found')
    }

    await this.vaultRepository.clearVault(userId, currentVault, expectedVersion)
    return currentVault
  }

  async getStats(userId: string): Promise<{
    hasVault: boolean
    version: number
    backupCount: number
    storageMode: string
    lastUpdated: string | null
    dataSizeBytes: number
  }> {
    const vault = await this.vaultRepository.getCurrentVault(userId)
    const backups = await this.backupRepository.listBackups(userId, vault?.storageMode ?? 'credentials', 100)

    return {
      hasVault: Boolean(vault),
      version: vault?.version ?? 0,
      backupCount: backups.length,
      storageMode: vault?.storageMode ?? 'credentials',
      lastUpdated: vault?.updatedAt ?? null,
      dataSizeBytes: vault ? Buffer.byteLength(vault.encryptedData, 'utf8') : 0,
    }
  }

  async createBackup(userId: string): Promise<{ vault: NormalizedVault; backup: VaultBackupSummary }> {
    const vault = await this.vaultRepository.getCurrentVault(userId)
    if (!vault) {
      throw new NotFoundError('No vault found to back up')
    }

    const backup = await this.backupRepository.createBackup(userId, vault)
    return { vault, backup }
  }

  async listBackups(userId: string, limit: number): Promise<VaultBackupSummary[]> {
    const currentVault = await this.vaultRepository.getCurrentVault(userId)
    return this.backupRepository.listBackups(userId, currentVault?.storageMode ?? 'credentials', limit)
  }

  async restoreBackup(userId: string, backupId: string, expectedVersion?: number): Promise<NormalizedVault> {
    const currentVault = await this.vaultRepository.getCurrentVault(userId)
    const storageMode = currentVault?.storageMode ?? 'credentials'

    if (storageMode === 'credentials') {
      const backup = await this.backupRepository.getCredentialBackup(userId, backupId)
      const dataHash = this.calculateHash(backup.encBlob)
      return this.vaultRepository.restoreCredentialSnapshot(
        userId,
        currentVault,
        backup.encBlob,
        dataHash,
        expectedVersion,
      )
    }

    const backup = await this.backupRepository.getLegacyBackup(userId, backupId)
    const dataHash = this.calculateHash(backup.encryptedData)
    return this.vaultRepository.restoreLegacySnapshot(
      userId,
      currentVault,
      backup.encryptedData,
      dataHash,
      expectedVersion,
    )
  }

  async exportVault(userId: string): Promise<VaultExportBundle> {
    const vault = await this.vaultRepository.getCurrentVault(userId)
    if (!vault) {
      throw new NotFoundError('No vault found to export')
    }

    const backups = await this.backupRepository.listBackups(userId, vault.storageMode, 5)

    return {
      vault,
      backups,
      exportedAt: new Date().toISOString(),
    }
  }

  private ensureHashMatches(encryptedData: string, dataHash: string): void {
    if (this.calculateHash(encryptedData) !== dataHash) {
      throw new ValidationError('Data integrity check failed')
    }
  }

  private calculateHash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex')
  }
}
