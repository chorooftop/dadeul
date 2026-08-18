import { type FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return {
      status: 'ok',
      policies: {
        tallyWindowHours: app.config.TALLY_WINDOW_HOURS,
        minSampleThreshold: app.config.MIN_SAMPLE_THRESHOLD,
        dailyCreditCap: app.config.DAILY_CREDIT_CAP,
      },
    }
  })
}
