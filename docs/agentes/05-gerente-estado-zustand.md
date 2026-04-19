# Agent 5: Gerente de Estado Zustand

## Responsabilidades Principais

- **Gerenciamento Global**: Estados compartilhados entre componentes
- **Persistência**: Sincronização com localStorage e Supabase
- **Otimizações**: Seletores eficientes, atualizações granulares
- **Middleware**: Logging, devtools, persistência automática
- **Sincronização**: Estado local vs estado remoto
- **Cache**: Estratégias de cache para melhor performance
- **Hidratação**: Estado inicial a partir de diferentes fontes

## Arquitetura de Stores

### Auth Store

```typescript
// src/stores/authStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { securityAuditService } from '@/services/securityAuditService'

interface User {
  id: string
  email: string
  createdAt: string
  lastLoginAt?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null })
          
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            })

            if (error) throw error

            const user: User = {
              id: data.user.id,
              email: data.user.email!,
              createdAt: data.user.created_at,
              lastLoginAt: data.user.last_sign_in_at || undefined,
            }

            set({ 
              user, 
              isAuthenticated: true, 
              isLoading: false 
            })

            securityAuditService.logEvent('vault_unlock', { userId: user.id })
            return true
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro no login'
            set({ 
              error: message, 
              isLoading: false,
              isAuthenticated: false,
              user: null 
            })
            
            securityAuditService.logEvent('decrypt_failure', { 
              error: message,
              email 
            })
            
            return false
          }
        },

        logout: async () => {
          set({ isLoading: true })
          
          try {
            const { user } = get()
            await supabase.auth.signOut()
            
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            })

            securityAuditService.logEvent('vault_lock', { 
              userId: user?.id 
            })
          } catch (error) {
            console.error('Erro no logout:', error)
            set({ isLoading: false })
          }
        },

        checkAuth: async () => {
          set({ isLoading: true })
          
          try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
              const user: User = {
                id: session.user.id,
                email: session.user.email!,
                createdAt: session.user.created_at,
                lastLoginAt: session.user.last_sign_in_at || undefined,
              }

              set({ 
                user, 
                isAuthenticated: true,
                isLoading: false 
              })
            } else {
              set({ 
                user: null, 
                isAuthenticated: false,
                isLoading: false 
              })
            }
          } catch (error) {
            console.error('Erro ao verificar autenticação:', error)
            set({ 
              isAuthenticated: false, 
              user: null,
              isLoading: false 
            })
          }
        },

        clearError: () => {
          set({ error: null })
        },
      }),
      {
        name: 'safebox-auth',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'AuthStore' }
  )
)
```

### Vault Store

