export {}

const mockGetSession = jest.fn()

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}))

describe('backendApi', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.resetModules()
    mockGetSession.mockReset()

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
        },
      },
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects invalid json responses from the backend', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    } as unknown as Response)

    const { backendRequest } = await import('./backendApi')

    await expect(backendRequest('/vault')).rejects.toThrow('Resposta invalida do backend')
  })

  it('rejects successful responses without a data property', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as Response)

    const { backendRequest } = await import('./backendApi')

    await expect(backendRequest('/vault')).rejects.toThrow('Resposta invalida do backend')
  })
})
