import { Credential } from '../types'
import { ExportCredential } from '../types/import-export'

type CredentialLike = Partial<Credential> & {
  password?: string
  url?: string
  favorite?: boolean
}

const normalizeText = (value?: string | null): string => (value || '').trim().toLowerCase()

export const getCredentialPlainPassword = (credential: CredentialLike): string => {
  return credential.password ?? credential.encryptedPassword ?? ''
}

export const getCredentialUrl = (credential: CredentialLike): string => {
  return credential.url ?? credential.website ?? ''
}

export const createCredentialFingerprint = (credential: CredentialLike): string => {
  const itemType = normalizeText(credential.itemType)
  const title = normalizeText(credential.title)
  const username = normalizeText(credential.username)
  const email = normalizeText(credential.email)
  const website = normalizeText(getCredentialUrl(credential))

  return [itemType, title, username, email, website].join('|')
}

export const toExportCredential = (credential: CredentialLike): ExportCredential => {
  return {
    id: credential.id || crypto.randomUUID(),
    folderId: credential.folderId ?? null,
    title: credential.title || 'Sem titulo',
    username: credential.username || '',
    email: credential.email || '',
    password: getCredentialPlainPassword(credential),
    url: getCredentialUrl(credential),
    notes: credential.notes || '',
    totp: credential.totpSecret || null,
    favorite: credential.favorite ?? credential.isFavorite ?? false,
    isHidden: credential.isHidden ?? false,
    itemType: credential.itemType || 'credential',
    requireMasterPassword: credential.requireMasterPassword ?? false,
    cardHolderName: credential.cardHolderName ?? null,
    cardNumber: credential.cardNumber ?? null,
    cardBrand: credential.cardBrand ?? null,
    cardExpMonth: credential.cardExpMonth ?? null,
    cardExpYear: credential.cardExpYear ?? null,
    cardCvv: credential.cardCvv ?? null,
    createdAt: credential.createdAt || new Date().toISOString(),
    updatedAt: credential.updatedAt || new Date().toISOString(),
  }
}

export const mergeCredentialSnapshots = (
  existingCredentials: Credential[],
  importedCredentials: Credential[],
): { mergedCredentials: Credential[]; importedCount: number; duplicateTitles: string[] } => {
  const knownFingerprints = new Set(existingCredentials.map(createCredentialFingerprint))
  const mergedCredentials = [...existingCredentials]
  const duplicateTitles: string[] = []

  for (const credential of importedCredentials) {
    const fingerprint = createCredentialFingerprint(credential)
    if (knownFingerprints.has(fingerprint)) {
      duplicateTitles.push(credential.title || 'Sem titulo')
      continue
    }

    knownFingerprints.add(fingerprint)
    mergedCredentials.push(credential)
  }

  return {
    mergedCredentials,
    importedCount: importedCredentials.length - duplicateTitles.length,
    duplicateTitles,
  }
}
