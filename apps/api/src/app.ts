import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import { type Config } from './config.js'
import { healthRoutes } from './routes/health.js'

export function buildApp(config: Config): FastifyInstance {
  const app = Fastify({
    logger: config.NODE_ENV !== 'test',
  })

  app.decorate('config', config)

  // 에러 토큰 규약: 유저 노출 문구는 클라이언트가 토큰으로 결정한다 (specs/openapi.yaml Error)
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error)
    const statusCode = error.statusCode ?? 500
    const token = statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR'
    return reply.status(statusCode).send({ token, message: error.message })
  })

  app.register(healthRoutes)

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config
  }
}
