const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'session',
  'csrf',
  'jwt',
  'enc_blob',
  'encrypted',
  'backup_code',
  'totp',
  'otp',
  'key',
  'credential',
  'service_role',
  'anon_key',
]

const REDACTED_VALUE = '[REDACTED]'

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]'
}

const shouldRedactKey = (key?: string): boolean => {
  if (!key) {
    return false
  }

  const normalized = key.toLowerCase()
  return SENSITIVE_KEY_FRAGMENTS.some(fragment => normalized.includes(fragment))
}

const redactString = (value: string): string => {
  const trimmed = value.trim()

  if (!trimmed) {
    return value
  }

  if (/^bearer\s+/i.test(trimmed)) {
    return 'Bearer [REDACTED]'
  }

  if (
    trimmed.length > 24 &&
    (/^[A-Za-z0-9+/=._-]+$/.test(trimmed) || trimmed.includes('.'))
  ) {
    return REDACTED_VALUE
  }

  return value
}

export const redactValue = (value: unknown, key?: string): unknown => {
  if (value === null || value === undefined) {
    return value
  }

  if (shouldRedactKey(key)) {
    return REDACTED_VALUE
  }

  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, key))
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    }
  }

  if (typeof value === 'string') {
    return redactString(value)
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    )
  }

  return value
}

export const redactObject = <T>(value: T): T => {
  return redactValue(value) as T
}

export const redactErrorForClient = (error: unknown): string => {
  if (error instanceof Error) {
    return redactString(error.message)
  }

  return 'Unexpected error'
}

export const REDACTION_PLACEHOLDER = REDACTED_VALUE
