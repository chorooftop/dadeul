import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers.js'

// 2-B 회귀 방지: 프록시(Cloud Run GFE) 뒤에서 request.ip가 소켓 주소로 굳으면
// 모든 미인증 사용자가 레이트리밋 키 하나를 공유해 신규 온보딩이 전역으로 막힌다.
// 로컬·CI에서는 프록시가 없어 절대 재현되지 않으므로 X-Forwarded-For를 흉내 내 검증한다
describe('trustProxy와 레이트리밋 키', () => {
  const bootstrap = (app: Awaited<ReturnType<typeof createTestApp>>['app'], clientIp: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/accounts/bootstrap',
      headers: { 'x-forwarded-for': clientIp },
      payload: { deviceKey: randomUUID(), platform: 'ios' },
    })

  it('TRUST_PROXY 설정 시 X-Forwarded-For의 클라이언트별로 상한이 독립 계산된다', async () => {
    const ctx = await createTestApp(undefined, {
      TRUST_PROXY: '1',
      RATE_LIMIT_BOOTSTRAP_PER_MIN: '2',
    })
    try {
      expect((await bootstrap(ctx.app, '1.1.1.1')).statusCode).toBe(200)
      expect((await bootstrap(ctx.app, '1.1.1.1')).statusCode).toBe(200)
      expect((await bootstrap(ctx.app, '1.1.1.1')).statusCode).toBe(429)

      // 다른 회선은 앞선 소진과 무관하게 자기 몫을 쓸 수 있어야 한다
      expect((await bootstrap(ctx.app, '2.2.2.2')).statusCode).toBe(200)
      expect((await bootstrap(ctx.app, '2.2.2.2')).statusCode).toBe(200)
      expect((await bootstrap(ctx.app, '2.2.2.2')).statusCode).toBe(429)
    } finally {
      await ctx.close()
    }
  })

  it('TRUST_PROXY 미설정 시에는 헤더를 신뢰하지 않는다 (상한 우회 방지)', async () => {
    const ctx = await createTestApp(undefined, { RATE_LIMIT_BOOTSTRAP_PER_MIN: '2' })
    try {
      expect((await bootstrap(ctx.app, '1.1.1.1')).statusCode).toBe(200)
      expect((await bootstrap(ctx.app, '2.2.2.2')).statusCode).toBe(200)
      // 헤더를 바꿔 가며 호출해도 같은 소켓 주소라 카운터를 공유한다
      expect((await bootstrap(ctx.app, '3.3.3.3')).statusCode).toBe(429)
    } finally {
      await ctx.close()
    }
  })
})
