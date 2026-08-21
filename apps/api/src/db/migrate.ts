import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { loadConfig } from '../config.js'

// 배포 릴리즈 단계에서 1회 실행한다 (npm run migrate).
// 앱 부팅 시 자동 실행하지 않는 이유: 인스턴스가 여러 개면 같은 마이그레이션을 동시에 적용하려 경합한다.
async function main(): Promise<void> {
  const config = loadConfig()
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL이 필요합니다 (예: postgresql://localhost/dadeul)')
  }

  // 마이그레이션은 단발성이므로 커넥션 1개면 충분하다
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 1 })
  try {
    const db = drizzle(pool)
    // 테스트(PGlite)와 같은 폴더를 적용해 스키마 재현성이 갈리지 않게 한다
    await migrate(db, { migrationsFolder: path.join(import.meta.dirname, '../../drizzle') })
    console.log('마이그레이션 적용 완료')
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('마이그레이션 실패:', error)
  process.exit(1)
})
