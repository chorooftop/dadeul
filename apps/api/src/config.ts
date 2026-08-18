import { z } from 'zod'

// 정책 상수의 기본값은 specs/atoms/rule/*의 확정 정책과 일치해야 한다
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().optional(),
  TALLY_WINDOW_HOURS: z.coerce.number().int().positive().default(2),
  MIN_SAMPLE_THRESHOLD: z.coerce.number().int().positive().default(5),
  DAILY_CREDIT_CAP: z.coerce.number().int().positive().default(3),
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    throw new Error(`환경변수 검증 실패 — ${detail}`)
  }
  return parsed.data
}
