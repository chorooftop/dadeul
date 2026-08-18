import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { bootstrapAccount } from '../services/accounts.js'

const bootstrapBody = z.object({
  deviceKey: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
})

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/accounts/bootstrap',
    {
      // 미인증 엔드포인트 — IP 기준 별도 상한 (무제한 계정 생성 방어)
      config: {
        rateLimit: {
          max: app.config.RATE_LIMIT_BOOTSTRAP_PER_MIN,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.ip,
        },
      },
    },
    async (request, reply) => {
      const body = bootstrapBody.parse(request.body)
      const result = await bootstrapAccount(app.deps.db, body.deviceKey, body.platform)
      return reply.status(200).send(result)
    },
  )
}
