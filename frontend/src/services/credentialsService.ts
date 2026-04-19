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

  private async getVault(): Promise<VaultApiResponse | null> {
    try {
      return await backendRequest<VaultApiResponse | null>('/vault', {
        method: 'GET',
      })
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('not found')) {
        return null
      }

      throw error
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
      console.error('Error in getCredentials:', error)
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
      console.error('Error in createCredential:', error)
      throw error
    }
  }

  private async saveAllCredentials(credentials: Credential[]): Promise<void> {
    try {
      await this.getCurrentUser()
      const cryptoKey = await CryptoService.getStoredKey()
      if (!cryptoKey) {
        throw new Error('Vault esta bloqueado. Por favor, desbloqueie primeiro.')
      }

      const snapshot = await this.createEncryptedVaultSnapshot(credentials, cryptoKey)

      if (this.currentVaultVersion === null) {
        const createdVault = await backendRequest<VaultApiResponse>('/vault', {
          method: 'POST',
          body: JSON.stringify(snapshot),
        })
        this.currentVaultVersion = createdVault.version
        return
      }

      const updatedVault = await backendRequest<VaultApiResponse>('/vault', {
        method: 'PUT',
        body: JSON.stringify({
          ...snapshot,
          expectedVersion: this.currentVaultVersion,
        }),
      })

      this.currentVaultVersion = updatedVault.version
    } catch (error: any) {
      if (error?.message?.includes('version conflict')) {
        throw new Error('Conflito de versao do cofre. Recarregue os dados antes de salvar novamente.')
      }

      console.error('Error saving credentials:', error)
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
      console.error('Error updating credential:', error)
      throw error
    }
  }

  async deleteCredential(id: string): Promise<void> {
    try {
      const credentials = await this.getCredentials()
      const filteredCredentials = credentials.filter((credential) => credential.id !== id)
      await this.replaceCredentialsSnapshot(filteredCredentials)
    } catch (error) {
      console.error('Error deleting credential:', error)
      throw error
    }
  }

  async getCredentialsByFolder(folderId: string): Promise<Credential[]> {
    try {
      const allCredentials = await this.getCredentials()
      return allCredentials.filter((credential) => credential.folderId === folderId)
    } catch (error) {
      console.error('Error in getCredentialsByFolder:', error)
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
        console.error('Invalid master password:', error.message)
        this.masterKey = null
        return false
      }

      this.setMasterKey(masterPassword)
      this.vaultUnlocked = true
      return true
    } catch (error) {
      console.error('Failed to unlock vault:', error)
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
