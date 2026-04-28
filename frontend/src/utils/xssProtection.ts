import DOMPurify from 'dompurify'
import { toCleanPublicUrl } from './urlSafety'

export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
  })
}

export const sanitizeText = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.textContent || ''
}

export const sanitizeTextSecure = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;')
}

export const sanitizeURL = (url: string): string | null => {
  const cleanUrl = toCleanPublicUrl(url)
  return cleanUrl || null
}

export const escapeSpecialChars = (str: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '\\': '&#x5C;',
    '`': '&#x60;',
  }
  return str.replace(/[&<>"'/\\`]/g, (char) => map[char])
}

export const isSafeInput = (input: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe\b[^>]*>/i,
    /<object\b[^>]*>/i,
    /<embed\b[^>]*>/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /<img[^>]*src[^>]*=/i,
    /<link[^>]*href[^>]*=/i,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /data:\s*text\/html/i,
    /vbscript:/i,
    /<meta\b[^>]*>/i,
    /<base\b[^>]*>/i,
  ]

  return !xssPatterns.some((pattern) => pattern.test(input))
}

export const isSafeSQLInput = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(;|--|\||\*)/g,
    /(\bOR\b.*=.*|\bAND\b.*=.*)/gi,
    /['"]/g,
    /(\b(SCRIPT|EXEC|EXECUTE|SP_|XP_)\b)/gi,
  ]

  return !sqlPatterns.some((pattern) => pattern.test(input))
}

export const generateCSPNonce = (): string => {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
}

export const validateInput = (
  input: string,
  maxLength: number = 1000,
): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []

  if (input.length > maxLength) {
    errors.push(`Input too long (max ${maxLength} characters)`)
  }

  if (!isSafeInput(input)) {
    errors.push('Input contains potentially dangerous content')
  }

  if (!isSafeSQLInput(input)) {
    errors.push('Input contains SQL injection patterns')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
