import { and, eq, inArray } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { regions, topics, votes } from '../db/schema.js'
import { AppError } from '../domain/errors.js'
import { isTopicOpen } from '../domain/topics.js'
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

  const curated = await db
    .select()
    .from(topics)
    .where(and(eq(topics.kind, 'curated'), eq(topics.status, 'active')))
  const openCurated = curated.filter((topic) => isTopicOpen(topic, input.now))

  // 내 표는 전 주제 한 번에 조회 — 이 엔드포인트는 모든 기기가 30분마다 부르는 위젯 경로다
  const myVotes = await getMyVotes(db, input.accountId, [
    WEATHER_TOPIC_ID,
    ...openCurated.map((topic) => topic.id),
  ])

  const [weatherTally, curatedEntries, wallet] = await Promise.all([
    getTally(db, {
      ...tallyBase,
      topicId: weatherTopic.id,
      kind: weatherTopic.kind,
      topicOptions: weatherTopic.options,
      // votes.ts의 저장 경로와 같은 분기 — regional 전제가 어긋나면 집계가 조용히 0이 된다
      regionCode: weatherTopic.regional ? region.code : null,
    }),
    Promise.all(
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
        const myVote = myVotes.get(topic.id)
        return myVote ? { topic: topicView, tally, myVote } : { topic: topicView, tally }
      }),
    ),
    getWallet(db, input.accountId, input.now, input.dailyCreditCap),
  ])

  const weatherMyVote = myVotes.get(WEATHER_TOPIC_ID)

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

async function getMyVotes(
  db: Db,
  accountId: string,
  topicIds: string[],
): Promise<Map<string, MyVoteView>> {
  if (topicIds.length === 0) {
    return new Map()
  }
  const rows = await db
    .select({ topicId: votes.topicId, optionValue: votes.optionValue, castAt: votes.castAt })
    .from(votes)
    .where(and(eq(votes.accountId, accountId), inArray(votes.topicId, topicIds)))
  return new Map(
    rows.map((row) => [
      row.topicId,
      { optionValue: row.optionValue, castAt: row.castAt.toISOString() },
    ]),
  )
}
