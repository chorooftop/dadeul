import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// 도메인 근거: specs/atoms/entity/*.md — 물리 스키마는 여기가 진실, 도메인 의미는 atom이 진실

// entity-region — 지역 마스터. 카카오 판별 결과로 lazy upsert되어 채워진다
export const regions = pgTable('regions', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// entity-device-account — 익명 기기 계정. deviceKey가 플랫폼 보존 저장소의 복원 키
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceKey: uuid('device_key').notNull().unique(),
    platform: text('platform', { enum: ['ios', 'android'] }).notNull(),
    accessToken: uuid('access_token')
      .notNull()
      .unique()
      .default(sql`gen_random_uuid()`),
    regionCode: text('region_code').references(() => regions.code),
    creditBalance: integer('credit_balance').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('accounts_access_token_idx').on(table.accessToken)],
)

// entity-topic — 날씨는 상설 싱글턴(kind=weather), 큐레이션은 기간제
export type TopicOption = { value: string; label: string; emoji?: string }

export const topics = pgTable('topics', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind', { enum: ['weather', 'curated'] }).notNull(),
  status: text('status', { enum: ['scheduled', 'active', 'closed'] }).notNull(),
  // 날씨 주제는 빈 배열 — 선택지가 코드(월 매핑 규칙)에서 파생된다 (term-weather-option)
  options: jsonb('options').$type<TopicOption[]>().notNull().default([]),
  regional: boolean('regional').notNull(),
  creditCost: integer('credit_cost').notNull().default(0),
  openAt: timestamp('open_at', { withTimezone: true }),
  closeAt: timestamp('close_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// entity-vote — 이력이 아닌 현재 상태 레코드. (account, topic) 복합 PK가
// rule-revote-replace("유효 표는 항상 1개")의 물리적 강제 장치
export const votes = pgTable(
  'votes',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id),
    optionValue: text('option_value').notNull(),
    regionCode: text('region_code').references(() => regions.code),
    castAt: timestamp('cast_at', { withTimezone: true }).notNull().defaultNow(),
    firstCastAt: timestamp('first_cast_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.topicId] }),
    // 슬라이딩 윈도우 집계(rule-sliding-window-tally)의 스캔 경로
    index('votes_tally_idx').on(table.topicId, table.regionCode, table.castAt),
  ],
)

// entity-credit-wallet — 원장. balance는 accounts.credit_balance에 트랜잭션으로 동기 유지
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    amount: integer('amount').notNull(),
    reason: text('reason', {
      enum: ['weather_vote', 'topic_vote_cost', 'ops_adjustment'],
    }).notNull(),
    refTopicId: text('ref_topic_id').references(() => topics.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // 일일 적립 상한(rule-credit-grant) 판정의 스캔 경로
  (table) => [index('credit_ledger_daily_idx').on(table.accountId, table.reason, table.createdAt)],
)
