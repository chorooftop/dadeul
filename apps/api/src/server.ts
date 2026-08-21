import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb } from './db/client.js'
import { KakaoRegionResolver, UnconfiguredRegionResolver } from './services/regions.js'

// Cloud Run은 인스턴스를 내릴 때 SIGTERM을 보내고 10초 뒤 SIGKILL 한다.
// 그 안에 끝내지 못하면 강제 종료되므로, 여유를 두고 8초에 자체 포기한다
const SHUTDOWN_TIMEOUT_MS = 8_000

// keep-alive 커넥션은 서버가 닫혀도 클라이언트가 먼저 끊기 전까지 살아 있다. Cloud Run의
// Google Front End가 정확히 그렇게 붙어 있어서, 진행 중 요청을 다 처리하고도 close()가
// 반환되지 않는다(실측: 8초 타임아웃까지 대기). 드레인 유예를 준 뒤 남은 소켓은 끊는다
const DRAIN_GRACE_MS = 5_000

async function main(): Promise<void> {
  const config = loadConfig()
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL이 필요합니다 (예: postgresql://localhost/dadeul)')
  }

  // 부팅 경로에서 DB를 건드리지 않는다 — 스케일투제로 환경에서는 콜드스타트마다 반복 비용이 된다.
  // 날씨 주제·지역 마스터 시드는 마이그레이션(drizzle/)이 배포 시 1회 적용한다
  const { db, close: closeDb } = createDb(config.DATABASE_URL, config.DB_POOL_MAX)

  const regionResolver = config.KAKAO_REST_API_KEY
    ? new KakaoRegionResolver(config.KAKAO_REST_API_KEY)
    : new UnconfiguredRegionResolver()

  const app = buildApp(config, { db, regionResolver })
  if (!config.KAKAO_REST_API_KEY) {
    app.log.warn('KAKAO_REST_API_KEY 미설정 — /v1/regions/resolve가 503을 반환합니다')
  }

  let shuttingDown = false
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    app.log.info({ signal }, '종료 신호 수신 — 진행 중 요청을 마무리합니다')

    // 커넥션 반납까지 못 끝내도 SIGKILL보다는 먼저 빠져나온다
    const hardTimer = setTimeout(() => {
      app.log.error({ signal }, `${SHUTDOWN_TIMEOUT_MS}ms 내 종료 실패 — 강제 종료`)
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    hardTimer.unref()

    // 응답을 마쳐 유휴가 된 소켓은 바로 끊는다 — 이래야 처리할 게 없으면 즉시 종료된다.
    // (Fastify는 close() 시점에 한 번만 유휴 커넥션을 정리하므로 그 뒤 유휴가 된 건 남는다)
    const drainInterval = setInterval(() => {
      app.server.closeIdleConnections()
    }, 100)
    drainInterval.unref()

    // 유예를 넘겨도 안 끝나는 요청은 포기한다 — SIGKILL에 잘리는 것보다 낫다
    const drainTimer = setTimeout(() => {
      app.log.warn(`${DRAIN_GRACE_MS}ms 드레인 초과 — 남은 커넥션을 끊습니다`)
      app.server.closeAllConnections()
    }, DRAIN_GRACE_MS)
    drainTimer.unref()

    try {
      await app.close()
      clearInterval(drainInterval)
      clearTimeout(drainTimer)
      await closeDb()
      app.log.info('정상 종료')
    } catch (error) {
      app.log.error({ err: error }, '종료 처리 실패')
      process.exitCode = 1
    }
  }

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown(signal)
    })
  }

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
  } catch (error) {
    app.log.error(error)
    await closeDb()
    process.exit(1)
  }
}

void main()
