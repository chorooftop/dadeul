import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestContext } from './helpers.js'

let ctx: TestContext
beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(async () => {
  await ctx.close()
})

interface RegionRow {
  code: string
  name: string
  fullName: string
  active: boolean
}

// 1-A 회귀 방지: 시드가 빠지면 GET /v1/regions가 빈 배열이 되고,
// 위치 권한을 거부한 사용자는 RegionSetupView에서 막다른 길에 갇힌다.
// 헬퍼가 프로덕션과 같은 마이그레이션을 적용하므로 이 테스트가 곧 시드 적용 검증이다
describe('전국 시군구 시드', () => {
  it('빈 DB에 마이그레이션만 적용해도 전국 시군구가 조회된다', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/v1/regions' })
    expect(response.statusCode).toBe(200)

    const regions = response.json().regions as RegionRow[]
    expect(regions).toHaveLength(256)
    expect(regions.every((region) => region.active)).toBe(true)
    expect(new Set(regions.map((region) => region.code)).size).toBe(regions.length)
    // term-region-code — 법정동코드 상위 5자리
    expect(regions.every((region) => /^\d{5}$/.test(region.code))).toBe(true)
  })

  it('카카오 판별 결과와 같은 형태로 저장돼 lazy upsert와 충돌하지 않는다', async () => {
    const regions = (await ctx.app.inject({ method: 'GET', url: '/v1/regions' })).json()
      .regions as RegionRow[]
    const byCode = new Map(regions.map((region) => [region.code, region]))

    // name = region_2depth_name, fullName = "region_1depth_name region_2depth_name"
    expect(byCode.get('11680')).toMatchObject({ name: '강남구', fullName: '서울특별시 강남구' })
    // 일반구를 둔 시는 카카오도 "시 + 구"를 통째로 2depth로 준다
    expect(byCode.get('41111')).toMatchObject({
      name: '수원시 장안구',
      fullName: '경기도 수원시 장안구',
    })
    // 세종은 2depth가 비어 1depth가 곧 표시명이다
    expect(byCode.get('36110')).toMatchObject({
      name: '세종특별자치시',
      fullName: '세종특별자치시',
    })
  })

  it('2026-07-01 행정구역 개편분이 반영돼 있다', async () => {
    const regions = (await ctx.app.inject({ method: 'GET', url: '/v1/regions' })).json()
      .regions as RegionRow[]
    const byCode = new Map(regions.map((region) => [region.code, region]))

    // 전남광주통합특별시 출범 — 구 광주광역시(29)·전라남도(46) 코드는 더 이상 쓰지 않는다
    expect(byCode.get('12210')?.fullName).toBe('전남광주통합특별시 동구')
    expect(regions.some((region) => region.code.startsWith('29'))).toBe(false)
    expect(regions.some((region) => region.code.startsWith('46'))).toBe(false)
    // 인천 자치구 재편(제물포구·영종구·서해구·검단구 신설)
    expect(byCode.get('28125')?.fullName).toBe('인천광역시 제물포구')
    expect(byCode.get('28290')?.fullName).toBe('인천광역시 검단구')
    // 화성시·부천시 일반구
    expect(byCode.get('41597')?.fullName).toBe('경기도 화성시 동탄구')
    expect(byCode.get('41196')?.fullName).toBe('경기도 부천시 오정구')
  })
})