```typescript
// src/stores/vaultStore.ts
import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { cryptoService, type Credential, type EncryptedData } from '@/services/cryptoService'
import { secureStorageService } from '@/services/secureStorageService'
import { supabase } from '@/lib/supabase'

interface VaultState {
  credentials: Credential[]
  encryptedBlob: EncryptedData | null
  isUnlocked: boolean
  isLoading: boolean
  isSyncing: boolean
  searchTerm: string
  selectedCredentialId: string | null
  lastSyncedAt: Date | null
  hasUnsavedChanges: boolean
  error: string | null
}

interface VaultActions {
  unlockVault: (masterPassword: string) => Promise<boolean>
  lockVault: () => void
  addCredential: (credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCredential: (id: string, updates: Partial<Credential>) => void
  deleteCredential: (id: string) => void
  setSearchTerm: (term: string) => void
  selectCredential: (id: string | null) => void
  syncWithServer: () => Promise<void>
  saveToServer: () => Promise<void>
  loadFromServer: () => Promise<void>
  clearError: () => void
}

type VaultStore = VaultState & VaultActions

export const useVaultStore = create<VaultStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial State
        credentials: [],
        encryptedBlob: null,
        isUnlocked: false,
        isLoading: false,
        isSyncing: false,
        searchTerm: '',
        selectedCredentialId: null,
        lastSyncedAt: null,
        hasUnsavedChanges: false,
        error: null,

        // Actions
        unlockVault: async (masterPassword: string) => {
          set((state) => {
            state.isLoading = true
            state.error = null
          })

          try {
            // Carrega dados do servidor
            await get().loadFromServer()
            const { encryptedBlob } = get()

            let success = false
            let credentials: Credential[] = []

            if (encryptedBlob) {
              // Desbloqueia com dados existentes
              success = await secureStorageService.unlockVault(masterPassword, encryptedBlob)
              if (success) {
                credentials = await cryptoService.decryptCredentials(encryptedBlob, masterPassword)
              }
            } else {
              // Primeiro acesso - cria cofre vazio
              success = await secureStorageService.unlockVault(masterPassword)
              credentials = []
            }

            set((state) => {
              state.isUnlocked = success
              state.credentials = credentials
              state.isLoading = false
              state.lastSyncedAt = new Date()
            })

            return success
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao desbloquear cofre'
            set((state) => {
              state.error = message
              state.isLoading = false
              state.isUnlocked = false
            })
            return false
          }
        },

        lockVault: () => {
          secureStorageService.lockVault()
          set((state) => {
            state.isUnlocked = false
            state.credentials = []
            state.selectedCredentialId = null
            state.searchTerm = ''
            state.hasUnsavedChanges = false
          })
        },

        addCredential: (credentialData) => {
          set((state) => {
            const newCredential: Credential = {
              ...credentialData,
              id: crypto.randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            state.credentials.push(newCredential)
            state.hasUnsavedChanges = true
          })
        },

        updateCredential: (id, updates) => {
          set((state) => {
            const index = state.credentials.findIndex(cred => cred.id === id)
            if (index !== -1) {
              state.credentials[index] = {
                ...state.credentials[index],
                ...updates,
                updatedAt: new Date(),
              }
              state.hasUnsavedChanges = true
            }
          })
        },

        deleteCredential: (id) => {
          set((state) => {
            state.credentials = state.credentials.filter(cred => cred.id !== id)
            if (state.selectedCredentialId === id) {
              state.selectedCredentialId = null
            }
            state.hasUnsavedChanges = true
          })
        },

        setSearchTerm: (term) => {
          set((state) => {
            state.searchTerm = term
          })
        },

        selectCredential: (id) => {
          set((state) => {
            state.selectedCredentialId = id
          })
        },

        syncWithServer: async () => {
          const { hasUnsavedChanges, isUnlocked } = get()
          
          if (!isUnlocked) return

          if (hasUnsavedChanges) {
            await get().saveToServer()
          } else {
            await get().loadFromServer()
          }
        },

        saveToServer: async () => {
          set((state) => {
            state.isSyncing = true
            state.error = null
          })

          try {
            const { credentials } = get()
            const masterKey = secureStorageService.getMasterKey()
            
            if (!masterKey) {
              throw new Error('Cofre não desbloqueado')
            }

            // Criptografa credenciais
            const encryptedData = await cryptoService.encryptCredentials(
              credentials,
              '', // Senha será derivada da chave mestra
              get().encryptedBlob?.salt
            )

            // Salva no Supabase
            const { error } = await supabase
              .from('vaults')
              .upsert({
                user_id: (await supabase.auth.getUser()).data.user?.id,
                encrypted_data: encryptedData,
                updated_at: new Date().toISOString(),
              })

            if (error) throw error

            set((state) => {
              state.encryptedBlob = encryptedData
              state.hasUnsavedChanges = false
              state.lastSyncedAt = new Date()
              state.isSyncing = false
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao salvar'
            set((state) => {
              state.error = message
              state.isSyncing = false
            })
          }
        },

        loadFromServer: async () => {
          set((state) => {
            state.isSyncing = true
            state.error = null
          })

          try {
            const { data, error } = await supabase
              .from('vaults')
              .select('encrypted_data, updated_at')
              .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
              .single()

            if (error && error.code !== 'PGRST116') { // Não encontrado é OK
              throw error
            }

            set((state) => {
              state.encryptedBlob = data?.encrypted_data || null
              state.lastSyncedAt = data ? new Date(data.updated_at) : null
              state.isSyncing = false
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao carregar'
            set((state) => {
              state.error = message
              state.isSyncing = false
            })
          }
        },

        clearError: () => {
          set((state) => {
            state.error = null
          })
        },
      }))
    ),
    { name: 'VaultStore' }
  )
)

// Auto-save middleware
useVaultStore.subscribe(
  (state) => state.hasUnsavedChanges,
  (hasChanges) => {
    if (hasChanges) {
      // Debounce auto-save
      const timeoutId = setTimeout(() => {
        useVaultStore.getState().saveToServer()
      }, 5000) // 5 segundos

      return () => clearTimeout(timeoutId)
    }
  }
)
```

