import { createHash, randomUUID } from 'node:crypto'

// 토큰은 평문을 저장하지 않는다 — DB 유출이 전 계정 탈취로 이어지면 안 된다.
// uuid는 고엔트로피라 솔트 없는 SHA-256으로 충분하다
export function issueToken(): { token: string; hash: string } {
  const token = randomUUID()
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
