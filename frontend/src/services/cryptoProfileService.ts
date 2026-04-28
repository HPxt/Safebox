import { backendRequest } from './backendApi'

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

export const getCryptoProfile = (): Promise<CryptoProfile> => {
  return backendRequest<CryptoProfile>('/auth/crypto-profile', {
    method: 'GET',
  })
}

export const updateCryptoProfile = (payload: CryptoProfileUpdate): Promise<CryptoProfile> => {
  return backendRequest<CryptoProfile>('/auth/crypto-profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
