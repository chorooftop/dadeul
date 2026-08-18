// 에러 토큰은 UX다 (specs/openapi.yaml Error) — 클라이언트가 토큰별 안내·복구 동선으로 매핑
export type ErrorToken =
  | 'TOPIC_NOT_FOUND'
  | 'TOPIC_CLOSED'
  | 'INVALID_OPTION'
  | 'INSUFFICIENT_CREDIT'
  | 'REGION_UNRESOLVED'
  | 'REGION_INACTIVE'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  readonly token: ErrorToken
  readonly statusCode: number

  constructor(token: ErrorToken, statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
    this.token = token
    this.statusCode = statusCode
  }
}