### Settings Store

```typescript
// src/stores/settingsStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface SecuritySettings {
  sessionTimeout: number // minutos
  autoLockOnIdle: boolean
  lockOnBrowserClose: boolean
  requireMasterPasswordConfirm: boolean
}

interface GeneratorSettings {
  defaultLength: number
  includeLowercase: boolean
  includeUppercase: boolean
  includeNumbers: boolean
  includeSymbols: boolean
  excludeAmbiguous: boolean
}

interface UISettings {
  theme: 'light' | 'dark' | 'system'
  language: 'pt-BR' | 'en-US'
  compactMode: boolean
  showPasswordStrength: boolean
  enableAnimations: boolean
}

interface SettingsState {
  security: SecuritySettings
  generator: GeneratorSettings
  ui: UISettings
  version: string
}

interface SettingsActions {
  updateSecurity: (settings: Partial<SecuritySettings>) => void
  updateGenerator: (settings: Partial<GeneratorSettings>) => void
  updateUI: (settings: Partial<UISettings>) => void
  resetToDefaults: () => void
  exportSettings: () => string
  importSettings: (settingsJson: string) => boolean
}

type SettingsStore = SettingsState & SettingsActions

const defaultSettings: SettingsState = {
  security: {
    sessionTimeout: 15,
    autoLockOnIdle: true,
    lockOnBrowserClose: false,
    requireMasterPasswordConfirm: true,
  },
  generator: {
    defaultLength: 16,
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeAmbiguous: true,
  },
  ui: {
    theme: 'system',
    language: 'pt-BR',
    compactMode: false,
    showPasswordStrength: true,
    enableAnimations: true,
  },
  version: '1.0.0',
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultSettings,

        updateSecurity: (newSettings) => {
          set((state) => ({
            security: { ...state.security, ...newSettings }
          }))
        },

        updateGenerator: (newSettings) => {
          set((state) => ({
            generator: { ...state.generator, ...newSettings }
          }))
        },

        updateUI: (newSettings) => {
          set((state) => ({
            ui: { ...state.ui, ...newSettings }
          }))
        },

        resetToDefaults: () => {
          set(defaultSettings)
        },

        exportSettings: () => {
          const settings = get()
          return JSON.stringify({
            security: settings.security,
            generator: settings.generator,
            ui: settings.ui,
          }, null, 2)
        },

        importSettings: (settingsJson) => {
          try {
            const imported = JSON.parse(settingsJson)
            
            // Validação básica
            if (imported.security) set((state) => ({ security: { ...state.security, ...imported.security } }))
            if (imported.generator) set((state) => ({ generator: { ...state.generator, ...imported.generator } }))
            if (imported.ui) set((state) => ({ ui: { ...state.ui, ...imported.ui } }))
            
            return true
          } catch {
            return false
          }
        },
      }),
      {
        name: 'safebox-settings',
        version: 1,
        migrate: (persistedState, version) => {
          // Migração de configurações entre versões
          if (version === 0) {
            return { ...defaultSettings, ...persistedState }
          }
          return persistedState as SettingsStore
        },
      }
    ),
    { name: 'SettingsStore' }
  )
)
```

### UI Store

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Modal {
  id: string
  type: 'credential-form' | 'delete-confirm' | 'settings' | 'password-generator'
  props?: Record<string, any>
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  actions?: Array<{
    label: string
    action: () => void
  }>
}

interface UIState {
  sidebarOpen: boolean
  modals: Modal[]
  notifications: Notification[]
  isLoading: boolean
  loadingMessage?: string
  clipboard: {
    text: string
    expiresAt: number
  } | null
}

interface UIActions {
  setSidebarOpen: (open: boolean) => void
  openModal: (modal: Omit<Modal, 'id'>) => string
  closeModal: (id: string) => void
  closeAllModals: () => void
  showNotification: (notification: Omit<Notification, 'id'>) => string
  dismissNotification: (id: string) => void
  clearNotifications: () => void
  setLoading: (loading: boolean, message?: string) => void
  copyToClipboard: (text: string, duration?: number) => void
  clearClipboard: () => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial State
      sidebarOpen: false,
      modals: [],
      notifications: [],
      isLoading: false,
      loadingMessage: undefined,
      clipboard: null,

      // Actions
      setSidebarOpen: (open) => {
        set({ sidebarOpen: open })
      },

