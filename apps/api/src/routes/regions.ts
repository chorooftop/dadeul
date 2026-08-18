import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { listRegions, resolveAndCacheRegion } from '../services/regions.js'

const resolveBody = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export async function regionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/regions/resolve',
    {
      preHandler: app.authenticate,
      // 요청마다 유료 카카오 API를 호출 — 비용 증폭 방어용 별도 상한
      config: {
        rateLimit: {
          max: app.config.RATE_LIMIT_RESOLVE_PER_MIN,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const body = resolveBody.parse(request.body)
      const region = await resolveAndCacheRegion(
        app.deps.db,
        app.deps.regionResolver,
        request.account.id,
        body.latitude,
        body.longitude,
      )
      return reply.status(200).send(region)
    },
  )

  app.get('/v1/regions', async (_request, reply) => {
    const regions = await listRegions(app.deps.db)
    return reply.status(200).send({ regions })
  })
}
