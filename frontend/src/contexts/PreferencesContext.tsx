import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { UserPreferences } from '../types'
import { settingsService } from '../services/settingsService'
import { useAuth } from './AuthContext'

interface PreferencesContextType {
  preferences: UserPreferences
  loading: boolean
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  refreshPreferences: () => Promise<void>
}

const defaultPreferences: UserPreferences = {
  showHiddenCredentials: false,
  autoLockTimeout: 15,
  compactMode: false,
  defaultPasswordLength: 16,
  clipboardTimeout: 30
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)

  // Carregar preferências quando usuário logar
  useEffect(() => {
    if (user) {
      loadPreferences()
    } else {
      // Reset para default quando deslogar
      setPreferences(defaultPreferences)
      settingsService.clearCache()
    }
  }, [user])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      const prefs = await settingsService.getPreferences()
      setPreferences(prefs)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    try {
      // Atualizar estado local imediatamente (otimistic update)
      setPreferences(prev => ({ ...prev, ...updates }))
      
      // Salvar no banco
      await settingsService.savePreferences(updates)
    } catch (error) {
      // Reverter em caso de erro
      await loadPreferences()
      throw error
    }
  }

  const refreshPreferences = async () => {
    await loadPreferences()
  }

  return (
    <PreferencesContext.Provider value={{
      preferences,
      loading,
      updatePreferences,
      refreshPreferences
    }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}
