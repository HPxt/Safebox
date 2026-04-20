import { config } from '@/config/environment'
import { logger } from '@/utils/logger'

const startAiWorker = async () => {
  logger.info('SafeBox AI worker initialized in isolated process', {
    env: config.env,
    mode: 'ai-worker',
    note: 'This process is intentionally separated from the main API runtime.',
  })

  logger.info('Available entrypoints', {
    commands: [
      'npm run dev:ai',
      'npm run test:audit',
    ],
  })
}

void startAiWorker().catch((error) => {
  logger.error('AI worker failed to start', {
    message: error instanceof Error ? error.message : 'Unknown AI worker startup error',
  })
  process.exit(1)
})
