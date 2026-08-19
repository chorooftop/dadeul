import { and, eq, gte, sql, sum } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { accounts, creditLedger, regions, topics, votes } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { kstDayStart, windowStart } from '../domain/time.js'
import { isTopicOpen } from '../domain/topics.js'
import { resolveWeatherAxis, type VoteAxis } from '../domain/temperature-options.js'
import { isSubmittableWeatherOption } from '../domain/weather-options.js'
import { getTally, type TallyResult } from './tally.js'
import { getWallet, type WalletView } from './wallet.js'

export interface CastVoteInput {
  accountId: string
  topicId: string
  optionValue: string
  regionCode?: string
  now: Date
  windowHours: number
  minSampleThreshold: number
  dailyCreditCap: number
}

export interface CastVoteResult {
  vote: { optionValue: string; castAt: string }
  wallet: WalletView
  tally: TallyResult
  /// 이 표가 반영된 축 — 클라이언트가 갱신할 화면 영역 선택용 (2026-08-20 온도 축)
  axis: VoteAxis
}

// action-vote-cast: 검증 → UPSERT(rule-revote-replace) → 크레딧(rule-credit-grant) → 집계.
// 크레딧 지급 조건: 새 레코드이거나 직전 표가 슬라이딩 윈도우 밖일 때 (신선한 신호 공급 보상).
// 윈도우 내 재투표는 미지급. 일일 상한 도달 시 투표는 허용하고 크레딧만 미지급.
// 응답용 tally·wallet까지 같은 트랜잭션에서 계산 — 방금 투표한 유저가 자기 투표가
// 반영되지 않은 값을 받으면 안 된다
export async function castVote(db: Db, input: CastVoteInput): Promise<CastVoteResult> {
  const { accountId, topicId, optionValue, now } = input

  return db.transaction(async (tx) => {
    const [topic] = await tx.select().from(topics).where(eq(topics.id, topicId))
    if (!topic || topic.status === 'scheduled') {
      throw new AppError('TOPIC_NOT_FOUND', 404, `topic not found: ${topicId}`)
    }
    if (!isTopicOpen(topic, now)) {
      throw new AppError('TOPIC_CLOSED', 409, `topic closed: ${topicId}`)
    }

    // 축 추론은 날씨 주제 스코프에서만 — 큐레이션은 항상 primary (term-temperature-option)
    const axis: VoteAxis = topic.kind === 'weather' ? resolveWeatherAxis(optionValue) : 'primary'
    const validOption =
      topic.kind === 'weather'
        ? axis === 'temperature' || isSubmittableWeatherOption(optionValue, now)
        : topic.options.some((option) => option.value === optionValue)
    if (!validOption) {
      throw new AppError('INVALID_OPTION', 422, `invalid option: ${optionValue}`)
    }

    let regionCode: string | null = null
    if (topic.regional) {
      const candidate = input.regionCode ?? (await cachedRegionCode(tx, accountId))
      if (!candidate) {
        throw new AppError('REGION_UNRESOLVED', 422, 'regional topic requires a resolved region')
      }
      const [region] = await tx.select().from(regions).where(eq(regions.code, candidate))
      if (!region) {
        throw new AppError('REGION_UNRESOLVED', 422, `unknown region: ${candidate}`)
      }
      if (!region.active) {
        throw new AppError('REGION_INACTIVE', 422, `region inactive: ${region.code}`)
      }
      regionCode = region.code
    }

    // 잔액·크레딧 판정의 race 방지 — 계정 행 잠금. 같은 계정의 동시 요청이 여기서 직렬화되어
    // SELECT-then-INSERT의 PK 충돌 race도 함께 차단된다
    // execute의 반환 타입은 드라이버 HKT에 따라 달라 공통 베이스에선 unknown — rows만 사용
    const locked = (await tx.execute(
      sql`select 1 from ${accounts} where ${accounts.id} = ${accountId} for update`,
    )) as { rows: unknown[] }
    if (locked.rows.length === 0) {
      throw new AppError('UNAUTHORIZED', 401, `account not found: ${accountId}`)
    }

    // 교체 단위는 (계정, 주제, 축) — rule-revote-replace
    const voteKey = and(
      eq(votes.accountId, accountId),
      eq(votes.topicId, topicId),
      eq(votes.axis, axis),
    )
    const [existing] = await tx.select({ castAt: votes.castAt }).from(votes).where(voteKey)

    if (existing) {
      await tx.update(votes).set({ optionValue, regionCode, castAt: now }).where(voteKey)
    } else {
      await tx.insert(votes).values({
        accountId,
        topicId,
        axis,
        optionValue,
        regionCode,
        castAt: now,
        firstCastAt: now,
      })
    }

    if (topic.kind === 'weather') {
      const freshSignal = !existing || existing.castAt < windowStart(now, input.windowHours)
      if (freshSignal) {
        await grantWeatherCredit(tx, accountId, topicId, now, input.dailyCreditCap)
      }
    } else if (!existing && topic.creditCost > 0) {
      await deductCredit(tx, accountId, topicId, topic.creditCost, now)
    }

    const [tally, wallet] = await Promise.all([
      getTally(tx, {
        topicId,
        kind: topic.kind,
        topicOptions: topic.options,
        regionCode,
        axis,
        now,
        windowHours: input.windowHours,
        minSampleThreshold: input.minSampleThreshold,
      }),
      getWallet(tx, accountId, now, input.dailyCreditCap),
    ])

    return { vote: { optionValue, castAt: now.toISOString() }, wallet, tally, axis }
  })
}

async function cachedRegionCode(db: Db, accountId: string): Promise<string | null> {
  const [account] = await db
    .select({ regionCode: accounts.regionCode })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  return account?.regionCode ?? null
}

// 일일 상한은 행 수가 아니라 적립 금액 합으로 판정 — 명세 단위는 "3크레딧"이다
async function grantWeatherCredit(
  tx: Db,
  accountId: string,
  topicId: string,
  now: Date,
  dailyCap: number,
): Promise<void> {
  const [earned] = await tx
    .select({ total: sum(creditLedger.amount) })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.accountId, accountId),
        eq(creditLedger.reason, 'weather_vote'),
        gte(creditLedger.createdAt, kstDayStart(now)),
      ),
    )
  if (Number(earned?.total ?? 0) >= dailyCap) {
    return
  }

  await tx
    .insert(creditLedger)
    .values({ accountId, amount: 1, reason: 'weather_vote', refTopicId: topicId, createdAt: now })
  await tx
    .update(accounts)
    .set({ creditBalance: sql`${accounts.creditBalance} + 1` })
    .where(eq(accounts.id, accountId))
}

async function deductCredit(
  tx: Db,
  accountId: string,
  topicId: string,
  cost: number,
  now: Date,
): Promise<void> {
  const [account] = await tx
    .select({ creditBalance: accounts.creditBalance })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  if (!account || account.creditBalance < cost) {
    throw new AppError('INSUFFICIENT_CREDIT', 422, `balance ${account?.creditBalance ?? 0} < ${cost}`)
  }

  await tx.insert(creditLedger).values({
    accountId,
    amount: -cost,
    reason: 'topic_vote_cost',
    refTopicId: topicId,
    createdAt: now,
  })
  await tx
    .update(accounts)
    .set({ creditBalance: sql`${accounts.creditBalance} - ${cost}` })
    .where(eq(accounts.id, accountId))
}
