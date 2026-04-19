import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { ExternalServiceError, ForbiddenError } from '@/security/errors'

const DEFAULT_HTTP_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RETRIES = 2
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

const normalizeHost = (host: string): string => host.trim().toLowerCase()

const isPrivateIPv4 = (host: string): boolean => {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host)
  if (!match) {
    return false
  }

  const first = Number(match[1])
  const second = Number(match[2])

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  )
}

const escapePattern = (value: string): string => {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

const matchesHostPattern = (host: string, pattern: string): boolean => {
  const normalizedHost = normalizeHost(host)
  const normalizedPattern = normalizeHost(pattern)

  if (!normalizedPattern.includes('*')) {
    return normalizedHost === normalizedPattern
  }

  const regex = new RegExp(`^${escapePattern(normalizedPattern).replace(/\*/g, '.*')}$`, 'i')
  return regex.test(normalizedHost)
}

const resolveUrl = (input: string, baseURL?: string): URL => {
  try {
    return baseURL ? new URL(input, baseURL) : new URL(input)
  } catch {
    throw new ExternalServiceError('Invalid outbound URL')
  }
}

export const getDefaultOutboundAllowlist = (): string[] => {
  const configured = process.env['OUTBOUND_HTTP_ALLOWLIST']

  if (!configured) {
    return ['localhost', '127.0.0.1', '::1']
  }

  return configured
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

export const assertAllowedOutboundUrl = (input: string, allowedHosts?: string[], baseURL?: string): URL => {
  const url = resolveUrl(input, baseURL)
  const hostname = normalizeHost(url.hostname)
  const allowlist = (allowedHosts ?? getDefaultOutboundAllowlist()).map(normalizeHost)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ForbiddenError('Outbound protocol is not allowed')
  }

  if (url.username || url.password) {
    throw new ForbiddenError('Outbound credentials in URL are not allowed')
  }

  const hostAllowed = allowlist.some(pattern => matchesHostPattern(hostname, pattern))

  if (!hostAllowed) {
    throw new ForbiddenError(`Outbound host is not allowed: ${hostname}`)
  }

  if (isPrivateIPv4(hostname) && !LOCAL_HOSTS.has(hostname)) {
    throw new ForbiddenError(`Private outbound address is not allowed: ${hostname}`)
  }

  if (url.protocol === 'http:' && !LOCAL_HOSTS.has(hostname)) {
    throw new ForbiddenError(`Plain HTTP is only allowed for localhost targets: ${hostname}`)
  }

  return url
}

const isRetryableError = (error: AxiosError): boolean => {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true
  }

  const status = error.response?.status
  return status === 408 || status === 429 || (status !== undefined && status >= 500)
}

export const createSecureHttpClient = ({
  baseURL,
  allowHosts,
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  headers,
}: {
  baseURL?: string
  allowHosts?: string[]
  timeoutMs?: number
  maxRetries?: number
  headers?: Record<string, string>
} = {}): AxiosInstance => {
  const client = axios.create({
    timeout: timeoutMs,
    maxRedirects: 0,
    validateStatus: status => status >= 200 && status < 300,
    ...(baseURL ? { baseURL } : {}),
    ...(headers ? { headers } : {}),
  })

  client.interceptors.request.use(config => {
    const target = config.url ?? ''
    assertAllowedOutboundUrl(target, allowHosts, config.baseURL ?? baseURL)
    return config
  })

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const config = (error.config ?? {}) as AxiosRequestConfig & { __retryCount?: number }
      const retryCount = config.__retryCount ?? 0

      if (!isRetryableError(error) || retryCount >= maxRetries) {
        throw new ExternalServiceError(error.message || 'Outbound request failed')
      }

      config.__retryCount = retryCount + 1
      return client.request(config)
    },
  )

  return client
}

export const isAllowedCorsOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  let normalizedOrigin: string

  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    return false
  }

  return allowedOrigins.some(pattern => {
    const normalizedPattern = pattern.trim()
    if (!normalizedPattern) {
      return false
    }

    if (!normalizedPattern.includes('*')) {
      return normalizedOrigin === normalizedPattern
    }

    const regex = new RegExp(`^${escapePattern(normalizedPattern).replace(/\*/g, '.*')}$`, 'i')
    return regex.test(normalizedOrigin)
  })
}
