import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { bootstrapAccount } from '../services/accounts.js'

const bootstrapBody = z.object({
  deviceKey: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
})

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/accounts/bootstrap', async (request, reply) => {
    const body = bootstrapBody.parse(request.body)
    const result = await bootstrapAccount(app.deps.db, body.deviceKey, body.platform)
    return reply.status(200).send(result)
  })
}
