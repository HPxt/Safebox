import { supabase } from '../config/supabase'

const configuredBackendUrl = process.env.REACT_APP_BACKEND_URL?.trim()

export const getBackendBaseUrl = (): string => {
  if (configuredBackendUrl) {
    return configuredBackendUrl.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3001/api'
    }
    return `${origin.replace(/\/+$/, '')}/api`
  }

  return 'http://localhost:3001/api'
}

export const getSupabaseAuthHeaders = async (): Promise<HeadersInit> => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('Sessao do Supabase nao encontrada')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export const backendRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers)
  const authHeaders = await getSupabaseAuthHeaders()

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value)
  }

  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  let invalidJson = false
  const payload = await response.json().catch(() => {
    invalidJson = true
    return {}
  })

  if (invalidJson) {
    throw new Error('Resposta invalida do backend')
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || 'Erro na comunicacao com o backend')
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    throw new Error('Resposta invalida do backend')
  }

  return payload.data as T
}
