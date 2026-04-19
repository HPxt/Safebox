import {
  createCredentialFingerprint,
  mergeCredentialSnapshots,
  toExportCredential,
} from './importExportUtils'
import { Credential } from '../types'

const buildCredential = (overrides: Partial<Credential> = {}): Credential => ({
  id: overrides.id || 'cred-1',
  userId: overrides.userId || 'user-1',
  title: overrides.title || 'GitHub',
  username: overrides.username || 'octocat',
  email: overrides.email || '',
  encryptedPassword: overrides.encryptedPassword || 'plain-password',
  website: overrides.website || 'https://github.com',
  notes: overrides.notes || '',
  folderId: overrides.folderId,
  isFavorite: overrides.isFavorite || false,
  isHidden: overrides.isHidden || false,
  createdAt: overrides.createdAt || '2026-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt || '2026-01-01T00:00:00.000Z',
  itemType: overrides.itemType || 'credential',
  totpSecret: overrides.totpSecret || null,
  requireMasterPassword: overrides.requireMasterPassword || false,
  cardHolderName: overrides.cardHolderName || null,
  cardNumber: overrides.cardNumber || null,
  cardBrand: overrides.cardBrand || null,
  cardExpMonth: overrides.cardExpMonth || null,
  cardExpYear: overrides.cardExpYear || null,
  cardCvv: overrides.cardCvv || null,
})

describe('importExportUtils', () => {
  it('exports the decrypted password from the current snapshot', () => {
    const credential = buildCredential({
      encryptedPassword: 'senha-atual',
      username: 'user@example.com',
      totpSecret: 'TOTPSECRET'
    })

    expect(toExportCredential(credential)).toEqual(expect.objectContaining({
      password: 'senha-atual',
      username: 'user@example.com',
      totp: 'TOTPSECRET',
      itemType: 'credential'
    }))
  })

  it('creates the same fingerprint for semantically identical credentials', () => {
    const first = buildCredential()
    const second = buildCredential({
      id: 'cred-2',
      title: ' github ',
      username: 'OCTOCAT',
      website: 'https://github.com '
    })

    expect(createCredentialFingerprint(first)).toBe(createCredentialFingerprint(second))
  })

  it('merges snapshots while skipping duplicates from old backups', () => {
    const current = [buildCredential()]
    const imported = [
      buildCredential({ id: 'cred-2' }),
      buildCredential({
        id: 'cred-3',
        title: 'Gmail',
        username: 'mail@example.com',
        website: 'https://mail.google.com'
      })
    ]

    const result = mergeCredentialSnapshots(current, imported)

    expect(result.importedCount).toBe(1)
    expect(result.duplicateTitles).toEqual(['GitHub'])
    expect(result.mergedCredentials).toHaveLength(2)
    expect(result.mergedCredentials[1]).toEqual(expect.objectContaining({
      title: 'Gmail',
      username: 'mail@example.com'
    }))
  })

  it('supports a safe export -> import round-trip without duplicating current items', () => {
    const currentSnapshot = [
      buildCredential({
        id: 'cred-1',
        title: 'GitHub',
        username: 'octocat',
        encryptedPassword: 'senha-atual',
        totpSecret: 'TOTP-ATUAL',
      }),
      buildCredential({
        id: 'cred-2',
        title: 'Banco',
        username: 'conta',
        encryptedPassword: '123456',
        notes: 'token fisico',
      }),
    ]

    const exported = currentSnapshot.map(toExportCredential)
    const importedSnapshot = exported.map((item, index) => buildCredential({
      id: `import-${index + 1}`,
      title: item.title,
      username: item.username,
      encryptedPassword: item.password,
      website: item.url,
      notes: item.notes,
      itemType: item.itemType,
      totpSecret: item.totp ?? null,
      isFavorite: item.favorite,
      isHidden: item.isHidden,
    }))

    const roundTrip = mergeCredentialSnapshots(currentSnapshot, importedSnapshot)

    expect(roundTrip.importedCount).toBe(0)
    expect(roundTrip.duplicateTitles).toEqual(['GitHub', 'Banco'])
    expect(roundTrip.mergedCredentials).toHaveLength(2)
    expect(roundTrip.mergedCredentials[0]).toEqual(expect.objectContaining({
      encryptedPassword: 'senha-atual',
      totpSecret: 'TOTP-ATUAL',
    }))
  })
})
