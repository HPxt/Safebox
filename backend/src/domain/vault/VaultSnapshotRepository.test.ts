import { ConflictError } from '@/security/errors'
import { VaultSnapshotRepository } from './VaultSnapshotRepository'

describe('VaultSnapshotRepository', () => {
  const createClient = (result: unknown) => {
    const maybeSingle = jest.fn().mockResolvedValue(result)
    const select = jest.fn(() => ({ maybeSingle }))
    const insert = jest.fn(() => ({ select }))
    const from = jest.fn(() => ({ insert }))

    return {
      client: { from },
      calls: { from, insert, select, maybeSingle },
    }
  }

  it('maps duplicate vault inserts to a ConflictError', async () => {
    const { client } = createClient({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const repository = new VaultSnapshotRepository(client as any)

    await expect(
      repository.createCredentialVault('user-1', 'cipher', 'hash'),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('creates credential vault rows with the authenticated user id only', async () => {
    const { client, calls } = createClient({
      data: {
        id: 'vault-1',
        user_id: 'user-1',
        enc_blob: 'cipher',
        data_hash: 'hash',
        version: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    })
    const repository = new VaultSnapshotRepository(client as any)

    const created = await repository.createCredentialVault('user-1', 'cipher', 'hash')

    expect(calls.from).toHaveBeenCalledWith('credentials')
    expect(calls.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      title: 'vault',
      encrypted_password: 'enc_blob_mode',
      enc_blob: 'cipher',
      data_hash: 'hash',
      version: 1,
    })
    expect(created).toMatchObject({
      id: 'vault-1',
      encryptedData: 'cipher',
      storageMode: 'credentials',
      version: 1,
    })
  })
})
