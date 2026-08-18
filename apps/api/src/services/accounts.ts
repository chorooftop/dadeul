import { eq } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { accounts, regions } from '../db/schema.js'
import { AppError } from '../domain/errors.js'

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
// 같은 키 → 같은 계정 복원, 없으면 생성 (가입 절차 없음)
export async function bootstrapAccount(
  db: Db,
  deviceKey: string,
  platform: 'ios' | 'android',
): Promise<BootstrapResult> {
  // 동시 최초 실행 race: insert가 충돌하면 기존 레코드를 다시 읽는다
  const inserted = await db
    .insert(accounts)
    .values({ deviceKey, platform })
    .onConflictDoNothing({ target: accounts.deviceKey })
    .returning({ id: accounts.id, accessToken: accounts.accessToken })

  const insertedRow = inserted[0]
  if (insertedRow) {
    return { accountId: insertedRow.id, accessToken: insertedRow.accessToken, created: true }
  }

  const [existing] = await db
    .select({
      id: accounts.id,
      accessToken: accounts.accessToken,
      regionCode: accounts.regionCode,
    })
    .from(accounts)
    .where(eq(accounts.deviceKey, deviceKey))
  if (!existing) {
    throw new AppError('INTERNAL_ERROR', 500, 'bootstrap upsert race resolution failed')
  }

  const result: BootstrapResult = {
    accountId: existing.id,
    accessToken: existing.accessToken,
    created: false,
  }
  if (existing.regionCode) {
    const [region] = await db.select().from(regions).where(eq(regions.code, existing.regionCode))
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
