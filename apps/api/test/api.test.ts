import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { topics, votes } from '../src/db/schema.js'
import { WEATHER_TOPIC_ID } from '../src/domain/weather-options.js'
import {
  bootstrapAndAuth,
  createTestApp,
  FakeRegionResolver,
  GANGNAM,
  type TestContext,
} from './helpers.js'

let ctx: TestContext
beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(async () => {
  await ctx.close()
})

describe('계정 부트스트랩 (entity-device-account)', () => {
  it('같은 deviceKey는 같은 계정을 복원한다', async () => {
    const deviceKey = randomUUID()
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/v1/accounts/bootstrap',
      payload: { deviceKey, platform: 'ios' },
    })
    const second = await ctx.app.inject({
      method: 'POST',
      url: '/v1/accounts/bootstrap',
      payload: { deviceKey, platform: 'ios' },
    })

    expect(first.json().created).toBe(true)
    expect(second.json().created).toBe(false)
    expect(second.json().accountId).toBe(first.json().accountId)
  })

  it('재부트스트랩은 토큰을 회전한다 — 이전 토큰은 무효화', async () => {
    const deviceKey = randomUUID()
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/v1/accounts/bootstrap',
      payload: { deviceKey, platform: 'ios' },
    })
    const oldToken = first.json().accessToken as string

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/v1/accounts/bootstrap',
      payload: { deviceKey, platform: 'ios' },
    })
    const newToken = second.json().accessToken as string
    expect(newToken).not.toBe(oldToken)

    const withOld = await ctx.app.inject({
      method: 'GET',
      url: '/v1/feed',
      headers: { authorization: `Bearer ${oldToken}` },
    })
    expect(withOld.statusCode).toBe(401)
  })

  it('토큰 없이 보호 라우트 접근 시 UNAUTHORIZED', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/v1/feed' })
    expect(response.statusCode).toBe(401)
    expect(response.json().token).toBe('UNAUTHORIZED')
  })
})

describe('지역 판별 (action-region-resolve)', () => {
  it('판별 성공 시 지역이 생성·캐시된다', async () => {
    const { headers } = await bootstrapAndAuth(ctx.app, randomUUID())
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/regions/resolve',
      headers,
      payload: { latitude: 37.4979, longitude: 127.0276 },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ code: '11680', name: '강남구', active: true })

    const list = await ctx.app.inject({ method: 'GET', url: '/v1/regions' })
    expect(list.json().regions).toContainEqual(
      expect.objectContaining({ code: '11680' }),
    )
  })

  it('판별 불가 좌표는 REGION_UNRESOLVED', async () => {
    const unresolvable = await createTestApp(new FakeRegionResolver(null))
    try {
      const { headers } = await bootstrapAndAuth(unresolvable.app, randomUUID())
      const response = await unresolvable.app.inject({
        method: 'POST',
        url: '/v1/regions/resolve',
        headers,
        payload: { latitude: 35.0, longitude: 135.0 },
      })
      expect(response.statusCode).toBe(422)
      expect(response.json().token).toBe('REGION_UNRESOLVED')
    } finally {
      await unresolvable.close()
    }
  })
})

async function resolvedAccount(): Promise<{
  accountId: string
  headers: { authorization: string }
}> {
  const auth = await bootstrapAndAuth(ctx.app, randomUUID())
  await ctx.app.inject({
    method: 'POST',
    url: '/v1/regions/resolve',
    headers: auth.headers,
    payload: { latitude: 37.4979, longitude: 127.0276 },
  })
  return auth
}

async function castWeatherVote(
  headers: { authorization: string },
  optionValue: string,
): Promise<ReturnType<TestContext['app']['inject']>> {
  return ctx.app.inject({
    method: 'PUT',
    url: `/v1/topics/${WEATHER_TOPIC_ID}/votes`,
    headers,
    payload: { optionValue },
  })
}

