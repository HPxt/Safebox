import {
  assertAllowedOutboundUrl,
  isAllowedCorsOrigin,
} from '@/security/outboundHttp'

describe('outbound http guard', () => {
  it('allows localhost targets on the allowlist', () => {
    const url = assertAllowedOutboundUrl('http://localhost:1234/v1/models', ['localhost'])
    expect(url.hostname).toBe('localhost')
  })

  it('blocks non-allowlisted targets', () => {
    expect(() => assertAllowedOutboundUrl('https://evil.example.com', ['localhost']))
      .toThrow('Outbound host is not allowed: evil.example.com')
  })

  it('blocks private network addresses that are not explicit localhost', () => {
    expect(() => assertAllowedOutboundUrl('http://192.168.0.10/internal', ['192.168.0.10']))
      .toThrow('Private outbound address is not allowed: 192.168.0.10')
  })
})

describe('cors origin guard', () => {
  it('matches explicit origins and wildcard previews', () => {
    expect(isAllowedCorsOrigin('https://safebox-123.vercel.app', ['https://safebox-*.vercel.app']))
      .toBe(true)
    expect(isAllowedCorsOrigin('https://attacker.example.com', ['https://safebox-*.vercel.app']))
      .toBe(false)
  })
})
