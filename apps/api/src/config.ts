import { z } from 'zod'

// 정책 상수의 기본값은 specs/atoms/rule/*의 확정 정책과 일치해야 한다
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().optional(),
  KAKAO_REST_API_KEY: z.string().min(1).optional(),
  // Cloud Run 동시성(20) × 인스턴스 상한(5)에 맞춘 커넥션 상한 — 5×5=25로 pooler 한도를 계산 가능하게 둔다.
  // pg 기본값 10을 그대로 두면 인스턴스 하나가 커넥션 10개를 잡아 상한이 50까지 튄다
  DB_POOL_MAX: z.coerce.number().int().positive().default(5),
  // 프록시(Cloud Run GFE) 뒤에서 X-Forwarded-For를 신뢰할 홉 수. 미설정이면 소켓 주소를 그대로 쓴다.
  // 로컬·테스트는 프록시가 없으므로 기본 false — 켜두면 클라이언트가 헤더를 위조해 레이트리밋을 우회한다
  TRUST_PROXY: z.string().min(1).optional(),
  // 배포 직후 X-Forwarded-For 형식을 실측해 TRUST_PROXY 홉 수를 확정하기 위한 일회성 스위치
  LOG_CLIENT_IP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  TALLY_WINDOW_HOURS: z.coerce.number().int().positive().default(2),
  MIN_SAMPLE_THRESHOLD: z.coerce.number().int().positive().default(5),
  DAILY_CREDIT_CAP: z.coerce.number().int().positive().default(3),
  // 레이트 리미팅 (분당) — bootstrap은 미인증 계정 생성, resolve는 유료 카카오 호출이라 별도 상한
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_BOOTSTRAP_PER_MIN: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_RESOLVE_PER_MIN: z.coerce.number().int().positive().default(10),
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
