// Database types generated from Supabase schema
// This file should be generated using: supabase gen types typescript --local

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          status: 'active' | 'suspended' | 'deleted'
          preferences: Json
          kdf_salt: string | null
          kdf_params: Json | null
          key_hash: string | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          two_factor_backup_codes: string[] | null
          two_factor_verified_at: string | null
          created_at: string
          updated_at: string
          last_login_at: string | null
          login_count: number
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          status?: 'active' | 'suspended' | 'deleted'
          preferences?: Json
          kdf_salt?: string | null
          kdf_params?: Json | null
          key_hash?: string | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          two_factor_backup_codes?: string[] | null
          two_factor_verified_at?: string | null
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          login_count?: number
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          status?: 'active' | 'suspended' | 'deleted'
          preferences?: Json
          kdf_salt?: string | null
          kdf_params?: Json | null
          key_hash?: string | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          two_factor_backup_codes?: string[] | null
          two_factor_verified_at?: string | null
          created_at?: string
          updated_at?: string
          last_login_at?: string | null
          login_count?: number
        }
        Relationships: []
      }
      credentials: {
        Row: {
          id: string
          user_id: string
          title: string | null
          username: string | null
          email: string | null
          encrypted_password: string | null
          website: string | null
          notes: string | null
          folder_id: string | null
          is_favorite: boolean | null
          is_hidden: boolean | null
          enc_blob: string | null
          data_hash: string | null
          version: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          username?: string | null
          email?: string | null
          encrypted_password?: string | null
          website?: string | null
          notes?: string | null
          folder_id?: string | null
          is_favorite?: boolean | null
          is_hidden?: boolean | null
          enc_blob?: string | null
          data_hash?: string | null
          version?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          username?: string | null
          email?: string | null
          encrypted_password?: string | null
          website?: string | null
          notes?: string | null
          folder_id?: string | null
          is_favorite?: boolean | null
          is_hidden?: boolean | null
          enc_blob?: string | null
          data_hash?: string | null
          version?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      credential_backups: {
        Row: {
          id: string
          user_id: string
          credential_id: string
          enc_blob: string
          backup_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          credential_id: string
          enc_blob: string
          backup_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          credential_id?: string
          enc_blob?: string
          backup_type?: string
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          icon: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          icon?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          icon?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          icon: string | null
          parent_id: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          icon?: string | null
          parent_id?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          icon?: string | null
          parent_id?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vaults: {
        Row: {
          id: string
          user_id: string
          encrypted_data: Json
          data_hash: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          encrypted_data: Json
          data_hash: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          encrypted_data?: Json
          data_hash?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          security_settings: Json
          generator_settings: Json
          ui_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          security_settings?: Json
          generator_settings?: Json
          ui_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          security_settings?: Json
          generator_settings?: Json
          ui_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          event_type: 'vault_unlock' | 'vault_lock' | 'credential_created' | 'credential_updated' | 'credential_deleted' | 'settings_updated' | 'login_success' | 'login_failure' | 'password_changed'
          event_data: Json
          ip_address: string | null
          user_agent: string | null
          session_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: 'vault_unlock' | 'vault_lock' | 'credential_created' | 'credential_updated' | 'credential_deleted' | 'settings_updated' | 'login_success' | 'login_failure' | 'password_changed'
          event_data?: Json
          ip_address?: string | null
          user_agent?: string | null
          session_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: 'vault_unlock' | 'vault_lock' | 'credential_created' | 'credential_updated' | 'credential_deleted' | 'settings_updated' | 'login_success' | 'login_failure' | 'password_changed'
          event_data?: Json
          ip_address?: string | null
          user_agent?: string | null
          session_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string
          expires_at: string
          ip_address: string | null
          user_agent: string | null
          is_active: boolean
          created_at: string
          last_activity_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          expires_at: string
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          created_at?: string
          last_activity_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          expires_at?: string
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          created_at?: string
          last_activity_at?: string
        }
        Relationships: []
      }
      two_factor_attempts: {
        Row: {
          id: string
          user_id: string
          success: boolean
          error_message: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          success: boolean
          error_message?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          success?: boolean
          error_message?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      vault_backups: {
        Row: {
          id: string
          user_id: string
          vault_id: string
          encrypted_data: Json
          backup_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vault_id: string
          encrypted_data: Json
          backup_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          vault_id?: string
          encrypted_data?: Json
          backup_type?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_stats: {
        Row: {
          id: string
          email: string
          created_at: string
          last_login_at: string | null
          login_count: number
          total_audit_events: number
          vault_unlocks: number
          backup_count: number
          vault_last_updated: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      log_audit_event: {
        Args: {
          p_user_id: string
          p_event_type: 'vault_unlock' | 'vault_lock' | 'credential_created' | 'credential_updated' | 'credential_deleted' | 'settings_updated' | 'login_success' | 'login_failure' | 'password_changed'
          p_event_data?: Json
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: string
      }
      cleanup_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
      cleanup_old_backups: {
        Args: Record<PropertyKey, never>
        Returns: void
      }
      get_user_vault: {
        Args: {
          p_user_id: string
        }
        Returns: {
          vault_id: string
          encrypted_data: Json
          data_hash: string
          version: number
          created_at: string
          updated_at: string
        }[]
      }
      update_user_last_login: {
        Args: {
          p_user_id: string
        }
        Returns: void
      }
    }
    Enums: {
      user_status: 'active' | 'suspended' | 'deleted'
      audit_event_type: 'vault_unlock' | 'vault_lock' | 'credential_created' | 'credential_updated' | 'credential_deleted' | 'settings_updated' | 'login_success' | 'login_failure' | 'password_changed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for better type safety
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type Vault = Database['public']['Tables']['vaults']['Row']
export type VaultInsert = Database['public']['Tables']['vaults']['Insert']
export type VaultUpdate = Database['public']['Tables']['vaults']['Update']

export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert']
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update']

export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
export type AuditLogUpdate = Database['public']['Tables']['audit_logs']['Update']

export type UserSession = Database['public']['Tables']['user_sessions']['Row']
export type UserSessionInsert = Database['public']['Tables']['user_sessions']['Insert']
export type UserSessionUpdate = Database['public']['Tables']['user_sessions']['Update']

export type VaultBackup = Database['public']['Tables']['vault_backups']['Row']
export type VaultBackupInsert = Database['public']['Tables']['vault_backups']['Insert']
export type VaultBackupUpdate = Database['public']['Tables']['vault_backups']['Update']

export type UserStats = Database['public']['Views']['user_stats']['Row']

export type UserStatus = Database['public']['Enums']['user_status']
export type AuditEventType = Database['public']['Enums']['audit_event_type']

// Application-specific types
export interface EncryptedData {
  data: string // base64 encoded encrypted data
  iv: string   // base64 encoded initialization vector
  salt: string // base64 encoded salt
  iterations: number
  keyLength: number
}

export interface Credential {
  id: string
  title: string
  username: string
  password: string
  url?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface SecuritySettings {
  sessionTimeout: number
  autoLockOnIdle: boolean
  lockOnBrowserClose: boolean
  requireMasterPasswordConfirm: boolean
}

export interface GeneratorSettings {
  defaultLength: number
  includeLowercase: boolean
  includeUppercase: boolean
  includeNumbers: boolean
  includeSymbols: boolean
  excludeAmbiguous: boolean
}

export interface UISettings {
  theme: 'light' | 'dark' | 'system'
  language: 'pt-BR' | 'en-US'
  compactMode: boolean
  showPasswordStrength: boolean
  enableAnimations: boolean
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AuthUser {
  id: string
  email: string
  fullName?: string | undefined
  avatarUrl?: string | undefined
  status: UserStatus
  createdAt: string
  lastLoginAt?: string | undefined
  loginCount: number
} 
