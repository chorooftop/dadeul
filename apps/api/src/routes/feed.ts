import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getFeed } from '../services/feed.js'

const feedQuery = z.object({ regionCode: z.string().min(1).optional() })

export async function feedRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/feed', { preHandler: app.authenticate }, async (request, reply) => {
    const query = feedQuery.parse(request.query)
    const result = await getFeed(app.deps.db, {
      accountId: request.account.id,
      cachedRegionCode: request.account.regionCode,
      ...(query.regionCode && { regionCode: query.regionCode }),
      now: new Date(),
      windowHours: app.config.TALLY_WINDOW_HOURS,
      minSampleThreshold: app.config.MIN_SAMPLE_THRESHOLD,
      dailyCreditCap: app.config.DAILY_CREDIT_CAP,
    })
    return reply.status(200).send(result)
  })
}
