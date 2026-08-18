const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// 일일 적립 상한(rule-credit-grant)의 "오늘" 경계 — KST 자정
export function kstDayStart(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const kstMidnightUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  return new Date(kstMidnightUtc - KST_OFFSET_MS)
}

// 슬라이딩 윈도우(rule-sliding-window-tally)의 시작 시각
export function windowStart(now: Date, windowHours: number): Date {
  return new Date(now.getTime() - windowHours * 60 * 60 * 1000)
}
