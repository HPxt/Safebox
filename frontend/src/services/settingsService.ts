import { UserPreferences } from '../types'
import { backendRequest } from './backendApi'
import { supabase } from '../config/supabase'

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

type DirectSettingsRow = {
  user_id: string
  session_timeout?: number | null
  auto_lock?: boolean | null
  require_confirm?: boolean | null
  show_hidden_credentials?: boolean | null
  clipboard_timeout?: number | null
  default_length?: number | null
  compact_mode?: boolean | null
  security_settings?: Record<string, unknown> | null
  generator_settings?: Record<string, unknown> | null
  ui_settings?: Record<string, unknown> | null
}

const hasLegacySettingsShape = (row: DirectSettingsRow | null | undefined): boolean =>
  Boolean(
    row && (
      row.security_settings !== undefined ||
      row.generator_settings !== undefined ||
      row.ui_settings !== undefined
    ),
  )

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const mapSettingsToPreferences = (settings: SettingsResponse | null | undefined): UserPreferences => ({
  showHiddenCredentials: settings?.security?.showHiddenCredentials ?? DEFAULT_PREFERENCES.showHiddenCredentials,
  autoLockTimeout: settings?.security?.sessionTimeout ?? DEFAULT_PREFERENCES.autoLockTimeout,
  compactMode: settings?.ui?.compactMode ?? DEFAULT_PREFERENCES.compactMode,
  defaultPasswordLength: settings?.generator?.defaultLength ?? DEFAULT_PREFERENCES.defaultPasswordLength,
  clipboardTimeout: settings?.security?.clipboardTimeout ?? DEFAULT_PREFERENCES.clipboardTimeout,
})

const mapDirectRowToPreferences = (row: DirectSettingsRow | null | undefined): UserPreferences => {
  if (hasLegacySettingsShape(row)) {
    const security = row?.security_settings ?? {}
    const generator = row?.generator_settings ?? {}
    const ui = row?.ui_settings ?? {}

    return {
      showHiddenCredentials: readBoolean(
        security['showHiddenCredentials'],
        DEFAULT_PREFERENCES.showHiddenCredentials,
      ),
      autoLockTimeout: readNumber(
        security['sessionTimeout'],
        DEFAULT_PREFERENCES.autoLockTimeout,
      ),
      compactMode: readBoolean(
        ui['compactMode'],
        DEFAULT_PREFERENCES.compactMode,
      ),
      defaultPasswordLength: readNumber(
        generator['defaultLength'],
        DEFAULT_PREFERENCES.defaultPasswordLength,
      ),
      clipboardTimeout: readNumber(
        security['clipboardTimeout'],
        DEFAULT_PREFERENCES.clipboardTimeout,
      ),
    }
  }

  return {
    showHiddenCredentials: row?.show_hidden_credentials ?? DEFAULT_PREFERENCES.showHiddenCredentials,
    autoLockTimeout: row?.session_timeout ?? DEFAULT_PREFERENCES.autoLockTimeout,
    compactMode: row?.compact_mode ?? DEFAULT_PREFERENCES.compactMode,
    defaultPasswordLength: row?.default_length ?? DEFAULT_PREFERENCES.defaultPasswordLength,
    clipboardTimeout: row?.clipboard_timeout ?? DEFAULT_PREFERENCES.clipboardTimeout,
  }
}

const isMissingColumnError = (error: unknown): boolean => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : ''

  return /column .* does not exist|Could not find the .* column/i.test(message)
}

class SettingsService {
  private async getCurrentUserId(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      return session.user.id
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    return user.id
  }

  private async getPreferencesDirectFromSupabase(): Promise<UserPreferences> {
    const userId = await this.getCurrentUserId()
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw error
    }

    const preferences = mapDirectRowToPreferences(data as DirectSettingsRow | null)
    this.setCachePreferences(preferences)
    return preferences
  }

  private buildFlatRow(userId: string, preferences: Partial<UserPreferences>) {
    return {
      user_id: userId,
      ...(preferences.showHiddenCredentials !== undefined
        ? { show_hidden_credentials: preferences.showHiddenCredentials }
        : {}),
      ...(preferences.autoLockTimeout !== undefined
        ? { session_timeout: preferences.autoLockTimeout }
        : {}),
      ...(preferences.clipboardTimeout !== undefined
        ? { clipboard_timeout: preferences.clipboardTimeout }
        : {}),
      ...(preferences.defaultPasswordLength !== undefined
        ? { default_length: preferences.defaultPasswordLength }
        : {}),
      ...(preferences.compactMode !== undefined
        ? { compact_mode: preferences.compactMode }
        : {}),
    }
  }

  private buildLegacyRow(
    userId: string,
    preferences: Partial<UserPreferences>,
    existingRow?: DirectSettingsRow | null,
  ) {
    const securitySettings = {
      ...((existingRow?.security_settings as Record<string, unknown> | null | undefined) ?? {}),
      ...(preferences.showHiddenCredentials !== undefined
        ? { showHiddenCredentials: preferences.showHiddenCredentials }
        : {}),
      ...(preferences.autoLockTimeout !== undefined
        ? { sessionTimeout: preferences.autoLockTimeout }
        : {}),
      ...(preferences.clipboardTimeout !== undefined
        ? { clipboardTimeout: preferences.clipboardTimeout }
        : {}),
    }

    const generatorSettings = {
      ...((existingRow?.generator_settings as Record<string, unknown> | null | undefined) ?? {}),
      ...(preferences.defaultPasswordLength !== undefined
        ? { defaultLength: preferences.defaultPasswordLength }
        : {}),
    }

    const uiSettings = {
      ...((existingRow?.ui_settings as Record<string, unknown> | null | undefined) ?? {}),
      ...(preferences.compactMode !== undefined
        ? { compactMode: preferences.compactMode }
        : {}),
    }

    return {
      user_id: userId,
      security_settings: securitySettings,
      generator_settings: generatorSettings,
      ui_settings: uiSettings,
    }
  }

  private async savePreferencesDirectToSupabase(preferences: Partial<UserPreferences>): Promise<void> {
    const userId = await this.getCurrentUserId()
    const { data: existingRow } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    const saveFlatRow = async () => {
      const { error } = await supabase
        .from('user_settings')
        .upsert(this.buildFlatRow(userId, preferences), {
          onConflict: 'user_id',
        })

      if (error) {
        throw error
      }
    }

    const saveLegacyRow = async () => {
      const { error } = await supabase
        .from('user_settings')
        .upsert(this.buildLegacyRow(userId, preferences, existingRow as DirectSettingsRow | null), {
          onConflict: 'user_id',
        })

      if (error) {
        throw error
      }
    }

    if (hasLegacySettingsShape(existingRow as DirectSettingsRow | null)) {
      await saveLegacyRow()
      return
    }

    try {
      await saveFlatRow()
    } catch (error) {
      if (!isMissingColumnError(error)) {
        throw error
      }

      await saveLegacyRow()
    }
  }

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
      try {
        return await this.getPreferencesDirectFromSupabase()
      } catch {
        return this.getCachePreferences() ?? DEFAULT_PREFERENCES
      }
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

    try {
      await backendRequest<SettingsResponse>('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    } catch {
      await this.savePreferencesDirectToSupabase(preferences)
    }

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
