export interface User {
  id: string
  email: string
  fullName?: string
  avatarUrl?: string
  createdAt: string
  lastLoginAt?: string
}

export interface Credential {
  id: string
  userId: string
  title: string
  username?: string
  email?: string
  encryptedPassword: string
  website?: string
  notes?: string
  categoryId?: string
  folderId?: string
  tags?: string[]
  isFavorite: boolean
  isHidden: boolean  // Campo para ocultar credencial
  createdAt: string
  updatedAt: string
  version?: number
  // Novos campos para tipos de item
  itemType?: 'credential' | 'card' | 'note' | 'identity' | 'ssh_key'
  totpSecret?: string | null
  requireMasterPassword?: boolean
  // Campos específicos de cartão
  cardHolderName?: string | null
  cardNumber?: string | null
  cardBrand?: string | null
  cardExpMonth?: string | null
  cardExpYear?: string | null
  cardCvv?: string | null
}

// Preferências do usuário
export interface UserPreferences {
  showHiddenCredentials: boolean    // Se true, mostra o menu "Ocultos"
  autoLockTimeout: number           // Tempo em minutos para bloquear automaticamente
  compactMode: boolean              // Modo compacto na visualização
  defaultPasswordLength: number     // Tamanho padrão de senha gerada
  clipboardTimeout: number          // Tempo em segundos para limpar clipboard
}

export interface Category {
  id: string
  userId: string
  name: string
  color: string
  icon?: string
  createdAt: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  resendConfirmationEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
}

export interface Folder {
  id: string
  userId: string
  name: string
  color: string
  icon: string
  parentId?: string
  position: number
  createdAt: string
  updatedAt: string
}

export interface FolderFormData {
  name: string
  color?: string
  icon?: string
  parentId?: string
}

export interface CredentialFormData {
  title: string
  username?: string
  email?: string
  password: string
  website?: string
  notes?: string
  categoryId?: string
  folderId?: string
  tags?: string[]
  isFavorite?: boolean
  isHidden?: boolean  // Campo para ocultar credencial
  // Novos campos para tipos de item
  item_type?: 'credential' | 'card' | 'note' | 'identity' | 'ssh_key'
  totp_secret?: string | null
  require_master_password?: boolean
  // Campos específicos de cartão
  card_holder_name?: string | null
  card_number?: string | null
  card_brand?: string | null
  card_exp_month?: string | null
  card_exp_year?: string | null
  card_cvv?: string | null
} 
