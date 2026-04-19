export {}

const mockBackendRequest = jest.fn()
const mockGetSession = jest.fn()
const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('./backendApi', () => ({
  backendRequest: (...args: unknown[]) => mockBackendRequest(...args),
}))

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
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

const buildUpsertQuery = (result: { error: unknown }) => {
  const upsert = jest.fn().mockResolvedValue(result)
  return { upsert }
}

describe('settingsService', () => {
  beforeEach(() => {
    jest.resetModules()
    mockBackendRequest.mockReset()
    mockGetSession.mockReset()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    localStorage.clear()

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
          access_token: 'token-1',
        },
      },
    })

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
      },
    })
  })

  it('loads preferences from legacy json settings rows', async () => {
    mockBackendRequest.mockRejectedValue(new Error('backend unavailable'))

    const selectQuery = buildSelectQuery({
      data: {
        user_id: 'user-1',
        security_settings: {
          sessionTimeout: 30,
          clipboardTimeout: 60,
          showHiddenCredentials: true,
        },
        generator_settings: {
          defaultLength: 24,
        },
        ui_settings: {
          compactMode: true,
        },
      },
      error: null,
    })

    mockFrom.mockReturnValue(selectQuery)

    const { settingsService } = await import('./settingsService')
    const preferences = await settingsService.getPreferences()

    expect(preferences).toEqual({
      showHiddenCredentials: true,
      autoLockTimeout: 30,
      compactMode: true,
      defaultPasswordLength: 24,
      clipboardTimeout: 60,
    })
  })

  it('saves preferences against legacy json settings rows when backend is unavailable', async () => {
    mockBackendRequest.mockRejectedValue(new Error('backend unavailable'))

    const selectQuery = buildSelectQuery({
      data: {
        user_id: 'user-1',
        security_settings: {
          sessionTimeout: 15,
          clipboardTimeout: 30,
          showHiddenCredentials: false,
        },
        generator_settings: {
          defaultLength: 16,
        },
        ui_settings: {
          compactMode: false,
        },
      },
      error: null,
    })

    const upsertQuery = buildUpsertQuery({ error: null })

    mockFrom
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(upsertQuery)

    const { settingsService } = await import('./settingsService')
    await settingsService.savePreferences({ showHiddenCredentials: true })

    expect(upsertQuery.upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      security_settings: {
        sessionTimeout: 15,
        clipboardTimeout: 30,
        showHiddenCredentials: true,
      },
      generator_settings: {
        defaultLength: 16,
      },
      ui_settings: {
        compactMode: false,
      },
    }, {
      onConflict: 'user_id',
    })
  })
})
