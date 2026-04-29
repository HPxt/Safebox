import { backendRequest } from './backendApi'
import { supabase } from '../config/supabase'

export type KdfParams = {
  algorithm: 'argon2id'
  memorySize: number
  iterations: number
  parallelism: number
  hashLength: number
}

export type CryptoProfile = {
  kdfSalt: string | null
  kdfParams: KdfParams | null
  keyHash: string | null
}

export type CryptoProfileUpdate = {
  kdfSalt: string
  kdfParams: KdfParams
  keyHash: string
  currentKeyHash?: string
}

const getCurrentUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.id) {
    throw new Error('Usuario nao autenticado')
  }

  return user.id
}

const mapCryptoProfileRow = (row: {
  kdf_salt?: string | null
  kdf_params?: KdfParams | null
  key_hash?: string | null
} | null): CryptoProfile => ({
  kdfSalt: row?.kdf_salt ?? null,
  kdfParams: row?.kdf_params ?? null,
  keyHash: row?.key_hash ?? null,
})

const getCryptoProfileDirectly = async (): Promise<CryptoProfile> => {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('users')
    .select('kdf_salt, kdf_params, key_hash')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return mapCryptoProfileRow(data)
}

export const getCryptoProfile = async (): Promise<CryptoProfile> => {
  try {
    return await backendRequest<CryptoProfile>('/auth/crypto-profile', {
      method: 'GET',
    })
  } catch {
    return getCryptoProfileDirectly()
  }
}

export const updateCryptoProfile = async (payload: CryptoProfileUpdate): Promise<CryptoProfile> => {
  try {
    return await backendRequest<CryptoProfile>('/auth/crypto-profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  } catch (backendError) {
    const userId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('users')
      .update({
        kdf_salt: payload.kdfSalt,
        kdf_params: payload.kdfParams,
        key_hash: payload.keyHash,
      })
      .eq('id', userId)
      .select('kdf_salt, kdf_params, key_hash')
      .maybeSingle()

    if (error || !data) {
      throw backendError instanceof Error
        ? backendError
        : new Error('Nao foi possivel salvar o perfil criptografico')
    }

    return mapCryptoProfileRow(data)
  }
}