describe('날씨 투표 (action-vote-cast + rule-revote-replace + rule-credit-grant)', () => {
  it('최초 투표는 +1 크레딧, 윈도우 내 재투표는 표만 교체하고 미지급', async () => {
    const { headers } = await resolvedAccount()

    const first = await castWeatherVote(headers, 'rain')
    expect(first.statusCode).toBe(200)
    expect(first.json().wallet.balance).toBe(1)
    expect(first.json().tally.counts.rain).toBe(1)

    const revote = await castWeatherVote(headers, 'sunny')
    expect(revote.json().wallet.balance).toBe(1) // 미지급
    expect(revote.json().tally.counts.rain).toBe(0) // 표 교체 — 유효 표는 항상 1개
    expect(revote.json().tally.counts.sunny).toBe(1)
  })

  it('없는 선택지는 INVALID_OPTION', async () => {
    const { headers } = await resolvedAccount()
    const response = await castWeatherVote(headers, 'hail')
    expect(response.statusCode).toBe(422)
    expect(response.json().token).toBe('INVALID_OPTION')
  })

  it('윈도우 밖 재투표(신선한 신호)는 다시 지급하되 일일 상한 3에서 멈춘다', async () => {
    const { accountId, headers } = await resolvedAccount()

    const backdate = async () => {
      await ctx.db
        .update(votes)
        .set({ castAt: sql`${votes.castAt} - interval '3 hours'` })
        .where(and(eq(votes.accountId, accountId), eq(votes.topicId, WEATHER_TOPIC_ID)))
    }

    await castWeatherVote(headers, 'rain') // 지급 1
    await backdate()
    await castWeatherVote(headers, 'rain') // 지급 2
    await backdate()
    const third = await castWeatherVote(headers, 'sunny') // 지급 3 (상한 도달)
    expect(third.json().wallet).toMatchObject({ balance: 3, dailyEarned: 3, dailyCap: 3 })

    await backdate()
    const fourth = await castWeatherVote(headers, 'rain') // 상한 — 투표는 허용, 미지급
    expect(fourth.statusCode).toBe(200)
    expect(fourth.json().wallet.balance).toBe(3)
    expect(fourth.json().vote.optionValue).toBe('rain')
  })
})

describe('집계 (rule-sliding-window-tally + rule-min-sample-display)', () => {
  it('5표 미만은 sampleSufficient=false, 5표부터 1위가 공개된다', async () => {
    const accounts = await Promise.all(
      Array.from({ length: 5 }, () => resolvedAccount()),
    )

    const firstFour = accounts.slice(0, 4)
    for (const { headers } of firstFour) {
      await castWeatherVote(headers, 'rain')
    }
    const last = accounts[4]!
    const fifth = await castWeatherVote(last.headers, 'cloudy')

    const tally = fifth.json().tally
    expect(tally.totalVotes).toBeGreaterThanOrEqual(5)
    expect(tally.sampleSufficient).toBe(true)
    expect(tally.leadingOption).toBe('rain')
    expect(tally.leadingRatio).toBeGreaterThan(0.5)
  })
})

