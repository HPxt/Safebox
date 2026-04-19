export type VaultStorageMode = 'credentials' | 'vaults'

export type NormalizedVault = {
  id: string
  encryptedData: string
  dataHash: string
  version: number
  createdAt: string
  updatedAt: string
  storageMode: VaultStorageMode
}

export type VaultWritePayload = {
  encryptedData: string
  dataHash: string
  expectedVersion?: number
}

export type VaultBackupSummary = {
  id: string
  backupType: string
  createdAt: string
}

export type VaultExportBundle = {
  vault: NormalizedVault
  backups: VaultBackupSummary[]
  exportedAt: string
}
