import { type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

// node-postgres(프로덕션)·PGlite(테스트)·트랜잭션 객체가 모두 만족하는 공통 베이스 타입.
// 서비스 레이어는 이 타입만 의존한다.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

export function createDb(databaseUrl: string): { db: Db; close: () => Promise<void> } {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool, { schema })
  return {
    db,
    close: async () => {
      await pool.end()
    },
  }
}
