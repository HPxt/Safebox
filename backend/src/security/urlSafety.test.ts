import { isCleanPublicUrl, toCleanPublicUrl } from '@/security/urlSafety'

describe('URL safety policy', () => {
  it('normalizes clean HTTPS URLs', () => {
    expect(toCleanPublicUrl('github.com/login')).toBe('https://github.com/login')
    expect(toCleanPublicUrl('https://Example.com')).toBe('https://example.com/')
  })

  it('rejects URLs that can behave as beacons or active resources', () => {
    expect(isCleanPublicUrl('https://attacker.example/pixel.png')).toBe(false)
    expect(isCleanPublicUrl('https://attacker.example/pixel.gif?u=abc')).toBe(false)
    expect(isCleanPublicUrl('https://example.com/path?token=abc')).toBe(false)
    expect(isCleanPublicUrl('https://example.com/#token')).toBe(false)
    expect(isCleanPublicUrl('javascript:alert(1)')).toBe(false)
    expect(isCleanPublicUrl('data:image/svg+xml,<svg></svg>')).toBe(false)
  })

  it('rejects local and private network targets', () => {
    expect(isCleanPublicUrl('https://localhost/admin')).toBe(false)
    expect(isCleanPublicUrl('https://127.0.0.1/admin')).toBe(false)
    expect(isCleanPublicUrl('https://10.0.0.1/admin')).toBe(false)
    expect(isCleanPublicUrl('https://172.20.0.1/admin')).toBe(false)
    expect(isCleanPublicUrl('https://192.168.0.10/admin')).toBe(false)
  })
})
