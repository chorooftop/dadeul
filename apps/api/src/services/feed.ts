import { and, eq } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { regions, topics, votes } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { visibleWeatherOptions, WEATHER_TOPIC_ID } from '../domain/weather-options.js'
import { type RegionView } from './accounts.js'
import { getTally, type TallyResult } from './tally.js'
import { getWallet, type WalletView } from './wallet.js'

interface MyVoteView {
  optionValue: string
  castAt: string
}

export interface FeedResult {
  region: RegionView
  weather: {
    tally: TallyResult
    myVote?: MyVoteView
    visibleOptions: string[]
  }
  topics: Array<{
    topic: {
      id: string
      title: string
      kind: 'weather' | 'curated'
      status: 'scheduled' | 'active' | 'closed'
      options: Array<{ value: string; label: string; emoji?: string }>
      regional: boolean
      creditCost: number
      openAt?: string
      closeAt?: string
    }
    tally: TallyResult
    myVote?: MyVoteView
  }>
  wallet: WalletView
}

interface FeedInput {
  accountId: string
  cachedRegionCode: string | null
  regionCode?: string
  now: Date
  windowHours: number
  minSampleThreshold: number
  dailyCreditCap: number
}

// action-tally-feed: 위젯 1회 렌더에 필요한 전부를 한 번에 (위젯·홈 공용, 스키마 분화 금지)
export async function getFeed(db: Db, input: FeedInput): Promise<FeedResult> {
  const code = input.regionCode ?? input.cachedRegionCode
  if (!code) {
    throw new AppError('REGION_UNRESOLVED', 422, 'no region — resolve or pass regionCode')
  }
  const [region] = await db.select().from(regions).where(eq(regions.code, code))
  if (!region) {
    throw new AppError('REGION_UNRESOLVED', 422, `unknown region: ${code}`)
  }

  const tallyBase = {
    now: input.now,
    windowHours: input.windowHours,
    minSampleThreshold: input.minSampleThreshold,
  }

  const [weatherTopic] = await db.select().from(topics).where(eq(topics.id, WEATHER_TOPIC_ID))
  if (!weatherTopic) {
    throw new AppError('INTERNAL_ERROR', 500, 'weather topic missing — seed not applied')
  }
  const weatherTally = await getTally(db, {
    ...tallyBase,
    topicId: weatherTopic.id,
    kind: weatherTopic.kind,
    topicOptions: weatherTopic.options,
    regionCode: region.code,
  })

  const curated = await db
    .select()
    .from(topics)
    .where(and(eq(topics.kind, 'curated'), eq(topics.status, 'active')))
  const openCurated = curated.filter(
    (topic) =>
      (topic.openAt === null || topic.openAt <= input.now) &&
      (topic.closeAt === null || topic.closeAt > input.now),
  )

  const curatedEntries = await Promise.all(
    openCurated.map(async (topic): Promise<FeedResult['topics'][number]> => {
      const topicView = {
        id: topic.id,
        title: topic.title,
        kind: topic.kind,
        status: topic.status,
        options: topic.options,
        regional: topic.regional,
        creditCost: topic.creditCost,
        ...(topic.openAt && { openAt: topic.openAt.toISOString() }),
        ...(topic.closeAt && { closeAt: topic.closeAt.toISOString() }),
      }
      const tally = await getTally(db, {
        ...tallyBase,
        topicId: topic.id,
        kind: topic.kind,
        topicOptions: topic.options,
        regionCode: topic.regional ? region.code : null,
      })
      const myVote = await getMyVote(db, input.accountId, topic.id)
      return myVote ? { topic: topicView, tally, myVote } : { topic: topicView, tally }
    }),
  )

  const wallet = await getWallet(db, input.accountId, input.now, input.dailyCreditCap)
  const weatherMyVote = await getMyVote(db, input.accountId, WEATHER_TOPIC_ID)

  return {
    region: {
      code: region.code,
      name: region.name,
      fullName: region.fullName,
      active: region.active,
    },
    weather: {
      tally: weatherTally,
      ...(weatherMyVote && { myVote: weatherMyVote }),
      visibleOptions: visibleWeatherOptions(input.now).map((option) => option.value),
    },
    topics: curatedEntries,
    wallet,
  }
}

async function getMyVote(
  db: Db,
  accountId: string,
  topicId: string,
): Promise<MyVoteView | undefined> {
  const [vote] = await db
    .select({ optionValue: votes.optionValue, castAt: votes.castAt })
    .from(votes)
    .where(and(eq(votes.accountId, accountId), eq(votes.topicId, topicId)))
  if (!vote) {
    return undefined
  }
  return { optionValue: vote.optionValue, castAt: vote.castAt.toISOString() }
}
