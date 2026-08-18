import { eq } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { accounts, regions } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { issueToken } from '../domain/token.js'

export interface RegionView {
  code: string
  name: string
  fullName: string
  active: boolean
}

export interface BootstrapResult {
  accountId: string
  accessToken: string
  created: boolean
  region?: RegionView
}

// entity-device-account: deviceKey는 플랫폼 보존 저장소의 복원 키.
// 같은 키 → 같은 계정 복원, 없으면 생성 (가입 절차 없음).
// 토큰은 bootstrap마다 회전한다 — 해시만 저장하므로 기존 평문을 되돌려줄 수 없고,
// 회전 덕에 유출 토큰은 다음 bootstrap에서 자동 무효화된다
export async function bootstrapAccount(
  db: Db,
  deviceKey: string,
  platform: 'ios' | 'android',
): Promise<BootstrapResult> {
  const { token, hash } = issueToken()

  // 동시 최초 실행 race: insert가 충돌하면 기존 레코드를 갱신 경로로 처리
  const inserted = await db
    .insert(accounts)
    .values({ deviceKey, platform, accessTokenHash: hash })
    .onConflictDoNothing({ target: accounts.deviceKey })
    .returning({ id: accounts.id })

  const insertedRow = inserted[0]
  if (insertedRow) {
    return { accountId: insertedRow.id, accessToken: token, created: true }
  }

  const [restored] = await db
    .update(accounts)
    .set({ accessTokenHash: hash })
    .where(eq(accounts.deviceKey, deviceKey))
    .returning({ id: accounts.id, regionCode: accounts.regionCode })
  if (!restored) {
    throw new AppError('INTERNAL_ERROR', 500, 'bootstrap upsert race resolution failed')
  }

  const result: BootstrapResult = {
    accountId: restored.id,
    accessToken: token,
    created: false,
  }
  if (restored.regionCode) {
    const [region] = await db.select().from(regions).where(eq(regions.code, restored.regionCode))
    if (region) {
      result.region = {
        code: region.code,
        name: region.name,
        fullName: region.fullName,
        active: region.active,
      }
    }
  }
  return result
}
