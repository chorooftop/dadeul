import { type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

// node-postgres(프로덕션)·PGlite(테스트)·트랜잭션 객체가 모두 만족하는 공통 베이스 타입.
// 서비스 레이어는 이 타입만 의존한다.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

// max를 pg 기본값(10)에 맡기지 않는다 — Cloud Run은 인스턴스가 오토스케일하므로
// 최대 커넥션 = max × 인스턴스 상한이고, 이 값이 계산 가능해야 pooler 한도를 넘기지 않는다
export function createDb(
  databaseUrl: string,
  poolMax: number,
): { db: Db; close: () => Promise<void> } {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: poolMax })
  const db = drizzle(pool, { schema })
  return {
    db,
    close: async () => {
      await pool.end()
    },
  }
}
