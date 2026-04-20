import { privilegedMaintenanceRpc } from '@/config/privilegedDb'
import { config } from '@/config/environment'
import { logger } from '@/utils/logger'

type MaintenanceTask = {
  name: string
  rpc: 'cleanup_expired_sessions' | 'cleanup_old_audit_logs' | 'cleanup_old_backups'
}

const tasks: MaintenanceTask[] = [
  { name: 'expired-sessions', rpc: 'cleanup_expired_sessions' },
  { name: 'old-audit-logs', rpc: 'cleanup_old_audit_logs' },
  { name: 'old-backups', rpc: 'cleanup_old_backups' },
]

const execute = process.argv.includes('--execute')

const run = async () => {
  logger.info('SafeBox maintenance runner initialized', {
    mode: execute ? 'execute' : 'dry-run',
    taskCount: tasks.length,
    note: execute
      ? 'Running maintenance RPCs in isolated job process.'
      : 'Dry-run only. Pass --execute to run maintenance tasks.',
  })

  if (!execute) {
    tasks.forEach((task) => {
      logger.info('Planned maintenance task', task)
    })
    return
  }

  if (!config.features.maintenanceJobs) {
    logger.warn('Maintenance execution blocked', {
      reason: 'ENABLE_MAINTENANCE_JOBS is disabled',
    })
    process.exit(1)
  }

  for (const task of tasks) {
    logger.info('Running maintenance task', { name: task.name })
    await privilegedMaintenanceRpc(task.rpc)
  }

  logger.info('Maintenance tasks completed successfully')
}

void run().catch((error) => {
  logger.error('Maintenance runner failed', {
    message: error instanceof Error ? error.message : 'Unknown maintenance error',
  })
  process.exit(1)
})
