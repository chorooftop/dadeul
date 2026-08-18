import { eq } from 'drizzle-orm'
import { type FastifyReply, type FastifyRequest } from 'fastify'
import { type Db } from '../db/client.js'
import { accounts } from '../db/schema.js'
import { AppError } from '../domain/errors.js'

export interface AuthedAccount {
  id: string
  regionCode: string | null
}

// bootstrapAccount가 발급한 계정 토큰의 Bearer 인증
export function makeAuthenticate(db: Db) {
  return async function authenticate(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const header = request.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined
    // 토큰은 uuid 형식 — 형식 불일치는 DB까지 가지 않고 거부 (uuid 캐스팅 에러로 500이 나면 안 됨)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!token || !UUID_RE.test(token)) {
      throw new AppError('UNAUTHORIZED', 401, 'missing or malformed bearer token')
    }

    const [account] = await db
      .select({ id: accounts.id, regionCode: accounts.regionCode })
      .from(accounts)
      .where(eq(accounts.accessToken, token))
    if (!account) {
      throw new AppError('UNAUTHORIZED', 401, 'invalid token')
    }

    request.account = { id: account.id, regionCode: account.regionCode }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    account: AuthedAccount
  }
}
