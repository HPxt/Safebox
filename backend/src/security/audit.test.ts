const rpcMock = jest.fn()
const warnMock = jest.fn()

jest.mock('@/config/privilegedDb', () => ({
  privilegedRpcLogAuditEvent: (...args: unknown[]) => rpcMock(...args),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => warnMock(...args),
  },
}))

import { logPrivilegedAuditEvent } from '@/security/audit'
import { REDACTION_PLACEHOLDER } from '@/security/redaction'

describe('privileged audit helper', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    warnMock.mockReset()
  })

  it('redacts sensitive fields before sending them to the privileged rpc', async () => {
    rpcMock.mockResolvedValue({ error: null })

    await logPrivilegedAuditEvent({
      userId: 'user-1',
      eventType: 'settings_updated',
      eventData: {
        password: 'super-secret',
        nested: {
          accessToken: 'abc.def.ghi',
        },
        safe: 'ok',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    })

    expect(rpcMock).toHaveBeenCalledWith({
      p_user_id: 'user-1',
      p_event_type: 'settings_updated',
      p_event_data: {
        password: REDACTION_PLACEHOLDER,
        nested: {
          accessToken: REDACTION_PLACEHOLDER,
        },
        safe: 'ok',
      },
      p_ip_address: '127.0.0.1',
      p_user_agent: 'jest',
    })
  })

  it('degrades safely when privileged audit logging fails', async () => {
    rpcMock.mockRejectedValue(new Error('rpc down'))

    await expect(logPrivilegedAuditEvent({
      userId: 'user-1',
      eventType: 'credential_updated',
      eventData: { secret: 'value' },
      ipAddress: undefined,
      userAgent: undefined,
    })).resolves.toBeUndefined()

    expect(warnMock).toHaveBeenCalledWith('Privileged audit logging failed')
  })
})
