import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { type FastifyInstance } from 'fastify'
import path from 'node:path'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { type Db } from '../src/db/client.js'
import * as schema from '../src/db/schema.js'
import { ensureWeatherTopic } from '../src/db/seed.js'
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
): Promise<TestContext> {
  const client = new PGlite()
  const db = drizzle(client, { schema }) as unknown as Db
  await migrate(db as never, {
    migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
  })
  await ensureWeatherTopic(db)

  const config = loadConfig({ NODE_ENV: 'test' })
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
