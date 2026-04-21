import { authenticateSupabaseAccessToken } from '@/middleware/auth.middleware'
import { ForbiddenError, UnauthorizedError } from '@/security/errors'

const mockGetUser = jest.fn()

jest.mock('@/config/database', () => ({
  createSupabaseAuthClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

jest.mock('@/services/auth.service', () => ({
  authService: {
    verifyToken: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
})

describe('authenticateSupabaseAccessToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('passes UnauthorizedError to the global error handler when bearer token is missing', async () => {
    const req: any = { headers: {} }
    const res: any = createResponse()
    const next = jest.fn()

    await authenticateSupabaseAccessToken(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError))
    expect(next.mock.calls[0][0].code).toBe('UNAUTHORIZED')
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('passes ForbiddenError to the global error handler when Supabase rejects the token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('invalid token'),
    })

    const req: any = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    }
    const res: any = createResponse()
    const next = jest.fn()

    await authenticateSupabaseAccessToken(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError))
    expect(next.mock.calls[0][0].code).toBe('FORBIDDEN')
    expect(res.status).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it('attaches Supabase user and auth token for valid sessions', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-123',
          email: 'ios@example.com',
        },
      },
      error: null,
    })

    const req: any = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    }
    const res: any = createResponse()
    const next = jest.fn()

    await authenticateSupabaseAccessToken(req, res, next)

    expect(req.supabaseUser).toEqual({
      userId: 'user-123',
      email: 'ios@example.com',
    })
    expect(req.authToken).toBe('valid-token')
    expect(next).toHaveBeenCalledWith()
  })
})
