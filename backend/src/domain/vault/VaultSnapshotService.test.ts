import { ConflictError, NotFoundError, ValidationError } from '@/security/errors'
import { VaultBackupRepository } from './VaultBackupRepository'
import { VaultSnapshotRepository } from './VaultSnapshotRepository'
import { VaultSnapshotService } from './VaultSnapshotService'

describe('VaultSnapshotService', () => {
  const userId = 'user-1'

  const createService = () => {
    const vaultRepository = {
      getCurrentVault: jest.fn(),
      createCredentialVault: jest.fn(),
      updateCredentialVault: jest.fn(),
      updateLegacyVault: jest.fn(),
      clearVault: jest.fn(),
      restoreCredentialSnapshot: jest.fn(),
      restoreLegacySnapshot: jest.fn(),
    } as unknown as jest.Mocked<VaultSnapshotRepository>

    const backupRepository = {
      listBackups: jest.fn(),
      createBackup: jest.fn(),
      getCredentialBackup: jest.fn(),
      getLegacyBackup: jest.fn(),
    } as unknown as jest.Mocked<VaultBackupRepository>

    return {
      service: new VaultSnapshotService(vaultRepository, backupRepository),
      vaultRepository,
      backupRepository,
    }
  }

  it('requires expectedVersion for updates', async () => {
    const { service } = createService()

    await expect(service.updateVault(userId, {
      encryptedData: 'cipher',
      dataHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    })).rejects.toBeInstanceOf(ValidationError)
  })

  it('creates backups only when a vault exists', async () => {
    const { service, vaultRepository } = createService()
    vaultRepository.getCurrentVault.mockResolvedValue(null)

    await expect(service.createBackup(userId)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('restores credential backups with explicit versioning', async () => {
    const { service, vaultRepository, backupRepository } = createService()
    const currentVault = {
      id: 'vault-1',
      encryptedData: 'cipher',
      dataHash: 'hash',
      version: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageMode: 'credentials' as const,
    }

    vaultRepository.getCurrentVault.mockResolvedValue(currentVault)
    backupRepository.getCredentialBackup.mockResolvedValue({
      id: 'backup-1',
      encBlob: 'cipher-restored',
    })
    vaultRepository.restoreCredentialSnapshot.mockResolvedValue({
      ...currentVault,
      encryptedData: 'cipher-restored',
      version: 3,
    })

    const restored = await service.restoreBackup(userId, 'backup-1', 2)

    expect(vaultRepository.restoreCredentialSnapshot).toHaveBeenCalledWith(
      userId,
      currentVault,
      'cipher-restored',
      expect.any(String),
      2,
    )
    expect(restored.version).toBe(3)
  })

  it('rejects creating a vault when one already exists', async () => {
    const { service, vaultRepository } = createService()
    vaultRepository.getCurrentVault.mockResolvedValue({
      id: 'vault-1',
      encryptedData: 'cipher',
      dataHash: 'hash',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageMode: 'credentials',
    })

    await expect(service.createVault(userId, {
      encryptedData: 'cipher',
      dataHash: 'c806cd9c716cfbfdb4763c71dd1394b3e602fce81291a0338bf8e3225416ac32',
    })).rejects.toBeInstanceOf(ConflictError)
  })

  it('keeps backup restore scoped to the authenticated tenant', async () => {
    const { service, vaultRepository, backupRepository } = createService()
    const tenantVault = {
      id: 'vault-tenant-a',
      encryptedData: 'cipher-a',
      dataHash: 'hash-a',
      version: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageMode: 'credentials' as const,
    }

    vaultRepository.getCurrentVault.mockResolvedValue(tenantVault)
    backupRepository.getCredentialBackup.mockResolvedValue({
      id: 'backup-tenant-a',
      encBlob: 'cipher-restored-a',
    })
    vaultRepository.restoreCredentialSnapshot.mockResolvedValue({
      ...tenantVault,
      encryptedData: 'cipher-restored-a',
      version: 5,
    })

    await service.restoreBackup('tenant-a', 'backup-tenant-a', 4)

    expect(backupRepository.getCredentialBackup).toHaveBeenCalledWith('tenant-a', 'backup-tenant-a')
    expect(vaultRepository.restoreCredentialSnapshot).toHaveBeenCalledWith(
      'tenant-a',
      tenantVault,
      'cipher-restored-a',
      expect.any(String),
      4,
    )
  })

  it('exports only the authenticated tenant vault and its scoped backups', async () => {
    const { service, vaultRepository, backupRepository } = createService()
    const tenantVault = {
      id: 'vault-tenant-a',
      encryptedData: 'cipher-a',
      dataHash: 'hash-a',
      version: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageMode: 'credentials' as const,
    }
    const tenantBackups = [
      { id: 'backup-a-1', version: 4 },
      { id: 'backup-a-2', version: 3 },
    ] as any

    vaultRepository.getCurrentVault.mockResolvedValue(tenantVault)
    backupRepository.listBackups.mockResolvedValue(tenantBackups)

    const exported = await service.exportVault('tenant-a')

    expect(vaultRepository.getCurrentVault).toHaveBeenCalledWith('tenant-a')
    expect(backupRepository.listBackups).toHaveBeenCalledWith('tenant-a', 'credentials', 5)
    expect(exported.vault).toBe(tenantVault)
    expect(exported.backups).toEqual(tenantBackups)
    expect(exported.exportedAt).toEqual(expect.any(String))
  })

  it('creates backups scoped to the authenticated tenant vault', async () => {
    const { service, vaultRepository, backupRepository } = createService()
    const tenantVault = {
      id: 'vault-tenant-b',
      encryptedData: 'cipher-b',
      dataHash: 'hash-b',
      version: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storageMode: 'credentials' as const,
    }
    const createdBackup = { id: 'backup-tenant-b', version: 8 } as any

    vaultRepository.getCurrentVault.mockResolvedValue(tenantVault)
    backupRepository.createBackup.mockResolvedValue(createdBackup)

    const result = await service.createBackup('tenant-b')

    expect(vaultRepository.getCurrentVault).toHaveBeenCalledWith('tenant-b')
    expect(backupRepository.createBackup).toHaveBeenCalledWith('tenant-b', tenantVault)
    expect(result).toEqual({
      vault: tenantVault,
      backup: createdBackup,
    })
  })
})
