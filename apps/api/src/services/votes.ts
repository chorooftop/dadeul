import { and, count, eq, gte, sql } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { accounts, creditLedger, regions, topics, votes } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { kstDayStart, windowStart } from '../domain/time.js'
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
}

// action-vote-cast: 검증 → UPSERT(rule-revote-replace) → 크레딧(rule-credit-grant) → 집계.
// 크레딧 지급 조건: 새 레코드이거나 직전 표가 슬라이딩 윈도우 밖일 때 (신선한 신호 공급 보상).
// 윈도우 내 재투표는 미지급. 일일 상한 도달 시 투표는 허용하고 크레딧만 미지급.
export async function castVote(db: Db, input: CastVoteInput): Promise<CastVoteResult> {
  const { accountId, topicId, optionValue, now } = input

  await db.transaction(async (tx) => {
    const [topic] = await tx.select().from(topics).where(eq(topics.id, topicId))
    if (!topic || topic.status === 'scheduled') {
      throw new AppError('TOPIC_NOT_FOUND', 404, `topic not found: ${topicId}`)
    }
    const periodClosed =
      (topic.closeAt !== null && topic.closeAt <= now) ||
      (topic.openAt !== null && topic.openAt > now)
    if (topic.status === 'closed' || periodClosed) {
      throw new AppError('TOPIC_CLOSED', 409, `topic closed: ${topicId}`)
    }

    const validOption =
      topic.kind === 'weather'
        ? isSubmittableWeatherOption(optionValue, now)
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

    // 잔액·크레딧 판정의 race 방지 — 계정 행 잠금
    await tx.execute(sql`select 1 from ${accounts} where ${accounts.id} = ${accountId} for update`)

    const [existing] = await tx
      .select({ castAt: votes.castAt })
      .from(votes)
      .where(and(eq(votes.accountId, accountId), eq(votes.topicId, topicId)))

    if (existing) {
      await tx
        .update(votes)
        .set({ optionValue, regionCode, castAt: now })
        .where(and(eq(votes.accountId, accountId), eq(votes.topicId, topicId)))
    } else {
      await tx
        .insert(votes)
        .values({ accountId, topicId, optionValue, regionCode, castAt: now, firstCastAt: now })
    }

    if (topic.kind === 'weather') {
      const freshSignal =
        !existing || existing.castAt < windowStart(now, input.windowHours)
      if (freshSignal) {
        await grantWeatherCredit(tx, accountId, topicId, now, input.dailyCreditCap)
      }
    } else if (!existing && topic.creditCost > 0) {
      await deductCredit(tx, accountId, topicId, topic.creditCost, now)
    }
  })

  const [topic] = await db.select().from(topics).where(eq(topics.id, topicId))
  if (!topic) {
    throw new AppError('INTERNAL_ERROR', 500, `topic vanished mid-request: ${topicId}`)
  }
  const regionForTally = topic.regional
    ? (input.regionCode ?? (await cachedRegionCode(db, accountId)))
    : null

  const [tally, wallet] = await Promise.all([
    getTally(db, {
      topicId,
      kind: topic.kind,
      topicOptions: topic.options,
      regionCode: regionForTally ?? null,
      now,
      windowHours: input.windowHours,
      minSampleThreshold: input.minSampleThreshold,
    }),
    getWallet(db, accountId, now, input.dailyCreditCap),
  ])

  return { vote: { optionValue, castAt: now.toISOString() }, wallet, tally }
}

async function cachedRegionCode(db: Db, accountId: string): Promise<string | null> {
  const [account] = await db
    .select({ regionCode: accounts.regionCode })
    .from(accounts)
    .where(eq(accounts.id, accountId))
  return account?.regionCode ?? null
}

async function grantWeatherCredit(
  tx: Db,
  accountId: string,
  topicId: string,
  now: Date,
  dailyCap: number,
): Promise<void> {
  const [earned] = await tx
    .select({ grants: count() })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.accountId, accountId),
        eq(creditLedger.reason, 'weather_vote'),
        gte(creditLedger.createdAt, kstDayStart(now)),
      ),
    )
  if ((earned?.grants ?? 0) >= dailyCap) {
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
