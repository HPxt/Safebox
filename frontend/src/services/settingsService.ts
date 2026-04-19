import { UserPreferences } from '../types'
import { backendRequest } from './backendApi'

const DEFAULT_PREFERENCES: UserPreferences = {
  showHiddenCredentials: false,
  autoLockTimeout: 15,
  compactMode: false,
  defaultPasswordLength: 16,
  clipboardTimeout: 30,
}

const PREFERENCES_CACHE_KEY = 'safebox_user_preferences'

type SettingsResponse = {
  security?: {
    sessionTimeout?: number
    autoLock?: boolean
    requireConfirm?: boolean
    showHiddenCredentials?: boolean
    clipboardTimeout?: number
  }
  generator?: {
    defaultLength?: number
  }
  ui?: {
    compactMode?: boolean
  }
}

const mapSettingsToPreferences = (settings: SettingsResponse | null | undefined): UserPreferences => ({
  showHiddenCredentials: settings?.security?.showHiddenCredentials ?? DEFAULT_PREFERENCES.showHiddenCredentials,
  autoLockTimeout: settings?.security?.sessionTimeout ?? DEFAULT_PREFERENCES.autoLockTimeout,
  compactMode: settings?.ui?.compactMode ?? DEFAULT_PREFERENCES.compactMode,
  defaultPasswordLength: settings?.generator?.defaultLength ?? DEFAULT_PREFERENCES.defaultPasswordLength,
  clipboardTimeout: settings?.security?.clipboardTimeout ?? DEFAULT_PREFERENCES.clipboardTimeout,
})

class SettingsService {
  async getPreferences(): Promise<UserPreferences> {
    try {
      const settings = await backendRequest<SettingsResponse | null>('/settings', {
        method: 'GET',
      })

      if (settings) {
        const preferences = mapSettingsToPreferences(settings)
        this.setCachePreferences(preferences)
        return preferences
      }

      await this.savePreferences(DEFAULT_PREFERENCES)
      return DEFAULT_PREFERENCES
    } catch {
      return this.getCachePreferences() ?? DEFAULT_PREFERENCES
    }
  }

  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const payload: SettingsResponse = {
      security: {
        ...(preferences.showHiddenCredentials !== undefined
          ? { showHiddenCredentials: preferences.showHiddenCredentials }
          : {}),
        ...(preferences.autoLockTimeout !== undefined
          ? { sessionTimeout: preferences.autoLockTimeout }
          : {}),
        ...(preferences.clipboardTimeout !== undefined
          ? { clipboardTimeout: preferences.clipboardTimeout }
          : {}),
      },
      generator: {
        ...(preferences.defaultPasswordLength !== undefined
          ? { defaultLength: preferences.defaultPasswordLength }
          : {}),
      },
      ui: {
        ...(preferences.compactMode !== undefined
          ? { compactMode: preferences.compactMode }
          : {}),
      },
    }

    await backendRequest<SettingsResponse>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })

    const currentPrefs = this.getCachePreferences() ?? DEFAULT_PREFERENCES
    this.setCachePreferences({
      ...currentPrefs,
      ...preferences,
    })
  }

  private getCachePreferences(): UserPreferences | null {
    try {
      const cached = localStorage.getItem(PREFERENCES_CACHE_KEY)
      if (!cached) {
        return null
      }

      return JSON.parse(cached) as UserPreferences
    } catch {
      return null
    }
  }

  private setCachePreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(preferences))
    } catch {
      // Ignore localStorage cache failures.
    }
  }

  clearCache(): void {
    try {
      localStorage.removeItem(PREFERENCES_CACHE_KEY)
    } catch {
      // Ignore localStorage cache failures.
    }
  }
}

export const settingsService = new SettingsService()
