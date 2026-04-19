// Tipos para Importação/Exportação

// Formato padrão SafeBox
export interface SafeBoxExportData {
  version: string
  exportDate: string
  folders: Array<{
    id: string
    name: string
    color?: string
    icon?: string
    parentId?: string
    createdAt?: string
    updatedAt?: string
  }>
  credentials: ExportCredential[]
  metadata?: {
    appVersion?: string
    totalItems?: number
    encrypted?: boolean
  }
}

// Temporariamente comentado - será usado em futuras versões
// export interface ExportFolder {
//   id: string
//   name: string
//   color?: string
//   icon?: string
// }

export interface ExportCredential {
  id: string
  title: string
  username?: string
  email?: string
  password?: string
  url?: string
  notes?: string
  totp?: string | null
  favorite?: boolean
  isHidden?: boolean
  folderId?: string | null
  itemType?: 'credential' | 'card' | 'note' | 'identity' | 'ssh_key'
  requireMasterPassword?: boolean
  cardHolderName?: string | null
  cardNumber?: string | null
  cardBrand?: string | null
  cardExpMonth?: string | null
  cardExpYear?: string | null
  cardCvv?: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomField {
  name: string
  value: string
  type: 'text' | 'hidden' | 'boolean'
}

// Formato Bitwarden
export interface BitwardenExport {
  encrypted?: boolean
  folders?: BitwardenFolder[]
  items?: BitwardenItem[]
}

export interface BitwardenFolder {
  id: string
  name: string
}

export interface BitwardenItem {
  id: string
  folderId?: string | null
  type: number // 1 = login, 2 = note, 3 = card, 4 = identity
  name: string
  notes?: string
  favorite?: boolean
  login?: {
    username?: string
    password?: string
    totp?: string
    uris?: Array<{ uri: string }>
  }
  fields?: Array<{
    name: string
    value: string
    type: number
  }>
}

// Formato CSV genérico
export interface CSVRow {
  name?: string
  title?: string
  username?: string
  password?: string
  url?: string
  notes?: string
  folder?: string
  totp?: string
  [key: string]: string | undefined
}

// Mapeamento de colunas para diferentes gerenciadores
export interface CSVMapping {
  title: string[]
  username: string[]
  password: string[]
  url: string[]
  notes: string[]
  folder: string[]
  totp: string[]
}

export const CSV_MAPPINGS: Record<string, CSVMapping> = {
  bitwarden: {
    title: ['name'],
    username: ['login_username'],
    password: ['login_password'],
    url: ['login_uri'],
    notes: ['notes'],
    folder: ['folder'],
    totp: ['login_totp']
  },
  lastpass: {
    title: ['name'],
    username: ['username'],
    password: ['password'],
    url: ['url'],
    notes: ['extra'],
    folder: ['grouping'],
    totp: ['totp']
  },
  chrome: {
    title: ['name'],
    username: ['username'],
    password: ['password'],
    url: ['url'],
    notes: ['note'],
    folder: [],
    totp: []
  },
  firefox: {
    title: ['title', 'hostname'],
    username: ['username'],
    password: ['password'],
    url: ['url', 'hostname'],
    notes: [],
    folder: [],
    totp: []
  },
  '1password': {
    title: ['Title'],
    username: ['Username'],
    password: ['Password'],
    url: ['URL', 'Website'],
    notes: ['Notes'],
    folder: ['Type'],
    totp: ['TOTP']
  },
  keepass: {
    title: ['Title', 'Account'],
    username: ['Username', 'Login Name'],
    password: ['Password'],
    url: ['URL', 'Web Site'],
    notes: ['Notes', 'Comments'],
    folder: ['Group'],
    totp: []
  },
  dashlane: {
    title: ['title', 'item_name'],
    username: ['username', 'login'],
    password: ['password'],
    url: ['url', 'domain'],
    notes: ['note'],
    folder: ['category'],
    totp: ['otpSecret']
  },
  safari: {
    title: ['Title'],
    username: ['Username'],
    password: ['Password'],
    url: ['URL', 'Website'],
    notes: ['Notes'],
    folder: [],
    totp: ['OTPAuth']
  },
  generic: {
    title: ['title', 'name'],
    username: ['username', 'user', 'login', 'email'],
    password: ['password', 'pass'],
    url: ['url', 'website', 'domain'],
    notes: ['notes', 'note', 'comments'],
    folder: ['folder', 'category', 'group'],
    totp: ['totp', 'otp', '2fa']
  }
}

// Tipos de exportação
export type ExportFormat = 'json' | 'json-encrypted' | 'csv' | 'zip'
export type ImportSource = keyof typeof CSV_MAPPINGS | 'safebox-json' | 'generic-csv'

export interface ImportResult {
  success: boolean
  imported: number
  errors: string[]
  folderIdMap?: Map<string, string>
}

export interface ExportData {
  version: string
  exported_at: string
  folders: Array<{
    id: string
    name: string
    color?: string
    icon?: string
  }>
  credentials: ExportCredential[]
} 
