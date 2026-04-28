import { supabase } from '../config/supabase'
import CryptoService from './cryptoService'
import { credentialsService } from './credentialsService'
import { foldersService } from './foldersService'
import {
  SafeBoxExportData,
  ExportCredential,
  BitwardenExport,
  CSVRow,
  CSV_MAPPINGS,
  ExportFormat,
  ImportSource
} from '../types/import-export'
import { Credential, Folder } from '../types'
import {
  mergeCredentialSnapshots,
  toExportCredential,
} from './importExportUtils'
import { toCleanPublicUrl } from '../utils/urlSafety'

type EncryptedExportEnvelope = {
  encrypted?: boolean
  salt?: string
  nonce?: string
  data?: string
  crypto?: {
    salt: string
    secondSalt: string
    nonce: string
    integrityHash?: string
  }
}

export class ImportExportService {
  static async exportData(
    format: ExportFormat,
    password?: string
  ): Promise<{ data: string | Blob; filename: string }> {
    try {
      await this.ensureVaultUnlocked()

      const folders = await foldersService.getFolders()
      const credentials = await credentialsService.getCredentials()

      switch (format) {
        case 'json':
          return this.exportJSON(folders, credentials)
        case 'json-encrypted':
          if (!password) {
            throw new Error('Senha necessária para exportação criptografada')
          }
          return this.exportEncryptedJSON(folders, credentials, password)
        case 'csv':
          return this.exportCSV(folders, credentials)
        case 'zip':
          return this.exportZIP(folders, credentials)
        default:
          throw new Error('Formato de exportação não suportado')
      }
    } catch (error) {
      throw error
    }
  }

  static async importData(
    file: File,
    source: ImportSource,
    password?: string,
    targetFolderId?: string | null
  ): Promise<{ imported: number; errors: string[] }> {
    try {
      await this.ensureVaultUnlocked()
      const content = await this.readFile(file)

      switch (source) {
        case 'safebox-json':
          return this.importSafeBoxJSON(content, password, targetFolderId)
        case 'bitwarden':
          return file.name.endsWith('.json')
            ? this.importBitwardenJSON(content, targetFolderId)
            : this.importCSV(content, 'bitwarden', targetFolderId)
        case 'generic-csv':
          return this.importGenericCSV(content, targetFolderId)
        default:
          if (CSV_MAPPINGS[source]) {
            return this.importCSV(content, source as keyof typeof CSV_MAPPINGS, targetFolderId)
          }
          throw new Error('Formato de importação não suportado')
      }
    } catch (error) {
      throw error
    }
  }

