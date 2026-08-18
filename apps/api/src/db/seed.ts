import { type Db } from './client.js'
import { topics } from './schema.js'
import { WEATHER_TOPIC_ID } from '../domain/weather-options.js'

// 날씨 주제는 상설 싱글턴 (entity-topic: kind=weather, 지역 파티션, 마감 없음, 크레딧 0)
// 선택지는 코드의 월 매핑 규칙에서 파생되므로 options는 비워둔다
export async function ensureWeatherTopic(db: Db): Promise<void> {
  await db
    .insert(topics)
    .values({
      id: WEATHER_TOPIC_ID,
      title: '지금 날씨 어때?',
      kind: 'weather',
      status: 'active',
      regional: true,
      creditCost: 0,
    })
    .onConflictDoNothing({ target: topics.id })
}
