import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { bootstrapAndAuth, createTestApp } from './helpers.js'

// 리밋 카운터는 앱 인스턴스별 인메모리 저장소에 쌓이므로 테스트마다 독립 앱을 만든다
describe('레이트 리미팅', () => {
  it('bootstrap은 IP당 상한 초과 시 RATE_LIMITED', async () => {
    const ctx = await createTestApp(undefined, { RATE_LIMIT_BOOTSTRAP_PER_MIN: '3' })
    try {
      const call = () =>
        ctx.app.inject({
          method: 'POST',
          url: '/v1/accounts/bootstrap',
          payload: { deviceKey: randomUUID(), platform: 'ios' },
        })

      for (let i = 0; i < 3; i += 1) {
        expect((await call()).statusCode).toBe(200) // 상한 3까지 허용
      }
      const fourth = await call()
      expect(fourth.statusCode).toBe(429)
      expect(fourth.json().token).toBe('RATE_LIMITED')
    } finally {
      await ctx.close()
    }
  })

  it('resolve는 계정 토큰당 상한 초과 시 RATE_LIMITED', async () => {
    const ctx = await createTestApp(undefined, { RATE_LIMIT_RESOLVE_PER_MIN: '2' })
    try {
      const { headers } = await bootstrapAndAuth(ctx.app, randomUUID())
      const call = () =>
        ctx.app.inject({
          method: 'POST',
          url: '/v1/regions/resolve',
          headers,
          payload: { latitude: 37.4979, longitude: 127.0276 },
        })

      expect((await call()).statusCode).toBe(200)
      expect((await call()).statusCode).toBe(200)
      const third = await call()
      expect(third.statusCode).toBe(429)
      expect(third.json().token).toBe('RATE_LIMITED')
    } finally {
      await ctx.close()
    }
  })
})
