import { privilegedRpcLogAuditEvent } from '@/config/privilegedDb'
import { redactObject } from '@/security/redaction'
import type { Json } from '@/types/database'
import { logger } from '@/utils/logger'

type AuditPayload = {
  userId: string
  eventType: string
  eventData: Record<string, unknown>
  ipAddress: string | undefined
  userAgent: string | undefined
}

export const logPrivilegedAuditEvent = async ({
  userId,
  eventType,
  eventData,
  ipAddress,
  userAgent,
}: AuditPayload): Promise<void> => {
  const redactedEventData = redactObject(eventData)

  try {
    await privilegedRpcLogAuditEvent({
      p_user_id: userId,
      p_event_type: eventType,
      p_event_data: redactedEventData as Json,
      p_ip_address: ipAddress ?? null,
      p_user_agent: userAgent ?? null,
    })
  } catch {
    logger.warn('Privileged audit logging failed')
  }
}