      openModal: (modal) => {
        const id = crypto.randomUUID()
        set((state) => ({
          modals: [...state.modals, { ...modal, id }]
        }))
        return id
      },

      closeModal: (id) => {
        set((state) => ({
          modals: state.modals.filter(modal => modal.id !== id)
        }))
      },

      closeAllModals: () => {
        set({ modals: [] })
      },

      showNotification: (notification) => {
        const id = crypto.randomUUID()
        const newNotification: Notification = {
          ...notification,
          id,
          duration: notification.duration ?? 5000,
        }

        set((state) => ({
          notifications: [...state.notifications, newNotification]
        }))

        // Auto dismiss
        if (newNotification.duration && newNotification.duration > 0) {
          setTimeout(() => {
            get().dismissNotification(id)
          }, newNotification.duration)
        }

        return id
      },

      dismissNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter(notif => notif.id !== id)
        }))
      },

      clearNotifications: () => {
        set({ notifications: [] })
      },

      setLoading: (loading, message) => {
        set({ isLoading: loading, loadingMessage: message })
      },

      copyToClipboard: (text, duration = 30000) => {
        navigator.clipboard.writeText(text)
        
        set({
          clipboard: {
            text,
            expiresAt: Date.now() + duration
          }
        })

        get().showNotification({
          type: 'success',
          title: 'Copiado!',
          message: 'Texto copiado para a área de transferência',
          duration: 2000,
        })

        // Auto clear clipboard
        setTimeout(() => {
          const { clipboard } = get()
          if (clipboard && clipboard.expiresAt <= Date.now()) {
            get().clearClipboard()
          }
        }, duration)
      },

      clearClipboard: () => {
        set({ clipboard: null })
      },
    }),
    { name: 'UIStore' }
  )
)
```

## Custom Hooks para Stores

### useVaultOperations

```typescript
// src/hooks/useVaultOperations.ts
import { useVaultStore } from '@/stores/vaultStore'
import { useUIStore } from '@/stores/uiStore'
import { passwordGeneratorService } from '@/services/passwordGeneratorService'
import { useSettingsStore } from '@/stores/settingsStore'

