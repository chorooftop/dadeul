import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { type FastifyInstance } from 'fastify'
import path from 'node:path'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { type Db } from '../src/db/client.js'
import * as schema from '../src/db/schema.js'
import { type RegionResolver, type ResolvedRegion } from '../src/services/regions.js'

export class FakeRegionResolver implements RegionResolver {
  constructor(private readonly result: ResolvedRegion | null) {}

  async resolve(): Promise<ResolvedRegion | null> {
    return this.result
  }
}

export const GANGNAM: ResolvedRegion = {
  code: '11680',
  name: '강남구',
  fullName: '서울특별시 강남구',
}

export interface TestContext {
  app: FastifyInstance
  db: Db
  close: () => Promise<void>
}

export async function createTestApp(
  resolver: RegionResolver = new FakeRegionResolver(GANGNAM),
  envOverrides: Record<string, string> = {},
): Promise<TestContext> {
  const client = new PGlite()
  const db = drizzle(client, { schema }) as unknown as Db
  // 날씨 주제·전국 시군구 시드도 마이그레이션에 들어 있다 — 프로덕션과 같은 경로로 재현한다
  await migrate(db as never, {
    migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
  })

  // 기능 테스트는 한 IP(inject)에서 수십 번 호출하므로 레이트 리밋을 사실상 해제한다
  // — 리밋 동작 자체는 rate-limit.test.ts가 낮은 상한으로 별도 검증
  const config = loadConfig({
    NODE_ENV: 'test',
    RATE_LIMIT_GLOBAL_PER_MIN: '100000',
    RATE_LIMIT_BOOTSTRAP_PER_MIN: '100000',
    RATE_LIMIT_RESOLVE_PER_MIN: '100000',
    ...envOverrides,
  })
  const app = buildApp(config, { db, regionResolver: resolver })

  return {
    app,
    db,
    close: async () => {
      await app.close()
      await client.close()
    },
  }
}

export async function bootstrapAndAuth(
  app: FastifyInstance,
  deviceKey: string,
): Promise<{ accountId: string; headers: { authorization: string } }> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/accounts/bootstrap',
    payload: { deviceKey, platform: 'ios' },
  })
  const body = response.json() as { accountId: string; accessToken: string }
  return {
    accountId: body.accountId,
    headers: { authorization: `Bearer ${body.accessToken}` },
  }
}