  private static buildSafeBoxExportData(
    folders: Folder[],
    credentials: Credential[]
  ): SafeBoxExportData {
    return {
      version: '2.0',
      exportDate: new Date().toISOString(),
      folders: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt
      })),
      credentials: credentials.map((credential) => toExportCredential(credential)),
      metadata: {
        appVersion: '2.0.0',
        totalItems: credentials.length,
        encrypted: false
      }
    }
  }

  private static exportJSON(
    folders: Folder[],
    credentials: Credential[]
  ): { data: string; filename: string } {
    const exportData = this.buildSafeBoxExportData(folders, credentials)

    return {
      data: JSON.stringify(exportData, null, 2),
      filename: `safebox-export-${new Date().toISOString().split('T')[0]}.json`
    }
  }

  private static async exportEncryptedJSON(
    folders: Folder[],
    credentials: Credential[],
    password: string
  ): Promise<{ data: string; filename: string }> {
    const validation = CryptoService.validatePasswordStrength(password)

    if (validation.blocked) {
      throw new Error(`Senha de exportação rejeitada: ${validation.blockReason}`)
    }

    if (!validation.isValid) {
      throw new Error(`Senha de exportação muito fraca (${validation.score}/10). Use pelo menos 7 pontos. Problemas: ${validation.feedback.join(', ')}`)
    }

    const exportData = this.buildSafeBoxExportData(folders, credentials)
    const salt = CryptoService.generateSalt()
    const firstKey = await CryptoService.deriveKey(password, salt, {
      parallelism: 4,
      iterations: 8,
      memorySize: 262144,
      hashLength: 32
    })

    const keyData = await crypto.subtle.exportKey('raw', firstKey)
    const keyHash = await crypto.subtle.digest('SHA-256', keyData)
    const intermediatePassword = this.bytesToBase64(new Uint8Array(keyHash))

    const secondSalt = CryptoService.generateSalt()
    const finalKey = await CryptoService.deriveKey(intermediatePassword, secondSalt)
    const { encrypted, nonce } = await CryptoService.encrypt(JSON.stringify({
      version: '2.0',
      exportDate: new Date().toISOString(),
      data: exportData
    }), finalKey)

    const integrityHash = await this.createIntegrityHash({
      salt,
      secondSalt,
      nonce,
      encrypted
    })

    const envelope = {
      version: '2.0',
      format: 'safebox-encrypted',
      algorithm: 'argon2id-double-aes256gcm',
      encrypted: true,
      metadata: {
        exportDate: new Date().toISOString(),
        securityLevel: 'maximum',
        createdBy: 'SafeBox'
      },
      crypto: {
        salt,
        secondSalt,
        nonce,
        integrityHash
      },
      data: encrypted
    }

    return {
      data: JSON.stringify(envelope, null, 2),
      filename: `safebox-secure-export-${new Date().toISOString().split('T')[0]}.json`
    }
  }

  private static exportCSV(
    folders: Folder[],
    credentials: Credential[]
  ): { data: string; filename: string } {
    const headers = ['folder', 'name', 'username', 'email', 'password', 'url', 'notes', 'totp', 'type', 'favorite', 'hidden']
    const rows = [headers.join(',')]
    const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]))

    credentials.forEach((credential) => {
      const exported = toExportCredential(credential)
      rows.push([
        this.escapeCSV(exported.folderId ? folderMap.get(exported.folderId) || '' : ''),
        this.escapeCSV(exported.title),
        this.escapeCSV(exported.username || ''),
        this.escapeCSV(exported.email || ''),
        this.escapeCSV(exported.password || ''),
        this.escapeCSV(exported.url || ''),
        this.escapeCSV(exported.notes || ''),
        this.escapeCSV(exported.totp || ''),
        this.escapeCSV(exported.itemType || 'credential'),
        this.escapeCSV(String(Boolean(exported.favorite))),
        this.escapeCSV(String(Boolean(exported.isHidden)))
      ].join(','))
    })

    return {
      data: rows.join('\n'),
      filename: `safebox-export-${new Date().toISOString().split('T')[0]}.csv`
    }
  }

  private static async exportZIP(
    folders: Folder[],
    credentials: Credential[]
  ): Promise<{ data: Blob; filename: string }> {
    const { data } = this.exportJSON(folders, credentials)
    return {
      data: new Blob([data], { type: 'application/json' }),
      filename: `safebox-export-${new Date().toISOString().split('T')[0]}.zip`
    }
  }

  private static async importSafeBoxJSON(
    content: string,
    password?: string,
    targetFolderId?: string | null
  ): Promise<{ imported: number; errors: string[] }> {
    const parsed = JSON.parse(content)
    const data = parsed.encrypted
      ? await this.decryptSafeBoxExport(parsed, password)
      : parsed as SafeBoxExportData

    const user = await this.getCurrentUser()
    const folderIdMap = await this.ensureFolders(user.id, data.folders || [], targetFolderId)

    const importedCredentials = (data.credentials || []).map((credential) =>
      this.normalizeImportedCredential(user.id, credential, folderIdMap, targetFolderId)
    )

    return this.persistImportedCredentials(importedCredentials, [])
  }

  private static async importBitwardenJSON(
    content: string,
    targetFolderId?: string | null
  ): Promise<{ imported: number; errors: string[] }> {
    const data: BitwardenExport = JSON.parse(content)
    const user = await this.getCurrentUser()
    const folderDefinitions = (data.folders || []).map((folder) => ({
      id: folder.id,
      name: folder.name
    }))
    const folderIdMap = await this.ensureFolders(user.id, folderDefinitions, targetFolderId)

    const importedCredentials: Credential[] = []
    const errors: string[] = []

    for (const item of data.items || []) {
      if (item.type !== 1) {
        continue
      }

      try {
        importedCredentials.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          userId: user.id,
          title: item.name || 'Sem título',
          username: item.login?.username || '',
          email: item.login?.username && this.isEmail(item.login.username) ? item.login.username : '',
          encryptedPassword: item.login?.password || '',
          website: toCleanPublicUrl(item.login?.uris?.[0]?.uri),
          notes: item.notes || '',
          folderId: targetFolderId || (item.folderId ? folderIdMap.get(item.folderId) || undefined : undefined),
          isFavorite: item.favorite || false,
          isHidden: false,
          itemType: 'credential',
          totpSecret: item.login?.totp || null,
          requireMasterPassword: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } catch (error: any) {
        errors.push(`Erro ao importar item "${item.name}": ${error.message || error}`)
      }
    }

    return this.persistImportedCredentials(importedCredentials, errors)
  }

  private static async importCSV(
    content: string,
    format: keyof typeof CSV_MAPPINGS,
    targetFolderId?: string | null
  ): Promise<{ imported: number; errors: string[] }> {
    const rows = this.parseCSV(content)
    const mapping = CSV_MAPPINGS[format]
    return this.importRowsWithMapping(rows, mapping, targetFolderId)
  }

  private static async importGenericCSV(
    content: string,
    targetFolderId?: string | null
  ): Promise<{ imported: number; errors: string[] }> {
    const rows = this.parseCSV(content)
    if (rows.length === 0) {
      throw new Error('Arquivo CSV vazio')
    }

    const mapping = this.detectCSVMapping(Object.keys(rows[0]))
    return this.importRowsWithMapping(rows, mapping, targetFolderId)
  }

  private static async importRowsWithMapping(
    rows: CSVRow[],
    mapping: typeof CSV_MAPPINGS.generic,
    targetFolderId?: string | null
  ): Promise<{ imported: number; errors: string[] }> {
    const user = await this.getCurrentUser()
    const importedCredentials: Credential[] = []
    const errors: string[] = []
    const folderDefinitions = new Map<string, { id: string; name: string }>()

    for (const row of rows) {
      const folderName = this.extractValue(row, mapping.folder)
      if (!targetFolderId && folderName) {
        folderDefinitions.set(folderName.toLowerCase(), {
          id: folderName,
          name: folderName
        })
      }
    }

    const folderIdMap = await this.ensureFolders(user.id, Array.from(folderDefinitions.values()), targetFolderId)

    for (const row of rows) {
      try {
        const title = this.extractValue(row, mapping.title) || 'Sem título'
        const username = this.extractValue(row, mapping.username) || ''
        importedCredentials.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          userId: user.id,
          title,
          username,
          email: this.isEmail(username) ? username : '',
          encryptedPassword: this.extractValue(row, mapping.password) || '',
          website: toCleanPublicUrl(this.extractValue(row, mapping.url)),
          notes: this.extractValue(row, mapping.notes) || '',
          folderId: targetFolderId || (() => {
            const folderName = this.extractValue(row, mapping.folder)
            return folderName ? folderIdMap.get(folderName) || undefined : undefined
          })(),
          isFavorite: false,
          isHidden: false,
          itemType: 'credential',
          totpSecret: this.extractValue(row, mapping.totp) || null,
          requireMasterPassword: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } catch (error: any) {
        errors.push(`Erro ao importar linha: ${error.message || error}`)
      }
    }

    return this.persistImportedCredentials(importedCredentials, errors)
  }

  private static async persistImportedCredentials(
    importedCredentials: Credential[],
    existingErrors: string[]
  ): Promise<{ imported: number; errors: string[] }> {
    const currentCredentials = await credentialsService.getCredentials()
    const { mergedCredentials, importedCount, duplicateTitles } = mergeCredentialSnapshots(
      currentCredentials,
      importedCredentials
    )

    if (importedCount > 0) {
      await credentialsService.replaceCredentialsSnapshot(mergedCredentials)
    }

    const duplicateErrors = duplicateTitles.map((title) => `Credencial "${title}" já existe - ignorada`)

    return {
      imported: importedCount,
      errors: [...existingErrors, ...duplicateErrors]
    }
  }

  private static normalizeImportedCredential(
    userId: string,
    credential: ExportCredential,
    folderIdMap: Map<string, string>,
    targetFolderId?: string | null
  ): Credential {
    return {
      id: credential.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      userId,
      title: credential.title || 'Sem título',
      username: credential.username || '',
      email: credential.email || '',
      encryptedPassword: credential.password || '',
      website: toCleanPublicUrl(credential.url),
      notes: credential.notes || '',
      folderId: targetFolderId || (credential.folderId ? folderIdMap.get(credential.folderId) || undefined : undefined),
      isFavorite: credential.favorite || false,
      isHidden: credential.isHidden || false,
      itemType: credential.itemType || 'credential',
      totpSecret: credential.totp || null,
      requireMasterPassword: credential.requireMasterPassword || false,
      cardHolderName: credential.cardHolderName ?? null,
      cardNumber: credential.cardNumber ?? null,
      cardBrand: credential.cardBrand ?? null,
      cardExpMonth: credential.cardExpMonth ?? null,
      cardExpYear: credential.cardExpYear ?? null,
      cardCvv: credential.cardCvv ?? null,
      createdAt: credential.createdAt || new Date().toISOString(),
      updatedAt: credential.updatedAt || new Date().toISOString()
    }
  }

  private static async ensureFolders(
    userId: string,
    importedFolders: Array<{ id: string; name: string; color?: string; icon?: string }>,
    targetFolderId?: string | null
  ): Promise<Map<string, string>> {
    const folderIdMap = new Map<string, string>()
    if (targetFolderId) {
      importedFolders.forEach((folder) => folderIdMap.set(folder.id, targetFolderId))
      return folderIdMap
    }

    const existingFolders = await foldersService.getFolders()
    const existingByName = new Map(existingFolders.map((folder) => [folder.name.trim().toLowerCase(), folder.id]))

    for (const folder of importedFolders) {
      const key = folder.name.trim().toLowerCase()
      const existingFolderId = existingByName.get(key)

      if (existingFolderId) {
        folderIdMap.set(folder.id, existingFolderId)
        continue
      }

      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: userId,
          name: folder.name,
          color: folder.color,
          icon: folder.icon
        })
        .select('id')
        .single()

      if (error) {
        throw error
      }

      folderIdMap.set(folder.id, data.id)
      existingByName.set(key, data.id)
    }

    return folderIdMap
  }

  private static async decryptSafeBoxExport(
    parsed: EncryptedExportEnvelope,
    password?: string
  ): Promise<SafeBoxExportData> {
    if (!password) {
      throw new Error('Senha necessária para importar arquivo criptografado')
    }

    if (parsed.crypto?.salt && parsed.crypto.secondSalt && parsed.crypto.nonce && parsed.data) {
      const integrityHash = await this.createIntegrityHash({
        salt: parsed.crypto.salt,
        secondSalt: parsed.crypto.secondSalt,
        nonce: parsed.crypto.nonce,
        encrypted: parsed.data
      })

      if (parsed.crypto.integrityHash && integrityHash !== parsed.crypto.integrityHash) {
        throw new Error('Falha na verificação de integridade do backup')
      }

      const firstKey = await CryptoService.deriveKey(password, parsed.crypto.salt, {
        parallelism: 4,
        iterations: 8,
        memorySize: 262144,
        hashLength: 32
      })
      const keyData = await crypto.subtle.exportKey('raw', firstKey)
      const keyHash = await crypto.subtle.digest('SHA-256', keyData)
      const intermediatePassword = this.bytesToBase64(new Uint8Array(keyHash))
      const finalKey = await CryptoService.deriveKey(intermediatePassword, parsed.crypto.secondSalt)
      const decrypted = await CryptoService.decrypt(parsed.data, finalKey, parsed.crypto.nonce)
      const parsedPayload = JSON.parse(decrypted)

      return parsedPayload.data as SafeBoxExportData
    }

    if (parsed.salt && parsed.nonce && parsed.data) {
      const key = await CryptoService.deriveKey(password, parsed.salt)
      const decrypted = await CryptoService.decrypt(parsed.data, key, parsed.nonce)
      return JSON.parse(decrypted) as SafeBoxExportData
    }

    throw new Error('Formato de backup criptografado não reconhecido')
  }

  private static async createIntegrityHash(payload: {
    salt: string
    secondSalt: string
    nonce: string
    encrypted: string
  }): Promise<string> {
    const data = new TextEncoder().encode(JSON.stringify(payload))
    const digest = await crypto.subtle.digest('SHA-256', data)
    return this.bytesToBase64(new Uint8Array(digest))
  }

  private static async ensureVaultUnlocked(): Promise<void> {
    const key = await CryptoService.getStoredKey()
    if (!key) {
      throw new Error('O cofre precisa estar desbloqueado. Por favor, desbloqueie o cofre com sua senha mestre primeiro.')
    }
  }

  private static async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuário não autenticado')
    }
    return user
  }

  private static readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => resolve(event.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  private static escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  private static parseCSV(content: string): CSVRow[] {
    const lines = content.trim().split('\n').filter(Boolean)
    if (lines.length < 2) {
      return []
    }

    const headers = this.parseCSVLine(lines[0])
    return lines.slice(1).map((line) => {
      const values = this.parseCSVLine(line)
      const row: CSVRow = {}

      headers.forEach((header, index) => {
        row[header.toLowerCase().trim()] = values[index]?.trim() || ''
      })

      return row
    })
  }

  private static parseCSVLine(line: string): string[] {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let index = 0; index < line.length; index++) {
      const char = line[index]
      const nextChar = line[index + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          index++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }

    values.push(current)
    return values
  }

  private static extractValue(row: CSVRow, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = row[key.toLowerCase()]
      if (value) {
        return value
      }
    }

    return undefined
  }

  private static detectCSVMapping(headers: string[]): typeof CSV_MAPPINGS.generic {
    const normalizedHeaders = headers.map((header) => header.toLowerCase().trim())

    return {
      title: normalizedHeaders.filter((header) => header.includes('title') || header.includes('name') || header.includes('site')),
      username: normalizedHeaders.filter((header) => header.includes('username') || header.includes('user') || header.includes('login') || header.includes('email')),
      password: normalizedHeaders.filter((header) => header.includes('password') || header.includes('pass')),
      url: normalizedHeaders.filter((header) => header.includes('url') || header.includes('website') || header.includes('domain')),
      notes: normalizedHeaders.filter((header) => header.includes('note') || header.includes('comment') || header.includes('description')),
      folder: normalizedHeaders.filter((header) => header.includes('folder') || header.includes('category') || header.includes('group')),
      totp: normalizedHeaders.filter((header) => header.includes('totp') || header.includes('2fa') || header.includes('otp'))
    }
  }

  private static bytesToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...Array.from(bytes)))
  }

  private static isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }
}

export default ImportExportService
