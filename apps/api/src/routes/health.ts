import { sql } from 'drizzle-orm'
import { type FastifyInstance } from 'fastify'
import { z } from 'zod'

const healthQuery = z.object({
  // ?deep=1 일 때만 DB까지 확인한다
  deep: z.enum(['0', '1']).optional(),
})

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request, reply) => {
    const policies = {
      tallyWindowHours: app.config.TALLY_WINDOW_HOURS,
      minSampleThreshold: app.config.MIN_SAMPLE_THRESHOLD,
      dailyCreditCap: app.config.DAILY_CREDIT_CAP,
    }

    // 기본 /health는 DB를 건드리지 않는다 — 기동 프로브가 DB 일시 장애로
    // 멀쩡한 인스턴스를 죽이면 안 된다
    const { deep } = healthQuery.parse(request.query)
    if (deep !== '1') {
      return { status: 'ok', policies }
    }

    // deep 체크의 용도는 둘이다: ① 배포 직후 DB 도달 확인,
    // ② Supabase Free의 7일 무활동 일시정지 방지 (Cloud Scheduler가 하루 1회 호출)
    try {
      await app.deps.db.execute(sql`select 1`)
    } catch (error) {
      request.log.error({ err: error }, 'deep health check 실패 — DB 도달 불가')
      return reply.status(503).send({ status: 'degraded', db: 'unreachable', policies })
    }
    return { status: 'ok', db: 'ok', policies }
  })
}
