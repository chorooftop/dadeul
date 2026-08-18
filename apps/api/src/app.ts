import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import { type Config } from './config.js'
import { type Db } from './db/client.js'
import { AppError } from './domain/errors.js'
import { makeAuthenticate } from './plugins/auth.js'
import { accountRoutes } from './routes/accounts.js'
import { feedRoutes } from './routes/feed.js'
import { healthRoutes } from './routes/health.js'
import { regionRoutes } from './routes/regions.js'
import { voteRoutes } from './routes/votes.js'
import { type RegionResolver } from './services/regions.js'

export interface AppDeps {
  db: Db
  regionResolver: RegionResolver
}

export function buildApp(config: Config, deps: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  })

  app.decorate('config', config)
  app.decorate('deps', deps)
  app.decorate('authenticate', makeAuthenticate(deps.db))

  // 에러 토큰 규약: 유저 노출 문구는 클라이언트가 토큰으로 결정한다 (specs/openapi.yaml Error).
  // 비-AppError의 message는 PG 에러 등 내부 구조를 담을 수 있어 응답에 싣지 않는다 — 로그에만 남긴다
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ token: error.token, message: error.message })
    }
    if (error.name === 'ZodError') {
      return reply.status(400).send({ token: 'BAD_REQUEST', message: error.message })
    }
    app.log.error(error)
    const statusCode = error.statusCode ?? 500
    if (statusCode >= 500) {
      return reply
        .status(statusCode)
        .send({ token: 'INTERNAL_ERROR', message: `internal error (requestId: ${request.id})` })
    }
    const token = statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR'
    return reply.status(statusCode).send({ token, message: error.message })
  })

  app.register(healthRoutes)
  app.register(accountRoutes)
  app.register(regionRoutes)
  app.register(voteRoutes)
  app.register(feedRoutes)

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config
    deps: AppDeps
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