describe('큐레이션 주제 크레딧 차감', () => {
  const CURATED_ID = 'curated-lunch'

  beforeAll(async () => {
    await ctx.db.insert(topics).values({
      id: CURATED_ID,
      title: '점심 뭐 먹지?',
      kind: 'curated',
      status: 'active',
      options: [
        { value: 'kfood', label: '한식' },
        { value: 'noodle', label: '면' },
      ],
      regional: false,
      creditCost: 1,
    })
  })

  it('크레딧 1을 차감하고, 재투표는 추가 차감 없다', async () => {
    const { headers } = await resolvedAccount()
    await castWeatherVote(headers, 'rain') // 크레딧 1 확보

    const vote = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/topics/${CURATED_ID}/votes`,
      headers,
      payload: { optionValue: 'kfood' },
    })
    expect(vote.statusCode).toBe(200)
    expect(vote.json().wallet.balance).toBe(0)

    const revote = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/topics/${CURATED_ID}/votes`,
      headers,
      payload: { optionValue: 'noodle' },
    })
    expect(revote.json().wallet.balance).toBe(0) // 추가 차감 없음
    expect(revote.json().tally.counts.noodle).toBe(1)
  })

  it('잔액 부족이면 INSUFFICIENT_CREDIT이고 표가 생기지 않는다', async () => {
    const { headers } = await resolvedAccount() // 크레딧 0
    const response = await ctx.app.inject({
      method: 'PUT',
      url: `/v1/topics/${CURATED_ID}/votes`,
      headers,
      payload: { optionValue: 'kfood' },
    })
    expect(response.statusCode).toBe(422)
    expect(response.json().token).toBe('INSUFFICIENT_CREDIT')
  })

  it('큐레이션 집계는 슬라이딩 윈도우를 타지 않는다 — 2시간 지난 표도 유지', async () => {
    const { accountId, headers } = await resolvedAccount()
    await castWeatherVote(headers, 'rain') // 크레딧 확보
    await ctx.app.inject({
      method: 'PUT',
      url: `/v1/topics/${CURATED_ID}/votes`,
      headers,
      payload: { optionValue: 'kfood' },
    })
    // 표를 윈도우 밖(3시간 전)으로 밀어도 큐레이션 집계엔 남아야 한다
    await ctx.db
      .update(votes)
      .set({ castAt: sql`${votes.castAt} - interval '3 hours'` })
      .where(and(eq(votes.accountId, accountId), eq(votes.topicId, CURATED_ID)))

    const feed = await ctx.app.inject({ method: 'GET', url: '/v1/feed', headers })
    const curated = feed
      .json()
      .topics.find((entry: { topic: { id: string } }) => entry.topic.id === CURATED_ID)
    expect(curated.tally.counts.kfood).toBeGreaterThanOrEqual(1)
    // 최소표본 규칙도 큐레이션엔 미적용 — 5표 미만이어도 1위 공개
    expect(curated.tally.sampleSufficient).toBe(true)
    expect(curated.tally.leadingOption).toBeDefined()
  })

  it('마감된 주제는 TOPIC_CLOSED', async () => {
    await ctx.db.insert(topics).values({
      id: 'curated-closed',
      title: '끝난 주제',
      kind: 'curated',
      status: 'closed',
      options: [{ value: 'a', label: 'A' }],
      regional: false,
      creditCost: 0,
    })
    const { headers } = await resolvedAccount()
    const response = await ctx.app.inject({
      method: 'PUT',
      url: '/v1/topics/curated-closed/votes',
      headers,
      payload: { optionValue: 'a' },
    })
    expect(response.statusCode).toBe(409)
    expect(response.json().token).toBe('TOPIC_CLOSED')
  })
})

describe('피드 (action-tally-feed)', () => {
  it('위젯 렌더에 필요한 전부를 한 번에 반환한다', async () => {
    const { headers } = await resolvedAccount()
    await castWeatherVote(headers, 'rain')

    const response = await ctx.app.inject({ method: 'GET', url: '/v1/feed', headers })
    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.region).toMatchObject({ code: GANGNAM.code, name: GANGNAM.name })
    expect(body.weather.myVote.optionValue).toBe('rain')
    expect(body.weather.visibleOptions).toContain('sunny')
    expect(body.weather.tally.computedAt).toBeDefined()
    expect(body.wallet.dailyCap).toBe(3)
    expect(Array.isArray(body.topics)).toBe(true)
  })

  it('지역 미판별 계정은 REGION_UNRESOLVED', async () => {
    const { headers } = await bootstrapAndAuth(ctx.app, randomUUID())
    const response = await ctx.app.inject({ method: 'GET', url: '/v1/feed', headers })
    expect(response.statusCode).toBe(422)
    expect(response.json().token).toBe('REGION_UNRESOLVED')
  })
})
