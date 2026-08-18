import { and, count, eq, gte, isNull } from 'drizzle-orm'
import { type Db } from '../db/client.js'
import { votes, type TopicOption } from '../db/schema.js'
import { WEATHER_OPTIONS } from '../domain/weather-options.js'
import { windowStart } from '../domain/time.js'

export interface TallyResult {
  topicId: string
  regionCode?: string
  counts: Record<string, number>
  totalVotes: number
  sampleSufficient: boolean
  leadingOption?: string
  leadingRatio?: number
  computedAt: string
}

interface TallyInput {
  topicId: string
  kind: 'weather' | 'curated'
  topicOptions: TopicOption[]
  regionCode: string | null
  now: Date
  windowHours: number
  minSampleThreshold: number
}

// rule-sliding-window-tally: 조회 시점 실시간 집계 (MVP — 스냅샷 테이블 없음, entity-tally 결정 기록)
export async function getTally(db: Db, input: TallyInput): Promise<TallyResult> {
  const since = windowStart(input.now, input.windowHours)

  const rows = await db
    .select({ optionValue: votes.optionValue, voteCount: count() })
    .from(votes)
    .where(
      and(
        eq(votes.topicId, input.topicId),
        input.regionCode === null
          ? isNull(votes.regionCode)
          : eq(votes.regionCode, input.regionCode),
        gte(votes.castAt, since),
      ),
    )
    .groupBy(votes.optionValue)

  // counts는 항상 전체 선택지 키를 갖는다 (specs/openapi.yaml Tally — 노출 필터는 클라이언트)
  const allValues =
    input.kind === 'weather'
      ? WEATHER_OPTIONS.map((option) => option.value)
      : input.topicOptions.map((option) => option.value)
  const counts = Object.fromEntries(allValues.map((value) => [value, 0]))
  for (const row of rows) {
    counts[row.optionValue] = row.voteCount
  }

  const totalVotes = rows.reduce((sum, row) => sum + row.voteCount, 0)
  const sampleSufficient = totalVotes >= input.minSampleThreshold

  const base: TallyResult = {
    topicId: input.topicId,
    ...(input.regionCode !== null && { regionCode: input.regionCode }),
    counts,
    totalVotes,
    sampleSufficient,
    computedAt: input.now.toISOString(),
  }

  if (!sampleSufficient) {
    return base
  }

  // 동률은 값의 사전순으로 결정적 판정 — 위젯이 요청마다 다른 1위를 보이면 안 된다
  const leading = [...allValues].sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b),
  )[0]
  if (leading === undefined) {
    return base
  }
  return {
    ...base,
    leadingOption: leading,
    leadingRatio: (counts[leading] ?? 0) / totalVotes,
  }
}
