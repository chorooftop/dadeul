import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createTestApp, type TestContext } from './helpers.js'

let ctx: TestContext
beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(async () => {
  await ctx.close()
})

describe('GET /health', () => {
  it('정책 상수 기본값이 확정 정책과 일치한다', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: 'ok',
      policies: {
        tallyWindowHours: 2,
        minSampleThreshold: 5,
        dailyCreditCap: 3,
      },
    })
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
