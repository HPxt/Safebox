import crypto from 'crypto'
import { config } from '@/config/environment'
import { ValidationError } from '@/security/errors'

const TWO_FACTOR_PREFIX = 'ENCv1'
const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6

const getEncryptionKey = (): Buffer => {
  const secret = config.security.twoFactorEncryptionSecret || config.jwt.secret
  return crypto.createHash('sha256').update(secret).digest()
}

const decodeBase32 = (value: string): Buffer => {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '')
  let bits = ''

  for (const char of normalized) {
    const index = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char)
    if (index === -1) {
      throw new ValidationError('Invalid TOTP secret format')
    }
    bits += index.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  }

  return Buffer.from(bytes)
}

const generateTotpForCounter = (secret: string, counter: number): string => {
  const key = decodeBase32(secret)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha256', key).update(buffer).digest()
  const lastByte = hmac[hmac.length - 1]
  if (lastByte === undefined) {
    throw new ValidationError('Unable to generate TOTP token')
  }

  const offset = lastByte & 0x0f
  const b0 = hmac[offset]
  const b1 = hmac[offset + 1]
  const b2 = hmac[offset + 2]
  const b3 = hmac[offset + 3]

  if ([b0, b1, b2, b3].some((value) => value === undefined)) {
    throw new ValidationError('Unable to generate TOTP token')
  }

  const byte0 = b0 as number
  const byte1 = b1 as number
  const byte2 = b2 as number
  const byte3 = b3 as number

  const binaryCode = (
    ((byte0 & 0x7f) << 24) |
    ((byte1 & 0xff) << 16) |
    ((byte2 & 0xff) << 8) |
    (byte3 & 0xff)
  ) % (10 ** TOTP_DIGITS)

  return binaryCode.toString().padStart(TOTP_DIGITS, '0')
}

export const verifyTwoFactorToken = (secret: string, token: string, window = 1): boolean => {
  if (!/^\d{6}$/.test(token)) {
    return false
  }

  const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS)
  for (let offset = -window; offset <= window; offset += 1) {
    if (generateTotpForCounter(secret, currentCounter + offset) === token) {
      return true
    }
  }

  return false
}

export const encryptTwoFactorSecret = (secret: string): string => {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    TWO_FACTOR_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export const decryptTwoFactorSecret = (value: string): string => {
  if (value.startsWith('PLAIN:')) {
    return value.slice(6)
  }

  if (!value.startsWith(`${TWO_FACTOR_PREFIX}:`)) {
    throw new ValidationError('Unsupported 2FA secret format')
  }

  const [, iv, tag, encrypted] = value.split(':')
  if (!iv || !tag || !encrypted) {
    throw new ValidationError('Invalid encrypted 2FA secret')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
