import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { type Db } from '../src/db/client.js'
import { createTestApp, FakeRegionResolver, type TestContext } from './helpers.js'

let ctx: TestContext
beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(async () => {
  await ctx.close()
})

const POLICIES = {
  tallyWindowHours: 2,
  minSampleThreshold: 5,
  dailyCreditCap: 3,
}

describe('GET /health', () => {
  it('정책 상수 기본값이 확정 정책과 일치한다', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', policies: POLICIES })
  })

  // 기동 프로브는 DB 일시 장애로 멀쩡한 인스턴스를 죽이면 안 되므로 기본 경로는 DB를 안 탄다
  it('기본 경로는 DB를 건드리지 않는다', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health?deep=0' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).not.toHaveProperty('db')
  })

  // deep 체크는 ① 배포 직후 DB 도달 확인 ② Supabase Free 7일 무활동 일시정지 방지에 쓴다
  it('deep=1은 DB 도달까지 확인한다', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health?deep=1' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok', db: 'ok', policies: POLICIES })
  })

  it('deep=1은 DB 도달 실패 시 503 degraded를 반환한다', async () => {
    const unreachableDb = {
      execute: () => Promise.reject(new Error('connection terminated')),
    } as unknown as Db
    const app = buildApp(loadConfig({ NODE_ENV: 'test' }), {
      db: unreachableDb,
      regionResolver: new FakeRegionResolver(null),
    })
    try {
      const response = await app.inject({ method: 'GET', url: '/health?deep=1' })

      expect(response.statusCode).toBe(503)
      expect(response.json()).toMatchObject({ status: 'degraded', db: 'unreachable' })
    } finally {
      await app.close()
    }
  })
})

describe('loadConfig', () => {
  it('잘못된 환경변수는 검증 실패로 거부한다', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', PORT: 'abc' })).toThrow(
      /환경변수 검증 실패/,
    )
  })

  it('정책 상수를 환경변수로 조정할 수 있다', () => {
    const config = loadConfig({ NODE_ENV: 'test', TALLY_WINDOW_HOURS: '3' })
    expect(config.TALLY_WINDOW_HOURS).toBe(3)
  })
})
