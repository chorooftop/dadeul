import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { castVote } from '../services/votes.js'

const voteParams = z.object({ topicId: z.string().min(1) })
const voteBody = z.object({
  optionValue: z.string().min(1),
  regionCode: z.string().min(1).optional(),
})

export async function voteRoutes(app: FastifyInstance): Promise<void> {
  app.put(
    '/v1/topics/:topicId/votes',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = voteParams.parse(request.params)
      const body = voteBody.parse(request.body)
      const result = await castVote(app.deps.db, {
        accountId: request.account.id,
        topicId: params.topicId,
        optionValue: body.optionValue,
        ...(body.regionCode && { regionCode: body.regionCode }),
        now: new Date(),
        windowHours: app.config.TALLY_WINDOW_HOURS,
        minSampleThreshold: app.config.MIN_SAMPLE_THRESHOLD,
        dailyCreditCap: app.config.DAILY_CREDIT_CAP,
      })
      return reply.status(200).send(result)
    },
  )
}
