import { eq } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { accounts, regions } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { type RegionView } from './accounts.js'

export interface ResolvedRegion {
  code: string
  name: string
  fullName: string
}

// action-region-resolve: 좌표 → 시군구. 좌표는 판별 즉시 폐기, 저장 금지
export interface RegionResolver {
  resolve(latitude: number, longitude: number): Promise<ResolvedRegion | null>
}

// 카카오 로컬 API coord2regioncode — 법정동(B) 코드 상위 5자리 = 시군구 (term-region-code)
export class KakaoRegionResolver implements RegionResolver {
  constructor(private readonly restApiKey: string) {}

  async resolve(latitude: number, longitude: number): Promise<ResolvedRegion | null> {
    const url = new URL('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json')
    url.searchParams.set('x', String(longitude))
    url.searchParams.set('y', String(latitude))

    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${this.restApiKey}` },
    })
    if (!response.ok) {
      throw new AppError('INTERNAL_ERROR', 502, `kakao coord2regioncode ${response.status}`)
    }

    const body = (await response.json()) as {
      documents?: Array<{
        region_type: string
        code: string
        region_1depth_name: string
        region_2depth_name: string
      }>
    }
    const legal = body.documents?.find((doc) => doc.region_type === 'B')
    if (!legal || legal.region_2depth_name === '') {
      return null
    }
    return {
      code: legal.code.slice(0, 5),
      name: legal.region_2depth_name,
      fullName: `${legal.region_1depth_name} ${legal.region_2depth_name}`,
    }
  }
}

// KAKAO_REST_API_KEY 미설정 환경용 — 판별 요청을 명시적으로 거부한다 (조용한 성공 금지)
export class UnconfiguredRegionResolver implements RegionResolver {
  async resolve(): Promise<ResolvedRegion | null> {
    throw new AppError(
      'INTERNAL_ERROR',
      503,
      'region resolver unconfigured — set KAKAO_REST_API_KEY',
    )
  }
}

// 판별 결과를 regions에 lazy upsert하고 계정 캐시 지역을 갱신한다
export async function resolveAndCacheRegion(
  db: Db,
  resolver: RegionResolver,
  accountId: string,
  latitude: number,
  longitude: number,
): Promise<RegionView> {
  const resolved = await resolver.resolve(latitude, longitude)
  if (!resolved) {
    throw new AppError('REGION_UNRESOLVED', 422, 'coordinates outside supported regions')
  }

  await db
    .insert(regions)
    .values({ code: resolved.code, name: resolved.name, fullName: resolved.fullName })
    .onConflictDoNothing({ target: regions.code })

  const [region] = await db.select().from(regions).where(eq(regions.code, resolved.code))
  if (!region) {
    throw new AppError('INTERNAL_ERROR', 500, `region upsert failed: ${resolved.code}`)
  }
  if (!region.active) {
    throw new AppError('REGION_INACTIVE', 422, `region inactive: ${region.code}`)
  }

  await db.update(accounts).set({ regionCode: region.code }).where(eq(accounts.id, accountId))

  return {
    code: region.code,
    name: region.name,
    fullName: region.fullName,
    active: region.active,
  }
}

export async function listRegions(db: Db): Promise<RegionView[]> {
  const rows = await db.select().from(regions).where(eq(regions.active, true))
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    fullName: row.fullName,
    active: row.active,
  }))
}
