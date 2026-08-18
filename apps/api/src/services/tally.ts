import { and, count, eq, gte, isNull, type SQL } from 'drizzle-orm'
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

// 집계 전략은 kind로 갈린다 (rule-sliding-window-tally DO NOT):
// - weather: 슬라이딩 윈도우 — "지금"만 유효
// - curated: 기간제 누적 — 윈도우·최소표본 미적용 (투표 자체가 open 기간에만 가능)
// MVP는 조회 시점 실시간 집계, 스냅샷 테이블 없음 (entity-tally 결정 기록)
export async function getTally(db: Db, input: TallyInput): Promise<TallyResult> {
  const conditions: SQL[] = [
    eq(votes.topicId, input.topicId),
    input.regionCode === null ? isNull(votes.regionCode) : eq(votes.regionCode, input.regionCode),
  ]
  if (input.kind === 'weather') {
    conditions.push(gte(votes.castAt, windowStart(input.now, input.windowHours)))
  }

  const rows = await db
    .select({ optionValue: votes.optionValue, voteCount: count() })
    .from(votes)
    .where(and(...conditions))
    .groupBy(votes.optionValue)

  // counts는 항상 전체 선택지 키를 갖는다 (specs/openapi.yaml Tally — 노출 필터는 클라이언트).
  // 정의에 없는 선택지의 표(운영자가 선택지를 뺀 경우)는 분모·분자 모두에서 제외해 비율 왜곡을 막는다
  const allValues =
    input.kind === 'weather'
      ? WEATHER_OPTIONS.map((option) => option.value)
      : input.topicOptions.map((option) => option.value)
  const counts = Object.fromEntries(allValues.map((value) => [value, 0]))
  for (const row of rows) {
    if (row.optionValue in counts) {
      counts[row.optionValue] = row.voteCount
    }
  }

  const totalVotes = Object.values(counts).reduce((sum, value) => sum + value, 0)
  // 최소표본 규칙은 날씨의 지역별 집계 전용 (rule-min-sample-display Applicability)
  const sampleSufficient =
    input.kind === 'weather' ? totalVotes >= input.minSampleThreshold : true

  const base: TallyResult = {
    topicId: input.topicId,
    ...(input.regionCode !== null && { regionCode: input.regionCode }),
    counts,
    totalVotes,
    sampleSufficient,
    computedAt: input.now.toISOString(),
  }

  if (!sampleSufficient || totalVotes === 0) {
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
