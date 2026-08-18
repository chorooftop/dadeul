import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb } from './db/client.js'
import { ensureWeatherTopic } from './db/seed.js'
import { KakaoRegionResolver, UnconfiguredRegionResolver } from './services/regions.js'

async function main(): Promise<void> {
  const config = loadConfig()
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL이 필요합니다 (예: postgresql://localhost/dadeul)')
  }

  const { db } = createDb(config.DATABASE_URL)
  await ensureWeatherTopic(db)

  const regionResolver = config.KAKAO_REST_API_KEY
    ? new KakaoRegionResolver(config.KAKAO_REST_API_KEY)
    : new UnconfiguredRegionResolver()

  const app = buildApp(config, { db, regionResolver })
  if (!config.KAKAO_REST_API_KEY) {
    app.log.warn('KAKAO_REST_API_KEY 미설정 — /v1/regions/resolve가 503을 반환합니다')
  }

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void main()
