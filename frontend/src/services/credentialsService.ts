import { supabase } from '../config/supabase'
import { Credential, CredentialFormData } from '../types'
import CryptoService from './cryptoService'
import { backendRequest } from './backendApi'

type VaultApiResponse = {
  id: string
  encryptedData: string
  dataHash: string
  version: number
  createdAt: string
  updatedAt: string
  storageMode: 'credentials' | 'vaults'
}

type EncryptedVaultEnvelope = {
  version: 'vault-snapshot-v2'
  nonce: string
  encrypted: string
}

type DirectVaultRecord = {
  id: string
  encryptedData: string
  dataHash: string
  version: number
  createdAt: string
  updatedAt: string
  storageMode: 'credentials' | 'vaults'
}

class CredentialsService {
  private masterKey: string | null = null
  private vaultUnlocked = false
  private currentVaultVersion: number | null = null

  private async getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      return session.user
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    return user
  }

  private async decryptLegacySnapshot(credentials: any[], cryptoKey: CryptoKey): Promise<Credential[]> {
    return Promise.all(
      credentials.map(async (credential) => {
        try {
          if (credential.encryptedPassword && credential.passwordNonce) {
            const decryptedPassword = await CryptoService.decrypt(
              credential.encryptedPassword,
              cryptoKey,
              credential.passwordNonce,
            )

            return {
              ...credential,
              encryptedPassword: decryptedPassword,
            }
          }

          return credential
        } catch {
          return credential
        }
      }),
    )
  }

  private async decryptVaultPayload(encryptedData: string, cryptoKey: CryptoKey): Promise<Credential[]> {
    const parsed = JSON.parse(encryptedData)

    if (Array.isArray(parsed)) {
      return this.decryptLegacySnapshot(parsed, cryptoKey)
    }

    if (parsed && typeof parsed === 'object' && parsed.version === 'vault-snapshot-v2') {
      const envelope = parsed as EncryptedVaultEnvelope
      const decrypted = await CryptoService.decrypt(envelope.encrypted, cryptoKey, envelope.nonce)
      const credentials = JSON.parse(decrypted)

      if (!Array.isArray(credentials)) {
        throw new Error('Vault snapshot decrypted to an invalid payload')
      }

      return credentials as Credential[]
    }

    throw new Error('Unsupported vault payload format')
  }

  private isVersionConflictError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return message.toLowerCase().includes('version conflict')
  }

  private async getVaultDirectFromSupabase(userId: string): Promise<DirectVaultRecord | null> {
    const { data: credentialRows, error: credentialError } = await supabase
      .from('credentials')
      .select('id, enc_blob, data_hash, version, created_at, updated_at')
      .eq('user_id', userId)
      .not('enc_blob', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (credentialError) {
      throw credentialError
    }

    const credentialVault = credentialRows?.[0]
    if (credentialVault?.enc_blob) {
      return {
        id: credentialVault.id,
        encryptedData: credentialVault.enc_blob,
        dataHash: credentialVault.data_hash,
        version: credentialVault.version ?? 1,
        createdAt: credentialVault.created_at,
        updatedAt: credentialVault.updated_at,
        storageMode: 'credentials',
      }
    }

    const { data: legacyVault, error: legacyError } = await supabase
      .from('vaults')
      .select('id, encrypted_data, data_hash, version, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (legacyError) {
      throw legacyError
    }

    if (!legacyVault) {
      return null
    }

    return {
      id: legacyVault.id,
      encryptedData: JSON.stringify(legacyVault.encrypted_data),
      dataHash: legacyVault.data_hash,
      version: legacyVault.version ?? 1,
      createdAt: legacyVault.created_at,
      updatedAt: legacyVault.updated_at,
      storageMode: 'vaults',
    }
  }

  private async getVault(): Promise<VaultApiResponse | null> {
    const user = await this.getCurrentUser()

    try {
      return await backendRequest<VaultApiResponse | null>('/vault', {
        method: 'GET',
      })
    } catch (error) {
      try {
        const fallbackVault = await this.getVaultDirectFromSupabase(user.id)
        if (!fallbackVault) {
          return null
        }

        return fallbackVault
      } catch (fallbackError: any) {
        if (fallbackError?.message?.toLowerCase().includes('not found')) {
          return null
        }

        throw fallbackError
      }
    }
  }

  private async calculateHash(value: string): Promise<string> {
    const data = new TextEncoder().encode(value)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }

  private async createEncryptedVaultSnapshot(credentials: Credential[], cryptoKey: CryptoKey): Promise<{
    encryptedData: string
    dataHash: string
  }> {
    const normalizedCredentials = credentials.map((credential) => ({
      ...credential,
      version: undefined,
    }))

    const serialized = JSON.stringify(normalizedCredentials)
    const { encrypted, nonce } = await CryptoService.encrypt(serialized, cryptoKey)
    const envelope: EncryptedVaultEnvelope = {
      version: 'vault-snapshot-v2',
      nonce,
      encrypted,
    }
    const encryptedData = JSON.stringify(envelope)

    return {
      encryptedData,
      dataHash: await this.calculateHash(encryptedData),
    }
  }

  setMasterKey(key: string) {
    this.masterKey = key
  }

  async getCredentials(): Promise<Credential[]> {
    try {
      await this.getCurrentUser()
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        return []
      }

      const vault = await this.getVault()
      if (!vault) {
        this.currentVaultVersion = null
        return []
      }

      this.currentVaultVersion = vault.version
      const credentials = await this.decryptVaultPayload(vault.encryptedData, cryptoKey)

      return credentials.map((credential) => ({
        ...credential,
        version: vault.version,
      }))
    } catch (error) {
      throw error
    }
  }

  async createCredential(credentialData: CredentialFormData): Promise<Credential> {
    try {
      const user = await this.getCurrentUser()
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        throw new Error('Vault esta bloqueado. Por favor, desbloqueie primeiro.')
      }

      let existingCredentials: Credential[] = []
      try {
        existingCredentials = await this.getCredentials()
      } catch {
        existingCredentials = []
      }

      if (!Array.isArray(existingCredentials)) {
        throw new Error('Credenciais atuais em formato invalido')
      }

      const newCredential: Credential = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        userId: user.id,
        title: credentialData.title,
        username: credentialData.username || '',
        email: credentialData.email || '',
        encryptedPassword: credentialData.password,
        website: credentialData.website || '',
        notes: credentialData.notes || '',
        folderId: credentialData.folderId || undefined,
        isFavorite: credentialData.isFavorite || false,
        isHidden: credentialData.isHidden || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itemType: credentialData.item_type || 'credential',
        totpSecret: credentialData.totp_secret || null,
        requireMasterPassword: credentialData.require_master_password || false,
        cardHolderName: credentialData.card_holder_name || null,
        cardNumber: credentialData.card_number || null,
        cardBrand: credentialData.card_brand || null,
        cardExpMonth: credentialData.card_exp_month || null,
        cardExpYear: credentialData.card_exp_year || null,
        cardCvv: credentialData.card_cvv || null,
      }

      await this.replaceCredentialsSnapshot([...existingCredentials, newCredential])
      return newCredential
    } catch (error) {
      throw error
    }
  }

  private async saveAllCredentials(credentials: Credential[]): Promise<void> {
    try {
      const user = await this.getCurrentUser()
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        throw new Error('Vault esta bloqueado. Por favor, desbloqueie primeiro.')
      }

      const snapshot = await this.createEncryptedVaultSnapshot(credentials, cryptoKey)

      if (this.currentVaultVersion === null) {
        try {
          const createdVault = await backendRequest<VaultApiResponse>('/vault', {
            method: 'POST',
            body: JSON.stringify(snapshot),
          })
          this.currentVaultVersion = createdVault.version
        } catch (error) {
          const { data, error: insertError } = await supabase
            .from('credentials')
            .insert({
              user_id: user.id,
              title: 'vault',
              encrypted_password: 'enc_blob_mode',
              enc_blob: snapshot.encryptedData,
              data_hash: snapshot.dataHash,
              version: 1,
            })
            .select('version')
            .maybeSingle()

          if (insertError) {
            throw insertError
          }

          this.currentVaultVersion = data?.version ?? 1
        }
        return
      }

      try {
        const updatedVault = await backendRequest<VaultApiResponse>('/vault', {
          method: 'PUT',
          body: JSON.stringify({
            ...snapshot,
            expectedVersion: this.currentVaultVersion,
          }),
        })

        this.currentVaultVersion = updatedVault.version
      } catch (error) {
        if (this.isVersionConflictError(error)) {
          throw error
        }

        const currentVault = await this.getVaultDirectFromSupabase(user.id)
        if (!currentVault) {
          throw error
        }

        if (currentVault.storageMode === 'credentials') {
          const { data, error: updateError } = await supabase
            .from('credentials')
            .update({
              enc_blob: snapshot.encryptedData,
              data_hash: snapshot.dataHash,
              version: currentVault.version + 1,
            })
            .eq('id', currentVault.id)
            .eq('user_id', user.id)
            .eq('version', this.currentVaultVersion)
            .select('version')
            .maybeSingle()

          if (updateError || !data) {
            throw new Error('Conflito de versao do cofre. Recarregue os dados antes de salvar novamente.')
          }

          this.currentVaultVersion = data.version
          return
        }

        const { data, error: legacyUpdateError } = await supabase
          .from('vaults')
          .update({
            encrypted_data: JSON.parse(snapshot.encryptedData),
            data_hash: snapshot.dataHash,
            version: currentVault.version + 1,
          })
          .eq('id', currentVault.id)
          .eq('user_id', user.id)
          .eq('version', this.currentVaultVersion)
          .select('version')
          .maybeSingle()

        if (legacyUpdateError || !data) {
          throw new Error('Conflito de versao do cofre. Recarregue os dados antes de salvar novamente.')
        }

        this.currentVaultVersion = data.version
      }
    } catch (error: any) {
      if (error?.message?.includes('version conflict')) {
        throw new Error('Conflito de versao do cofre. Recarregue os dados antes de salvar novamente.')
      }

      throw error
    }
  }

  async replaceCredentialsSnapshot(credentials: Credential[]): Promise<void> {
    const cryptoKey = await CryptoService.getStoredKey()
    if (!cryptoKey) {
      throw new Error('Vault esta bloqueado. Por favor, desbloqueie primeiro.')
    }

    const normalizedCredentials = credentials.map((credential) => ({
      ...credential,
      version: undefined,
    }))

    await this.saveAllCredentials(normalizedCredentials)
  }

  async updateCredential(id: string, updates: CredentialFormData): Promise<Credential> {
    try {
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        throw new Error('Vault esta bloqueado. Por favor, desbloqueie primeiro.')
      }

      const credentials = await this.getCredentials()
      const index = credentials.findIndex((credential) => credential.id === id)
      if (index === -1) {
        throw new Error('Credential not found')
      }

      const updatedCredential: Credential = {
        ...credentials[index],
        title: updates.title,
        username: updates.username || '',
        email: updates.email || '',
        encryptedPassword: updates.password || credentials[index].encryptedPassword,
        website: updates.website || '',
        notes: updates.notes || '',
        folderId: updates.folderId || undefined,
        isFavorite: updates.isFavorite || false,
        isHidden: updates.isHidden ?? credentials[index].isHidden ?? false,
        updatedAt: new Date().toISOString(),
      }

      const allCredentials = credentials.map((credential, currentIndex) => (
        currentIndex === index ? updatedCredential : credential
      ))

      await this.replaceCredentialsSnapshot(allCredentials)
      return updatedCredential
    } catch (error) {
      throw error
    }
  }

  async deleteCredential(id: string): Promise<void> {
    try {
      const credentials = await this.getCredentials()
      const filteredCredentials = credentials.filter((credential) => credential.id !== id)
      await this.replaceCredentialsSnapshot(filteredCredentials)
    } catch (error) {
      throw error
    }
  }

  async getCredentialsByFolder(folderId: string): Promise<Credential[]> {
    try {
      const allCredentials = await this.getCredentials()
      return allCredentials.filter((credential) => credential.folderId === folderId)
    } catch {
      return []
    }
  }

  async unlockVault(masterPassword: string): Promise<boolean> {
    try {
      const user = await this.getCurrentUser()
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: masterPassword,
      })

      if (error) {
        this.masterKey = null
        return false
      }

      this.setMasterKey(masterPassword)
      this.vaultUnlocked = true
      return true
    } catch {
      this.masterKey = null
      return false
    }
  }

  lockVault() {
    this.masterKey = null
    this.vaultUnlocked = false
    this.currentVaultVersion = null
  }

  isUnlocked(): boolean {
    return this.vaultUnlocked
  }

  getVaultStatus(): boolean {
    return this.vaultUnlocked
  }
}

export const credentialsService = new CredentialsService()
