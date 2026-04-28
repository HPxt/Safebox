import { cleanPublicUrls, isCleanPublicUrl, toCleanPublicUrl } from './urlSafety'

describe('URL safety helpers', () => {
  it('normalizes clean HTTPS site URLs', () => {
    expect(toCleanPublicUrl('Example.com/login')).toBe('https://example.com/login')
    expect(toCleanPublicUrl('https://Example.com/account')).toBe('https://example.com/account')
  })

  it('rejects tracking and executable URL shapes', () => {
    expect(isCleanPublicUrl('https://attacker.example/pixel.png')).toBe(false)
    expect(isCleanPublicUrl('https://attacker.example/pixel.gif?user=123')).toBe(false)
    expect(isCleanPublicUrl('javascript:alert(1)')).toBe(false)
    expect(isCleanPublicUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isCleanPublicUrl('https://example.com/login?redirect=https://attacker.example')).toBe(false)
    expect(isCleanPublicUrl('https://example.com/#token')).toBe(false)
  })

  it('rejects URLs that could target local or private networks', () => {
    expect(isCleanPublicUrl('https://localhost/login')).toBe(false)
    expect(isCleanPublicUrl('https://127.0.0.1/login')).toBe(false)
    expect(isCleanPublicUrl('https://192.168.1.10/login')).toBe(false)
    expect(isCleanPublicUrl('https://172.16.0.10/login')).toBe(false)
    expect(isCleanPublicUrl('https://10.0.0.5/login')).toBe(false)
  })

  it('drops unsafe imported URL values', () => {
    expect(cleanPublicUrls([
      'github.com/login',
      'https://tracker.example/beacon.webp',
      'https://example.com/profile#secret',
    ])).toEqual(['https://github.com/login'])
  })
})