export function useVaultOperations() {
  const {
    credentials,
    addCredential,
    updateCredential,
    deleteCredential,
    searchTerm,
    setSearchTerm,
    selectedCredentialId,
    selectCredential,
  } = useVaultStore()

  const { showNotification, copyToClipboard, openModal } = useUIStore()
  const { generator } = useSettingsStore()

  const filteredCredentials = credentials.filter(credential =>
    credential.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    credential.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    credential.url?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedCredential = credentials.find(cred => cred.id === selectedCredentialId)

  const generateAndCopyPassword = () => {
    const password = passwordGeneratorService.generatePassword({
      length: generator.defaultLength,
      includeLowercase: generator.includeLowercase,
      includeUppercase: generator.includeUppercase,
      includeNumbers: generator.includeNumbers,
      includeSymbols: generator.includeSymbols,
      excludeAmbiguous: generator.excludeAmbiguous,
    })

    copyToClipboard(password)
    return password
  }

  const copyCredentialField = (field: 'username' | 'password', credentialId: string) => {
    const credential = credentials.find(c => c.id === credentialId)
    if (credential) {
      copyToClipboard(credential[field])
      showNotification({
        type: 'success',
        title: 'Copiado!',
        message: `${field === 'username' ? 'Usuário' : 'Senha'} copiado`,
        duration: 2000,
      })
    }
  }

  const openCredentialForm = (credential?: Credential) => {
    openModal({
      type: 'credential-form',
      props: { credential }
    })
  }

  const confirmDeleteCredential = (credentialId: string) => {
    const credential = credentials.find(c => c.id === credentialId)
    if (credential) {
      openModal({
        type: 'delete-confirm',
        props: {
          title: `Excluir ${credential.title}?`,
          message: 'Esta ação não pode ser desfeita.',
          onConfirm: () => deleteCredential(credentialId),
        }
      })
    }
  }

  return {
    credentials: filteredCredentials,
    selectedCredential,
    searchTerm,
    setSearchTerm,
    selectCredential,
    addCredential,
    updateCredential,
    deleteCredential,
    generateAndCopyPassword,
    copyCredentialField,
    openCredentialForm,
    confirmDeleteCredential,
  }
}
```

### useAutoSave

```typescript
// src/hooks/useAutoSave.ts
import { useEffect, useRef } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function useAutoSave() {
  const { hasUnsavedChanges, saveToServer, isUnlocked } = useVaultStore()
  const { security } = useSettingsStore()
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (hasUnsavedChanges && isUnlocked) {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set new timeout for auto-save
      timeoutRef.current = setTimeout(() => {
        saveToServer()
      }, 5000) // 5 segundos
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [hasUnsavedChanges, isUnlocked, saveToServer])

  // Force save on page unload
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        if (security.requireMasterPasswordConfirm) {
          e.preventDefault()
          e.returnValue = 'Você tem alterações não salvas. Deseja sair mesmo assim?'
        } else {
          // Try to save quickly
          await saveToServer()
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, saveToServer, security.requireMasterPasswordConfirm])
}
```

## Sync Service

```typescript
// src/services/syncService.ts
import { useVaultStore } from '@/stores/vaultStore'
import { useUIStore } from '@/stores/uiStore'

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null
  private readonly SYNC_INTERVAL = 30000 // 30 segundos

  startAutoSync() {
    if (this.syncInterval) return

    this.syncInterval = setInterval(async () => {
      const { isUnlocked, isSyncing } = useVaultStore.getState()
      
      if (isUnlocked && !isSyncing) {
        try {
          await useVaultStore.getState().syncWithServer()
        } catch (error) {
          console.warn('Auto-sync failed:', error)
        }
      }
    }, this.SYNC_INTERVAL)
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  async forceSyncNow() {
    const { isUnlocked } = useVaultStore.getState()
    
    if (!isUnlocked) {
      useUIStore.getState().showNotification({
        type: 'error',
        title: 'Erro',
        message: 'Cofre deve estar desbloqueado para sincronizar',
      })
      return
    }

    try {
      useUIStore.getState().setLoading(true, 'Sincronizando...')
      await useVaultStore.getState().syncWithServer()
      
      useUIStore.getState().showNotification({
        type: 'success',
        title: 'Sincronizado',
        message: 'Dados sincronizados com sucesso',
        duration: 2000,
      })
    } catch (error) {
      useUIStore.getState().showNotification({
        type: 'error',
        title: 'Erro na sincronização',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      useUIStore.getState().setLoading(false)
    }
  }

  async handleConflict(localData: any, serverData: any) {
    // Estratégia: servidor sempre ganha (last-write-wins)
    // Em uma implementação mais sofisticada, poderia haver merge inteligente
    return serverData
  }
}

export const syncService = new SyncService()
```

## Store DevTools

```typescript
// src/utils/storeDevTools.ts
interface StoreSnapshot {
  name: string
  state: any
  timestamp: Date
}

class StoreDevTools {
  private snapshots: StoreSnapshot[] = []
  private maxSnapshots = 50

  captureSnapshot(storeName: string, state: any) {
    const snapshot: StoreSnapshot = {
      name: storeName,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      timestamp: new Date(),
    }

    this.snapshots.unshift(snapshot)
    
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(0, this.maxSnapshots)
    }
  }

  getSnapshots() {
    return [...this.snapshots]
  }

  exportSnapshot(index: number) {
    const snapshot = this.snapshots[index]
    if (snapshot) {
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${snapshot.name}-${snapshot.timestamp.toISOString()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  clearSnapshots() {
    this.snapshots = []
  }
}

export const storeDevTools = new StoreDevTools()

// Development helper para capturar snapshots automaticamente
if (process.env.NODE_ENV === 'development') {
  // Configurar middleware para capturar mudanças automaticamente
  const originalCreate = create
  
  // Override create para adicionar snapshot middleware
  window.zustandDevTools = storeDevTools
}
```

## Checklist de Responsabilidades

### Stores Principais ✅
- [ ] AuthStore com persistência e middleware
- [ ] VaultStore com sincronização
- [ ] SettingsStore com configurações granulares
- [ ] UIStore para estado da interface

### Persistência ✅
- [ ] Sincronização automática com Supabase
- [ ] Backup local com localStorage
- [ ] Estratégias de conflict resolution
- [ ] Auto-save inteligente

### Performance ✅
- [ ] Seletores otimizados
- [ ] Middleware de desenvolvimento
- [ ] Subscriptions eficientes
- [ ] Estado granular e reativo

### Desenvolvimento ✅
- [ ] DevTools integration
- [ ] Store snapshots e debugging
- [ ] TypeScript strict typing
- [ ] Custom hooks para operações complexas 