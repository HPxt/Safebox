export {}

const mockBackendRequest = jest.fn()
const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('./backendApi', () => ({
  backendRequest: (...args: unknown[]) => mockBackendRequest(...args),
}))

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const buildSelectQuery = (result: { data: unknown; error: unknown }) => {
  const maybeSingle = jest.fn().mockResolvedValue(result)
  const eq = jest.fn().mockReturnValue({ maybeSingle })
  const select = jest.fn().mockReturnValue({ eq })

  return { select, eq, maybeSingle }
}

describe('cryptoProfileService', () => {
  beforeEach(() => {
    jest.resetModules()
    mockBackendRequest.mockReset()
    mockGetUser.mockReset()
    mockFrom.mockReset()

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
      },
      error: null,
    })
  })

  it('falls back to direct Supabase reads when backend returns non-API content', async () => {
    mockBackendRequest.mockRejectedValue(new Error('Resposta invalida do backend'))
    const query = buildSelectQuery({
      data: {
        kdf_salt: 'salt-1',
        kdf_params: {
          algorithm: 'argon2id',
          memorySize: 65536,
          iterations: 3,
          parallelism: 4,
          hashLength: 32,
        },
        key_hash: 'hash-1',
      },
      error: null,
    })
    mockFrom.mockReturnValue(query)

    const { getCryptoProfile } = await import('./cryptoProfileService')
    await expect(getCryptoProfile()).resolves.toEqual({
      kdfSalt: 'salt-1',
      kdfParams: {
        algorithm: 'argon2id',
        memorySize: 65536,
        iterations: 3,
        parallelism: 4,
        hashLength: 32,
      },
      keyHash: 'hash-1',
    })

    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(query.eq).toHaveBeenCalledWith('id', 'user-1')
  })
})
