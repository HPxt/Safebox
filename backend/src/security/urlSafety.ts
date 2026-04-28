const MAX_CLEAN_URL_LENGTH = 1000

const BLOCKED_RESOURCE_EXTENSIONS = [
  '.apng',
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.xml',
]

const IPV4_PRIVATE_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
]

const normalizeInput = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

const hasUnsafeWhitespaceOrControl = (value: string): boolean => {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 32 || code === 127) {
      return true
    }
  }

  return false
}

const isLocalOrPrivateHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '')

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return IPV4_PRIVATE_PATTERNS.some((pattern) => pattern.test(host))
  }

  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return true
  }

  return false
}

export const toCleanPublicUrl = (value: string | null | undefined): string => {
  if (!value) {
    return ''
  }

  const normalized = normalizeInput(value)

  if (!normalized || normalized.length > MAX_CLEAN_URL_LENGTH || hasUnsafeWhitespaceOrControl(normalized)) {
    return ''
  }

  try {
    const parsed = new URL(normalized)
    const path = parsed.pathname.toLowerCase()

    if (parsed.protocol !== 'https:') {
      return ''
    }

    if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return ''
    }

    if (isLocalOrPrivateHost(parsed.hostname)) {
      return ''
    }

    if (BLOCKED_RESOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
      return ''
    }

    parsed.hostname = parsed.hostname.toLowerCase()
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/')

    return parsed.toString()
  } catch {
    return ''
  }
}

export const isCleanPublicUrl = (value: string | null | undefined): boolean => {
  if (!value || !value.trim()) {
    return true
  }

  return toCleanPublicUrl(value) !== ''
}
